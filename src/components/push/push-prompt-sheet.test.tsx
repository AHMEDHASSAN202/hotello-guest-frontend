import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import en from '../../../messages/en';
import type { PromptMoment, PushUiState } from '@/lib/push';

/**
 * Epic 23, Task 12 (23.2 AC1/AC2) — the contextual pre-prompt sheet + iOS
 * A2HS guide. `@/lib/push` is mocked module-level so these tests control
 * push/permission state and platform detection without touching real
 * browser APIs (jsdom has neither Notification nor the Push API).
 */
const pushLib = vi.hoisted(() => {
  const shown = new Set<string>();
  return {
    shown,
    getPushState: vi.fn(async (): Promise<PushUiState> => 'promptable'),
    subscribeToPush: vi.fn(async () => true),
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
  isIosSafariBrowser: pushLib.isIosSafariBrowser,
  pushPromptStore: {
    shouldPrompt: pushLib.shouldPrompt,
    recordShown: pushLib.recordShown,
  },
}));

import { PushPromptSheet } from './push-prompt-sheet';
import { PushPromptProvider, usePushPrompt } from './push-prompt-context';

function wrapSheet(moment: PromptMoment = 'post_order') {
  const onClose = vi.fn();
  render(
    <NextIntlClientProvider locale="en" messages={en} timeZone="Africa/Cairo">
      <PushPromptSheet moment={moment} onClose={onClose} />
    </NextIntlClientProvider>,
  );
  return { onClose };
}

/** Fires `maybePrompt(moment)` on click — exercises the full provider path
 * (permission/state check + the per-stay shown-twice cap) the way
 * guest-flow.tsx / submit-sheet.tsx / checkout-sheet.tsx actually call it. */
function Harness({ moment }: { moment: PromptMoment }) {
  const { maybePrompt } = usePushPrompt();
  return (
    <button type="button" onClick={() => maybePrompt(moment)}>
      trigger
    </button>
  );
}

function wrapProvider(moment: PromptMoment = 'post_order', stayId = 'stay-1') {
  render(
    <NextIntlClientProvider locale="en" messages={en} timeZone="Africa/Cairo">
      <PushPromptProvider stayId={stayId}>
        <Harness moment={moment} />
      </PushPromptProvider>
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  pushLib.shown.clear();
  vi.clearAllMocks();
  // Restore the default implementations clearAllMocks() wipes call state
  // for, but re-arm the actual behavior since these are shared vi.fn()s.
  pushLib.getPushState.mockImplementation(async () => 'promptable' as const);
  pushLib.subscribeToPush.mockImplementation(async () => true);
  pushLib.isIosSafariBrowser.mockImplementation(() => false);
  pushLib.shouldPrompt.mockImplementation(
    (_stayId: string, moment: string) =>
      !pushLib.shown.has(moment) && pushLib.shown.size < 2,
  );
  pushLib.recordShown.mockImplementation((_stayId: string, moment: string) => {
    pushLib.shown.add(moment);
  });
});

