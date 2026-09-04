// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { apiMock } = vi.hoisted(() => ({ apiMock: vi.fn() }));
vi.mock('./api', () => ({ api: apiMock }));

import {
  deviceHint,
  getPushState,
  isIosSafariBrowser,
  isStandalone,
  pushPromptStore,
  subscribeToPush,
  unsubscribeFromPush,
  urlBase64ToUint8Array,
} from './push';

/** Epic 23.2 AC1 — per-stay "don't nag" bookkeeping, permission-independent. */
describe('pushPromptStore (23.2 AC1)', () => {
  beforeEach(() => localStorage.clear());

  it('prompts at a first high-intent moment', () => {
    expect(pushPromptStore.shouldPrompt('stay-1', 'post_request')).toBe(true);
  });

  it('a shown moment does not re-prompt; a distinct moment does', () => {
    pushPromptStore.recordShown('stay-1', 'post_request');
    expect(pushPromptStore.shouldPrompt('stay-1', 'post_request')).toBe(false);
    expect(pushPromptStore.shouldPrompt('stay-1', 'post_order')).toBe(true);
  });

  it('never prompts a third time (max twice per stay, across ALL moments)', () => {
    pushPromptStore.recordShown('stay-1', 'post_request');
    pushPromptStore.recordShown('stay-1', 'post_order');
    // A third, distinct moment — not previously shown — still must not prompt:
    // the cap is a per-stay total, not a per-moment allowance.
    expect(pushPromptStore.shouldPrompt('stay-1', 'inbox_open')).toBe(false);
  });

  it("a new stayId resets the slate (23.2 AC4)", () => {
    pushPromptStore.recordShown('stay-1', 'post_request');
    pushPromptStore.recordShown('stay-1', 'post_order');
    expect(pushPromptStore.shouldPrompt('stay-2', 'post_request')).toBe(true);
  });

  it('recordShown is idempotent for a repeated moment', () => {
    pushPromptStore.recordShown('stay-1', 'post_request');
    pushPromptStore.recordShown('stay-1', 'post_request');
    // Still only counts once toward the cap of two.
    expect(pushPromptStore.shouldPrompt('stay-1', 'post_order')).toBe(true);
    pushPromptStore.recordShown('stay-1', 'post_order');
    expect(pushPromptStore.shouldPrompt('stay-1', 'inbox_open')).toBe(false);
  });
});

describe('urlBase64ToUint8Array', () => {
  it('decodes a realistic VAPID key (base64url, dashes/underscores, missing padding)', () => {
    // 14 random bytes whose base64url encoding contains both '-' and '_' and
    // is not a multiple of 4 chars (needs padding restored before decode) —
    // a realistic stand-in for a VAPID public key. `expectedBytes` was
    // computed independently via Node's own base64url decoder, so this
    // isn't a tautological round-trip through the function under test.
    const urlsafe = '6Gx0tNmx33qbg_-SbBA';
    const expectedBytes = [232, 108, 116, 180, 217, 177, 223, 122, 155, 131, 255, 146, 108, 16];

    expect(urlsafe).toContain('-');
    expect(urlsafe).toContain('_');
    expect(urlsafe.length % 4).not.toBe(0);

    const decoded = urlBase64ToUint8Array(urlsafe);

    expect(Array.from(decoded)).toEqual(expectedBytes);
  });

  it('decodes without throwing when length is already a multiple of 4', () => {
    const decoded = urlBase64ToUint8Array('YWJjZA'); // 'abcd'
    expect(Array.from(decoded)).toEqual([97, 98, 99, 100]);
  });
});

function defineNav(props: Record<string, unknown>) {
  for (const [key, value] of Object.entries(props)) {
    Object.defineProperty(window.navigator, key, { value, configurable: true });
  }
}

function stubPushManagerGlobal(present: boolean) {
  if (present) {
    Object.defineProperty(window, 'PushManager', { value: function PushManager() {}, configurable: true });
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (window as any).PushManager;
  }
}

