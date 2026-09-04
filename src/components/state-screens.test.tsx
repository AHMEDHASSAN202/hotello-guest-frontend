import { act, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import en from '../../messages/en';
import {
  GenericErrorScreen,
  GoodbyeScreen,
  HotelNotFoundScreen,
  RateLimitedScreen,
  UnavailableScreen,
} from './state-screens';

function wrap(ui: ReactNode) {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      {ui}
    </NextIntlClientProvider>,
  );
}

describe('state screens (14.6)', () => {
  it('AC2 — tone rule: no internal vocabulary reaches guests', () => {
    const { container } = wrap(
      <>
        <UnavailableScreen hotelName="Sunrise" />
        <GoodbyeScreen />
        <HotelNotFoundScreen />
      </>,
    );
    const text = (container.textContent ?? '').toLowerCase();
    for (const forbidden of ['subscription', 'trial', 'tenant', 'session', '401', 'expired', 'suspended']) {
      expect(text).not.toContain(forbidden);
    }
  });

  it('unavailable screen shows the front-desk pointer and the hotel name', () => {
    wrap(<UnavailableScreen hotelName="Sunrise" />);
    expect(screen.getByText('Sunrise')).toBeTruthy();
    expect(screen.getByText('Contact the front desk')).toBeTruthy();
    expect(
      screen.getByText('This service is currently unavailable. Please contact the front desk.'),
    ).toBeTruthy();
  });

  it('goodbye renders the entry form beneath the warm message', () => {
    wrap(
      <GoodbyeScreen>
        <form aria-label="entry" />
      </GoodbyeScreen>,
    );
    expect(screen.getByText('This stay has ended')).toBeTruthy();
    expect(screen.getByRole('form', { name: 'entry' })).toBeTruthy();
  });

  it('Epic 23, Task 13 (23.2 AC4) — pushStopped omitted/false renders no push note', () => {
    wrap(<GoodbyeScreen />);
    expect(
      screen.queryByText('Notifications for this stay have stopped automatically'),
    ).toBeNull();
  });

  it('Epic 23, Task 13 (23.2 AC4) — pushStopped=true renders the push note', () => {
    wrap(<GoodbyeScreen pushStopped />);
    expect(
      screen.getByText('Notifications for this stay have stopped automatically'),
    ).toBeTruthy();
  });

  it('generic error exposes a working retry', () => {
    const onRetry = vi.fn();
    wrap(<GenericErrorScreen onRetry={onRetry} />);
    screen.getByRole('button', { name: 'Try again' }).click();
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  describe('rate-limited countdown', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it('ticks down live and fires onExpired at zero', () => {
      const onExpired = vi.fn();
      wrap(<RateLimitedScreen retryAfterSeconds={3} onExpired={onExpired} />);
      expect(screen.getByRole('timer').textContent).toBe('00:03');

      act(() => vi.advanceTimersByTime(1000));
      expect(screen.getByRole('timer').textContent).toBe('00:02');

      act(() => vi.advanceTimersByTime(2000));
      expect(screen.getByRole('timer').textContent).toBe('00:00');
      expect(onExpired).toHaveBeenCalled();
    });
  });
});
