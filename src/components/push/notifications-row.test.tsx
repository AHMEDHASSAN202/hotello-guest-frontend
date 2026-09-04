import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import en from '../../../messages/en';
import type { PushUiState } from '@/lib/push';

/**
 * Epic 23, Task 13 (23.2 AC3) — the settings row: current push state + a
 * control that matches it. `@/lib/push` is mocked module-level (same
 * convention as push-prompt-sheet.test.tsx) so these tests control state
 * without touching real browser APIs (jsdom has neither Notification nor
 * the Push API). Rendered inside a real `PushPromptProvider` (not a mocked
 * context) so the "enable" button's bypass of the shown-twice cap is
 * exercised end-to-end, not merely asserted against a mock.
 */
const pushLib = vi.hoisted(() => {
  const shown = new Set<string>();
  return {
    shown,
    getPushState: vi.fn(async () => 'off' as PushUiState),
    subscribeToPush: vi.fn(async () => true),
    unsubscribeFromPush: vi.fn(async () => {}),
    isIosSafariBrowser: vi.fn(() => false),
    shouldPrompt: vi.fn(
      (_stayId: string, moment: string) => !shown.has(moment) && shown.size < 2,
    ),
    recordShown: vi.fn((_stayId: string, moment: string) => {
      shown.add(moment);
    }),
  };
});

vi.mock('@/lib/push', () => ({
  getPushState: pushLib.getPushState,
  subscribeToPush: pushLib.subscribeToPush,
  unsubscribeFromPush: pushLib.unsubscribeFromPush,
  isIosSafariBrowser: pushLib.isIosSafariBrowser,
  pushPromptStore: {
    shouldPrompt: pushLib.shouldPrompt,
    recordShown: pushLib.recordShown,
  },
}));

import { NotificationsRow } from './notifications-row';
import { PushPromptProvider } from './push-prompt-context';

function wrap(stayId = 'stay-1') {
  return render(
    <NextIntlClientProvider locale="en" messages={en} timeZone="Africa/Cairo">
      <PushPromptProvider stayId={stayId}>
        <NotificationsRow />
      </PushPromptProvider>
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  pushLib.shown.clear();
  vi.clearAllMocks();
  // Restore the default implementations clearAllMocks() wipes call state
  // for, but re-arm the actual behavior since these are shared vi.fn()s.
  pushLib.getPushState.mockImplementation(async () => 'off' as PushUiState);
  pushLib.subscribeToPush.mockImplementation(async () => true);
  pushLib.unsubscribeFromPush.mockImplementation(async () => {});
  pushLib.isIosSafariBrowser.mockImplementation(() => false);
  pushLib.shouldPrompt.mockImplementation(
    (_stayId: string, moment: string) =>
      !pushLib.shown.has(moment) && pushLib.shown.size < 2,
  );
  pushLib.recordShown.mockImplementation((_stayId: string, moment: string) => {
    pushLib.shown.add(moment);
  });
});

