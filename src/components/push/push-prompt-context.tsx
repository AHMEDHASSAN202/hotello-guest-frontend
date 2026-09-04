'use client';

import dynamic from 'next/dynamic';
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { getPushState, pushPromptStore, type PromptMoment } from '@/lib/push';

/**
 * Epic 23, Task 12 — the pre-prompt sheet's code (icons, iOS guide, its own
 * translations) must never land in the always-loaded `/[slug]` chunk, same
 * bundle-budget law `guest-flow.tsx` already applies to Dining/Announcements/
 * Events. `dynamic()` — not a static import — creates that chunk boundary
 * right here regardless of which file the call lives in; keeping it here
 * (rather than in guest-flow.tsx) lets this module stay the single owner of
 * the sheet's open/close state, which `maybePrompt` below needs whether it's
 * called from a nested sheet (via `usePushPrompt()`) or from guest-flow.tsx's
 * own inbox-open handler.
 */
const PushPromptSheet = dynamic(
  () => import('./push-prompt-sheet').then((m) => m.PushPromptSheet),
  { ssr: false },
);

interface PushPromptContextValue {
  /** Fire-and-forget: checks push state + the per-stay shown cap (23.2 AC1)
   * and opens the sheet only if both allow it. Never touches the raw
   * `Notification.requestPermission()` dialog itself — that only ever
   * happens if the guest taps "enable" inside the sheet. */
  maybePrompt: (moment: PromptMoment) => void;
  /** Task 13 (23.2 AC3) — opens the sheet immediately, bypassing the
   * per-stay shown-twice cap entirely (never reads or writes
   * `pushPromptStore`). For user-initiated entry points only (the settings
   * row's "enable" button): a guest who deliberately opens settings and
   * taps enable must always get the sheet, even if the contextual
   * pre-prompt already used up its two shows this stay. Unlike
   * `maybePrompt`, this does not re-check push state first — callers only
   * offer this action when they already know the state is `promptable`. */
  openDirect: (moment: PromptMoment) => void;
}

// Outside <PushPromptProvider> (e.g. SubmitSheet/CheckoutSheet rendered in
// isolation in their own component tests) maybePrompt is a safe no-op rather
// than a throw — this app has no chrome around every sheet consumer that
// guarantees the provider is mounted higher up.
const noopContext: PushPromptContextValue = {
  maybePrompt: () => {},
  openDirect: () => {},
};
const PushPromptContext = createContext<PushPromptContextValue>(noopContext);

export function usePushPrompt(): PushPromptContextValue {
  return useContext(PushPromptContext);
}

/**
 * Mounted once at the flow level (guest-flow.tsx, home phase). Owns "is a
 * sheet open, and for which moment" — `maybePrompt` re-validates on every
 * call (permission state can change mid-stay; the shown-twice cap is
 * permission-independent per Task 11's `pushPromptStore`).
 */
export function PushPromptProvider({
  stayId,
  children,
}: {
  stayId: string;
  children: ReactNode;
}) {
  const [moment, setMoment] = useState<PromptMoment | null>(null);

  const maybePrompt = useCallback(
    (target: PromptMoment) => {
      void (async () => {
        const state = await getPushState();
        if (state !== 'promptable') return;
        if (!pushPromptStore.shouldPrompt(stayId, target)) return;
        // Recorded before the sheet even opens (Task 11 bookkeeping is
        // permission-independent — a moment counts as "shown" whether the
        // guest ends up enabling, declining, or closing without choosing).
        pushPromptStore.recordShown(stayId, target);
        setMoment(target);
      })();
    },
    [stayId],
  );

  const openDirect = useCallback((target: PromptMoment) => {
    setMoment(target);
  }, []);

  const value = useMemo<PushPromptContextValue>(
    () => ({ maybePrompt, openDirect }),
    [maybePrompt, openDirect],
  );

  return (
    <PushPromptContext.Provider value={value}>
      {children}
      {moment ? (
        <PushPromptSheet
          moment={moment}
          onClose={() => setMoment(null)}
        />
      ) : null}
    </PushPromptContext.Provider>
  );
}