describe('platform detection', () => {
  afterEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (window as any).matchMedia;
  });

  it('isStandalone reads display-mode: standalone', () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: true }) as never;
    expect(isStandalone()).toBe(true);
  });

  it('isStandalone reads the iOS navigator.standalone flag when matchMedia says no', () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as never;
    defineNav({ standalone: true });
    expect(isStandalone()).toBe(true);
    defineNav({ standalone: undefined });
  });

  it('isIosSafariBrowser is true on iOS outside standalone', () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as never;
    defineNav({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_4 like Mac OS X)', standalone: false });
    expect(isIosSafariBrowser()).toBe(true);
  });

  it('isIosSafariBrowser is false once installed (standalone)', () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: true }) as never;
    defineNav({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_4 like Mac OS X)' });
    expect(isIosSafariBrowser()).toBe(false);
  });

  it('isIosSafariBrowser is false on Android', () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as never;
    defineNav({ userAgent: 'Mozilla/5.0 (Linux; Android 13)', standalone: undefined });
    expect(isIosSafariBrowser()).toBe(false);
  });

  it('deviceHint distinguishes ios-pwa / android / desktop', () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: true }) as never;
    defineNav({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_4 like Mac OS X)' });
    expect(deviceHint()).toBe('ios-pwa');

    defineNav({ userAgent: 'Mozilla/5.0 (Linux; Android 13)' });
    expect(deviceHint()).toBe('android');

    window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as never;
    defineNav({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' });
    expect(deviceHint()).toBe('desktop');
  });
});

describe('getPushState', () => {
  afterEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (window as any).Notification;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (window.navigator as any).serviceWorker;
    stubPushManagerGlobal(false);
  });

  it('unsupported when serviceWorker/PushManager are missing', async () => {
    stubPushManagerGlobal(false);
    expect(await getPushState()).toBe('unsupported');
  });

  it('unsupported (not iOS) when the Notification API is missing on a non-iOS browser', async () => {
    stubPushManagerGlobal(true);
    defineNav({
      serviceWorker: { ready: Promise.resolve({}) },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    });
    expect(await getPushState()).toBe('unsupported');
  });

  /**
   * FINAL-REVIEW FIX (23.2 AC2) — the old blanket 'unsupported' result here
   * made the iOS A2HS install guide unreachable on a real device: both
   * routes that open the guide sheet required 'promptable', but 'promptable'
   * implies the Notification API exists, which on iOS means the app is
   * already installed — so `isIosSafariBrowser()` (which checks NOT
   * standalone) would always be false by the time the guide could show.
   * This is the real, reachable device path: an iOS Safari tab, not
   * installed, has no Notification API at all.
   */
  it("'ios-install' when the Notification API is missing on iOS Safari, not installed — the real device path (23.2 AC2)", async () => {
    stubPushManagerGlobal(true);
    defineNav({
      serviceWorker: { ready: Promise.resolve({}) },
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_4 like Mac OS X)',
      standalone: false,
    });
    expect(await getPushState()).toBe('ios-install');
  });

  it("'ios-install' even when serviceWorker/PushManager are also missing on iOS Safari, not installed", async () => {
    stubPushManagerGlobal(false);
    defineNav({
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_4 like Mac OS X)',
      standalone: false,
    });
    expect(await getPushState()).toBe('ios-install');
  });

  it("stays 'unsupported' once installed (standalone) even with no push APIs — isIosSafariBrowser is false there", async () => {
    stubPushManagerGlobal(false);
    window.matchMedia = vi.fn().mockReturnValue({ matches: true }) as never;
    defineNav({
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_4 like Mac OS X)',
    });
    expect(await getPushState()).toBe('unsupported');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (window as any).matchMedia;
  });

  it('blocked when permission is denied', async () => {
    stubPushManagerGlobal(true);
    defineNav({ serviceWorker: { ready: Promise.resolve({}) } });
    vi.stubGlobal('Notification', { permission: 'denied' });
    expect(await getPushState()).toBe('blocked');
    vi.unstubAllGlobals();
  });

  it('promptable when permission is default', async () => {
    stubPushManagerGlobal(true);
    defineNav({ serviceWorker: { ready: Promise.resolve({}) } });
    vi.stubGlobal('Notification', { permission: 'default' });
    expect(await getPushState()).toBe('promptable');
    vi.unstubAllGlobals();
  });

  it('subscribed when granted and an active subscription exists', async () => {
    stubPushManagerGlobal(true);
    defineNav({
      serviceWorker: {
        ready: Promise.resolve({
          pushManager: { getSubscription: vi.fn().mockResolvedValue({ endpoint: 'https://x' }) },
        }),
      },
    });
    vi.stubGlobal('Notification', { permission: 'granted' });
    expect(await getPushState()).toBe('subscribed');
    vi.unstubAllGlobals();
  });

  it('off when granted but no subscription exists', async () => {
    stubPushManagerGlobal(true);
    defineNav({
      serviceWorker: {
        ready: Promise.resolve({
          pushManager: { getSubscription: vi.fn().mockResolvedValue(null) },
        }),
      },
    });
    vi.stubGlobal('Notification', { permission: 'granted' });
    expect(await getPushState()).toBe('off');
    vi.unstubAllGlobals();
  });
});

