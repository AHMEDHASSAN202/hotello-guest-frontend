'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import {
  getPushState,
  subscribeToPush,
  unsubscribeFromPush,
  type PushUiState,
} from '@/lib/push';
import { Skeleton, Switch } from '../ui';
import { usePushPrompt } from './push-prompt-context';

/** `PushUiState` → the `push.settings.*` status-line key for that state.
 * `promptable` reads "off" — permission simply hasn't been asked yet, which
 * is a kind of off the guest already understands; the "enable" button next
 * to it is what actually distinguishes it from a plain off toggle. */
const STATUS_KEY: Record<PushUiState, 'on' | 'off' | 'blocked' | 'unsupported'> = {
  subscribed: 'on',
  off: 'off',
  promptable: 'off',
  blocked: 'blocked',
  unsupported: 'unsupported',
};

/**
 * Epic 23, Task 13 (23.2 AC3) — the settings row: current push state and a
 * control that matches it. A fourth `stay-card.tsx` section, the exact
 * `mt-4 border-t border-line pt-4` visual/interaction pattern the DND row
 * (Epic 20) established — optimistic toggle, server echo on reconciliation.
 *
 * Unlike DND, push state isn't seeded from the guest profile — it lives in
 * the browser (Notification.permission + the push subscription), so it
 * loads asynchronously on mount (`getPushState()`) rather than deriving
 * synchronously from a prop. A skeleton fills the gap so the row never
 * flashes the wrong state (there is no "sensible default" among the five
 * states that would be safe to guess).
 *
 * `subscribed`/`off` render the Epic 20 `Switch` directly — toggling on from
 * `off` means permission is already granted, so `subscribeToPush()` can
 * (re)subscribe without ever showing a sheet. `blocked`/`unsupported` are
 * plain text with no control — nothing this UI can do fixes either.
 * `promptable` renders an "enable" button that opens the full pre-prompt
 * sheet via `openDirect` — bypassing the per-stay shown-twice cap
 * (`pushPromptStore`) entirely, because a guest who explicitly visits
 * settings and taps enable must always get the sheet, even if the
 * contextual pre-prompt already showed (and was declined) twice this stay.
 * `openDirect`'s `onClosed` callback re-fetches `getPushState()` once the
 * sheet closes, so a successful enable is reflected here immediately —
 * this component otherwise has no way to learn the sheet (owned by
 * `PushPromptProvider`, mounted well above `StayCard`) ever ran.
 */
export function NotificationsRow() {
  const t = useTranslations('push');
  const { openDirect } = usePushPrompt();
  const [state, setState] = useState<PushUiState | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void getPushState().then((next) => {
      if (!cancelled) setState(next);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function toggle(next: boolean) {
    if (busy) return;
    setBusy(true);
    setState(next ? 'subscribed' : 'off'); // optimistic — instant apply
    if (next) {
      const ok = await subscribeToPush();
      // Permission may have been revoked between renders (or the browser
      // otherwise refused) — reconcile with reality rather than trust the
      // optimistic flip.
      if (!ok) setState(await getPushState());
    } else {
      await unsubscribeFromPush();
    }
    setBusy(false);
  }

  if (state === null) {
    return (
      <div className="mt-4 border-t border-line pt-4">
        <Skeleton className="h-5 w-40" />
      </div>
    );
  }

  return (
    <div className="mt-4 border-t border-line pt-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[14px] font-semibold text-ink">{t('settings.label')}</p>
          <p className="mt-0.5 text-[12px] leading-relaxed text-ink-soft">
            {t(`settings.${STATUS_KEY[state]}`)}
          </p>
        </div>
        {state === 'subscribed' || state === 'off' ? (
          <Switch
            checked={state === 'subscribed'}
            onChange={(checked) => void toggle(checked)}
            disabled={busy}
            aria-label={t('settings.label')}
            data-testid="notifications-switch"
          />
        ) : state === 'promptable' ? (
          <button
            type="button"
            onClick={() =>
              openDirect('inbox_open', () => {
                // The sheet just closed — enabled, declined, or dismissed,
                // we can't tell which from here, so re-read the truth
                // rather than assume success. Without this the row would
                // go stale after a successful enable until an unrelated
                // remount (there may be no bottom nav to trigger one).
                void getPushState().then(setState);
              })
            }
            data-testid="notifications-enable"
            className="pressable inline-flex min-h-[44px] shrink-0 items-center rounded-full bg-accent-soft px-4 text-[13px] font-semibold text-accent"
          >
            {t('settings.enable')}
          </button>
        ) : null}
      </div>
    </div>
  );
}
