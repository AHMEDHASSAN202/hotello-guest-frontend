import { api } from './api';

const PUSH_KEY = 'gxp_guest_push_v1';

/**
 * Epic 23 (Web Push) — client-side push lifecycle: permission/subscribe,
 * platform detection, and the per-stay "don't nag" prompt bookkeeping
 * (23.2 AC1). Same single-purpose-module shape as `cartStore`/`tokenStore`.
 */
export type PushUiState = 'unsupported' | 'blocked' | 'subscribed' | 'off' | 'promptable';
export type PromptMoment = 'post_request' | 'post_order' | 'inbox_open';

/**
 * True when neither the SW/Push APIs nor the Notification API are usable at
 * all — includes iOS Safari outside of an installed PWA, which has no
 * Notification API until added to the home screen (23.2 AC2).
 */
function pushUnsupported(): boolean {
  if (typeof window === 'undefined') return true;
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return true;
  if (!('Notification' in window)) return true;
  return false;
}

/** getState() — see the interface doc in the task brief for the branch order. */
export async function getPushState(): Promise<PushUiState> {
  if (pushUnsupported()) return 'unsupported';
  if (Notification.permission === 'denied') return 'blocked';
  if (Notification.permission !== 'granted') return 'promptable';
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  return sub ? 'subscribed' : 'off';
}

/**
 * Base64url (VAPID public key format) → Uint8Array, the shape the Push API's
 * `applicationServerKey` expects. Pads to a multiple of 4 and swaps the
 * URL-safe alphabet back to standard base64 before decoding.
 */
export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/** display-mode: standalone (installed PWA) or the iOS-specific navigator flag. */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.matchMedia?.('(display-mode: standalone)').matches) return true;
  return (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

/** iOS Safari, not yet installed — the A2HS path must run before push works (23.2 AC2). */
export function isIosSafariBrowser(): boolean {
  if (typeof window === 'undefined') return false;
  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
  return isIos && !isStandalone();
}

export function deviceHint(): string {
  if (typeof window === 'undefined') return 'other';
  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
  if (isIos) return isStandalone() ? 'ios-pwa' : 'other';
  if (/android/i.test(navigator.userAgent)) return 'android';
  if (isStandalone()) return 'desktop';
  return /mobile/i.test(navigator.userAgent) ? 'other' : 'desktop';
}

/**
 * Requests permission, subscribes with the backend's VAPID key, and posts
 * the subscription. Never throws — every failure path (unsupported, denied,
 * network) resolves `false` so the calling sheet can just show a fallback.
 */
export async function subscribeToPush(hint?: string): Promise<boolean> {
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false;
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return false;
    const reg = await navigator.serviceWorker.ready;
    const { publicKey } = await api<{ publicKey: string }>('/guest/push/config');
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      // TS 5.5's lib.dom types Uint8Array's backing buffer as the broader
      // ArrayBufferLike (includes SharedArrayBuffer), which BufferSource
      // doesn't accept — the value itself is a plain, correctly-shaped
      // Uint8Array the Push API expects.
      applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
    });
    const json = sub.toJSON();
    await api('/guest/push/subscriptions', {
      method: 'POST',
      body: JSON.stringify({
        endpoint: sub.endpoint,
        keys: { p256dh: json.keys!.p256dh, auth: json.keys!.auth },
        deviceHint: hint ?? deviceHint(),
      }),
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Local unsubscribe first (so the browser stops delivering pushes even if
 * the network call fails), then a best-effort server notification — the
 * server also prunes dead endpoints on send failure, so a lost POST here is
 * not a correctness problem, just a slightly stale row.
 */
export async function unsubscribeFromPush(): Promise<void> {
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (!sub) return;
    const endpoint = sub.endpoint;
    await sub.unsubscribe();
    try {
      await api('/guest/push/unsubscribe', {
        method: 'POST',
        body: JSON.stringify({ endpoint }),
      });
    } catch {
      /* server prunes dead endpoints anyway — best effort only */
    }
  } catch {
    /* nothing to unsubscribe, or the browser refused — not fatal */
  }
}

interface PushPromptState {
  stayId: string;
  shown: PromptMoment[];
}

function loadPromptState(stayId: string): PushPromptState {
  const empty: PushPromptState = { stayId, shown: [] };
  if (typeof window === 'undefined') return empty;
  try {
    const raw = localStorage.getItem(PUSH_KEY);
    if (!raw) return empty;
    const parsed = JSON.parse(raw) as PushPromptState;
    // A different (or ended) stay → the old bookkeeping no longer applies.
    if (parsed.stayId !== stayId || !Array.isArray(parsed.shown)) return empty;
    return parsed;
  } catch {
    return empty;
  }
}

function savePromptState(state: PushPromptState) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(PUSH_KEY, JSON.stringify(state));
}

/**
 * Per-stay "don't nag" bookkeeping (23.2 AC1): a permission-independent
 * record of which high-intent moments have already shown the pre-prompt,
 * capped at twice per stay total — across ALL moments, not per moment.
 */
export const pushPromptStore = {
  shouldPrompt(stayId: string, moment: PromptMoment): boolean {
    const state = loadPromptState(stayId);
    if (state.shown.includes(moment)) return false;
    return state.shown.length < 2;
  },

  recordShown(stayId: string, moment: PromptMoment): void {
    const state = loadPromptState(stayId);
    if (state.shown.includes(moment)) return;
    savePromptState({ stayId, shown: [...state.shown, moment] });
  },
};
