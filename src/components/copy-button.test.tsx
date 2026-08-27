import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import en from '../../messages/en';
import { CopyButton } from './copy-button';

function renderButton() {
  return render(
    <NextIntlClientProvider locale="en" messages={en} timeZone="Africa/Cairo">
      <CopyButton value="sunrise2026" />
    </NextIntlClientProvider>,
  );
}

describe('CopyButton (17.2 AC2 — copy affordance)', () => {
  const writeText = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    // jsdom's navigator.clipboard is getter-only — install our own.
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });
    writeText.mockReset();
    writeText.mockResolvedValue(undefined);
  });

  it('writes the value and shows the copied beat, then reverts after 1500ms', async () => {
    renderButton();
    fireEvent.click(screen.getByRole('button'));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('sunrise2026'));
    expect(await screen.findByText(en.common.copied)).toBeTruthy();
    await waitFor(
      () => expect(screen.queryByText(en.common.copied)).toBeNull(),
      { timeout: 2500 },
    );
    expect(screen.getByText(en.common.copy)).toBeTruthy();
  });

  it('announces the beat politely (aria-live)', async () => {
    renderButton();
    fireEvent.click(screen.getByRole('button'));
    const live = await screen.findByText(en.common.copied);
    expect(live.getAttribute('aria-live')).toBe('polite');
  });

  it('stays quiet when the clipboard is unavailable', async () => {
    writeText.mockRejectedValueOnce(new Error('insecure'));
    renderButton();
    fireEvent.click(screen.getByRole('button'));
    await waitFor(() => expect(writeText).toHaveBeenCalled());
    expect(screen.queryByText(en.common.copied)).toBeNull();
  });
});