describe('subscribeToPush', () => {
  beforeEach(() => {
    apiMock.mockReset();
  });

  afterEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (window as any).Notification;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (window.navigator as any).serviceWorker;
    stubPushManagerGlobal(false);
    vi.unstubAllGlobals();
  });

  it('returns false when unsupported (no PushManager)', async () => {
    stubPushManagerGlobal(false);
    expect(await subscribeToPush()).toBe(false);
    expect(apiMock).not.toHaveBeenCalled();
  });

  it('returns false when permission is denied — never throws', async () => {
    stubPushManagerGlobal(true);
    defineNav({ serviceWorker: {} });
    vi.stubGlobal('Notification', { requestPermission: vi.fn().mockResolvedValue('denied') });
    await expect(subscribeToPush()).resolves.toBe(false);
    expect(apiMock).not.toHaveBeenCalled();
  });

  it('subscribes and posts the subscription on success', async () => {
    stubPushManagerGlobal(true);
    const subscribeFn = vi.fn().mockResolvedValue({
      endpoint: 'https://push.example/abc',
      toJSON: () => ({ keys: { p256dh: 'p256', auth: 'auth-key' } }),
    });
    defineNav({
      serviceWorker: {
        ready: Promise.resolve({ pushManager: { subscribe: subscribeFn } }),
      },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    });
    vi.stubGlobal('Notification', { requestPermission: vi.fn().mockResolvedValue('granted') });
    apiMock.mockResolvedValueOnce({ publicKey: 'SGVsbG8gd29ybGQ' }).mockResolvedValueOnce({ ok: true });

    const result = await subscribeToPush('desktop');

    expect(result).toBe(true);
    expect(apiMock).toHaveBeenNthCalledWith(1, '/guest/push/config');
    const [path, init] = apiMock.mock.calls[1];
    expect(path).toBe('/guest/push/subscriptions');
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body).toEqual({
      endpoint: 'https://push.example/abc',
      keys: { p256dh: 'p256', auth: 'auth-key' },
      deviceHint: 'desktop',
    });
  });

  it('returns false (never throws) when the API call fails', async () => {
    stubPushManagerGlobal(true);
    const subscribeFn = vi.fn().mockResolvedValue({
      endpoint: 'https://push.example/abc',
      toJSON: () => ({ keys: { p256dh: 'p256', auth: 'auth-key' } }),
    });
    defineNav({
      serviceWorker: {
        ready: Promise.resolve({ pushManager: { subscribe: subscribeFn } }),
      },
    });
    vi.stubGlobal('Notification', { requestPermission: vi.fn().mockResolvedValue('granted') });
    apiMock.mockRejectedValueOnce(new Error('network down'));

    await expect(subscribeToPush()).resolves.toBe(false);
  });
});

describe('unsubscribeFromPush', () => {
  beforeEach(() => apiMock.mockReset());

  afterEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (window.navigator as any).serviceWorker;
    stubPushManagerGlobal(false);
  });

  it('is a no-op when there is no active subscription', async () => {
    stubPushManagerGlobal(true);
    defineNav({
      serviceWorker: {
        ready: Promise.resolve({ pushManager: { getSubscription: vi.fn().mockResolvedValue(null) } }),
      },
    });
    await unsubscribeFromPush();
    expect(apiMock).not.toHaveBeenCalled();
  });

  it('unsubscribes locally then best-effort posts to the server', async () => {
    stubPushManagerGlobal(true);
    const unsubscribeFn = vi.fn().mockResolvedValue(true);
    defineNav({
      serviceWorker: {
        ready: Promise.resolve({
          pushManager: {
            getSubscription: vi
              .fn()
              .mockResolvedValue({ endpoint: 'https://push.example/xyz', unsubscribe: unsubscribeFn }),
          },
        }),
      },
    });
    apiMock.mockResolvedValueOnce({ ok: true });

    await unsubscribeFromPush();

    expect(unsubscribeFn).toHaveBeenCalled();
    expect(apiMock).toHaveBeenCalledWith(
      '/guest/push/unsubscribe',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ endpoint: 'https://push.example/xyz' }) }),
    );
  });

  it('swallows a failed best-effort POST — the server prunes dead endpoints anyway', async () => {
    stubPushManagerGlobal(true);
    const unsubscribeFn = vi.fn().mockResolvedValue(true);
    defineNav({
      serviceWorker: {
        ready: Promise.resolve({
          pushManager: {
            getSubscription: vi
              .fn()
              .mockResolvedValue({ endpoint: 'https://push.example/xyz', unsubscribe: unsubscribeFn }),
          },
        }),
      },
    });
    apiMock.mockRejectedValueOnce(new Error('network down'));

    await expect(unsubscribeFromPush()).resolves.toBeUndefined();
    expect(unsubscribeFn).toHaveBeenCalled();
  });
});