describe('PushPromptSheet — standard branch (Android/desktop)', () => {
  it('renders the pre-prompt with enable + not-now actions, never the browser dialog cold', () => {
    wrapSheet('post_order');
    expect(screen.getByTestId('push-prompt-standard')).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Turn on notifications' }),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Not now' })).toBeTruthy();
    // Rendering the sheet alone must never itself request permission.
    expect(pushLib.subscribeToPush).not.toHaveBeenCalled();
  });

  it('shows the moment-specific copy (post_order vs post_request vs inbox_open)', () => {
    wrapSheet('post_request');
    expect(
      screen.getByText("Want to know the moment your request is ready? 🔔"),
    ).toBeTruthy();
  });

  it('enable calls subscribeToPush and closes on success', async () => {
    const { onClose } = wrapSheet('post_order');
    fireEvent.click(screen.getByRole('button', { name: 'Turn on notifications' }));
    await waitFor(() => expect(pushLib.subscribeToPush).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it('not-now closes without ever calling subscribeToPush', () => {
    const { onClose } = wrapSheet('post_order');
    fireEvent.click(screen.getByRole('button', { name: 'Not now' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(pushLib.subscribeToPush).not.toHaveBeenCalled();
  });
});

describe('PushPromptSheet — iOS Safari (not installed) shows the A2HS guide', () => {
  it('shows the two-step guide instead of the enable button', () => {
    pushLib.isIosSafariBrowser.mockReturnValue(true);
    wrapSheet('post_order');
    expect(screen.getByTestId('push-prompt-ios-guide')).toBeTruthy();
    expect(screen.getByText('Two steps to turn on notifications')).toBeTruthy();
    expect(screen.getByText('Add the app to your Home Screen')).toBeTruthy();
    expect(screen.getByText('Open the app from its new icon')).toBeTruthy();
    // Not the standard branch — no "enable" button that could fire a cold
    // permission prompt (the iOS Notification API isn't even usable yet).
    expect(screen.queryByTestId('push-prompt-standard')).toBeNull();
    expect(
      screen.queryByRole('button', { name: 'Turn on notifications' }),
    ).toBeNull();
    expect(pushLib.subscribeToPush).not.toHaveBeenCalled();
  });

  it('"Got it" closes the guide without calling subscribeToPush', () => {
    pushLib.isIosSafariBrowser.mockReturnValue(true);
    const { onClose } = wrapSheet('post_order');
    fireEvent.click(screen.getByRole('button', { name: 'Got it' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(pushLib.subscribeToPush).not.toHaveBeenCalled();
  });
});

describe('PushPromptProvider + usePushPrompt — the per-stay shown-twice cap (23.2 AC1)', () => {
  it('maybePrompt opens the sheet for a promptable state', async () => {
    wrapProvider('post_order');
    fireEvent.click(screen.getByText('trigger'));
    expect(await screen.findByTestId('push-prompt-standard')).toBeTruthy();
    expect(pushLib.recordShown).toHaveBeenCalledWith('stay-1', 'post_order');
  });

  it('declining records the moment and closes; the sheet does not reopen for the same moment', async () => {
    wrapProvider('post_order');
    fireEvent.click(screen.getByText('trigger'));
    await screen.findByTestId('push-prompt-standard');

    fireEvent.click(screen.getByRole('button', { name: 'Not now' }));
    await waitFor(() =>
      expect(screen.queryByTestId('push-prompt-standard')).toBeNull(),
    );

    // Same moment, triggered again — shouldPrompt now sees it in `shown`
    // and maybePrompt must not reopen anything.
    fireEvent.click(screen.getByText('trigger'));
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.queryByTestId('push-prompt-standard')).toBeNull();
  });

  it('does not prompt when push state is not "promptable" (e.g. already subscribed)', async () => {
    pushLib.getPushState.mockResolvedValue('subscribed');
    wrapProvider('post_order');
    fireEvent.click(screen.getByText('trigger'));
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.queryByTestId('push-prompt-standard')).toBeNull();
    expect(pushLib.recordShown).not.toHaveBeenCalled();
  });

  it('does not prompt once two moments have already been shown this stay', async () => {
    pushLib.shown.add('post_request');
    pushLib.shown.add('inbox_open');
    wrapProvider('post_order');
    fireEvent.click(screen.getByText('trigger'));
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.queryByTestId('push-prompt-standard')).toBeNull();
  });

  /**
   * FINAL-REVIEW FIX (23.2 AC2) — 'ios-install' is the real-device iOS path
   * (no Notification API yet, needs A2HS first). `maybePrompt` must treat it
   * the same as 'promptable': open the sheet (which then renders the guide,
   * since `isIosSafariBrowser()` agrees with the state in reality) and count
   * it against the per-stay shown-twice cap, so an iOS guest isn't shown the
   * install guide a third time either.
   */
  it("maybePrompt opens the sheet for 'ios-install' and records the moment", async () => {
    pushLib.getPushState.mockResolvedValue('ios-install');
    pushLib.isIosSafariBrowser.mockReturnValue(true);
    wrapProvider('post_order');
    fireEvent.click(screen.getByText('trigger'));
    expect(await screen.findByTestId('push-prompt-ios-guide')).toBeTruthy();
    expect(pushLib.recordShown).toHaveBeenCalledWith('stay-1', 'post_order');
  });

  it("does not prompt a third time for 'ios-install' once two moments have already been shown this stay", async () => {
    pushLib.getPushState.mockResolvedValue('ios-install');
    pushLib.isIosSafariBrowser.mockReturnValue(true);
    pushLib.shown.add('post_request');
    pushLib.shown.add('inbox_open');
    wrapProvider('post_order');
    fireEvent.click(screen.getByText('trigger'));
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.queryByTestId('push-prompt-ios-guide')).toBeNull();
  });
});