describe('NotificationsRow (Epic 23, Task 13, 23.2 AC3)', () => {
  it('subscribed → switch checked + "On" status', async () => {
    pushLib.getPushState.mockResolvedValue('subscribed');
    wrap();
    const sw = await screen.findByTestId('notifications-switch');
    expect(sw.getAttribute('aria-checked')).toBe('true');
    expect(screen.getByText('On')).toBeTruthy();
  });

  it('off → switch unchecked + "Off" status', async () => {
    pushLib.getPushState.mockResolvedValue('off');
    wrap();
    const sw = await screen.findByTestId('notifications-switch');
    expect(sw.getAttribute('aria-checked')).toBe('false');
    expect(screen.getByText('Off')).toBeTruthy();
  });

  it('blocked → fix-it text, no switch, no enable button', async () => {
    pushLib.getPushState.mockResolvedValue('blocked');
    wrap();
    await screen.findByText(
      "Blocked by your browser — enable it in your browser's site settings",
    );
    expect(screen.queryByTestId('notifications-switch')).toBeNull();
    expect(screen.queryByTestId('notifications-enable')).toBeNull();
  });

  it('unsupported → explanatory text, no switch, no enable button', async () => {
    pushLib.getPushState.mockResolvedValue('unsupported');
    wrap();
    await screen.findByText('Not available on this browser');
    expect(screen.queryByTestId('notifications-switch')).toBeNull();
    expect(screen.queryByTestId('notifications-enable')).toBeNull();
  });

  it('promptable → an enable button, no switch', async () => {
    pushLib.getPushState.mockResolvedValue('promptable');
    wrap();
    expect(await screen.findByTestId('notifications-enable')).toBeTruthy();
    expect(screen.queryByTestId('notifications-switch')).toBeNull();
  });

  it('toggling off calls unsubscribeFromPush', async () => {
    pushLib.getPushState.mockResolvedValue('subscribed');
    wrap();
    const sw = await screen.findByTestId('notifications-switch');
    fireEvent.click(sw);
    await waitFor(() =>
      expect(pushLib.unsubscribeFromPush).toHaveBeenCalledTimes(1),
    );
  });

  it('toggling on (from off, permission already granted) calls subscribeToPush', async () => {
    pushLib.getPushState.mockResolvedValue('off');
    wrap();
    const sw = await screen.findByTestId('notifications-switch');
    fireEvent.click(sw);
    await waitFor(() =>
      expect(pushLib.subscribeToPush).toHaveBeenCalledTimes(1),
    );
  });

  it('the switch disables while a toggle is in flight (no double taps)', async () => {
    let resolveUnsub: () => void = () => {};
    pushLib.unsubscribeFromPush.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveUnsub = resolve;
        }),
    );
    pushLib.getPushState.mockResolvedValue('subscribed');
    wrap();
    const sw = (await screen.findByTestId(
      'notifications-switch',
    )) as HTMLButtonElement;
    fireEvent.click(sw);
    await waitFor(() => expect(sw.disabled).toBe(true));
    resolveUnsub();
    await waitFor(() => expect(sw.disabled).toBe(false));
  });

  describe('promptable "enable" bypasses the per-stay shown-twice cap', () => {
    it('opens the sheet even after 2 prior declines this stay — the gate is never consulted', async () => {
      pushLib.shown.add('post_request');
      pushLib.shown.add('post_order');
      pushLib.getPushState.mockResolvedValue('promptable');
      wrap();
      const btn = await screen.findByTestId('notifications-enable');
      fireEvent.click(btn);
      expect(await screen.findByTestId('push-prompt-standard')).toBeTruthy();
      // A gated maybePrompt() call would have consulted shouldPrompt (and
      // been refused, since both slots are used) — the settings-initiated
      // path must skip that check entirely, not merely happen to pass it.
      expect(pushLib.shouldPrompt).not.toHaveBeenCalled();
      expect(pushLib.recordShown).not.toHaveBeenCalled();
    });

    it('after a successful settings-initiated enable, the row reflects "subscribed" once the sheet closes — no unmount/remount needed', async () => {
      pushLib.getPushState.mockResolvedValue('promptable');
      wrap();
      const btn = await screen.findByTestId('notifications-enable');
      fireEvent.click(btn);
      expect(await screen.findByTestId('push-prompt-standard')).toBeTruthy();

      // The guest just granted permission in the browser dialog — from here
      // on, getPushState() reflects a live subscription. subscribeToPush()
      // is already mocked to resolve true (the sheet's own success path).
      pushLib.getPushState.mockResolvedValue('subscribed');
      fireEvent.click(
        screen.getByRole('button', { name: 'Turn on notifications' }),
      );

      await waitFor(() =>
        expect(screen.queryByTestId('push-prompt-standard')).toBeNull(),
      );
      // No remount happened — this is the same NotificationsRow instance
      // picking up the new state via the sheet's onClosed callback.
      const sw = await screen.findByTestId('notifications-switch');
      expect(sw.getAttribute('aria-checked')).toBe('true');
      expect(screen.queryByTestId('notifications-enable')).toBeNull();
    });
  });
});
