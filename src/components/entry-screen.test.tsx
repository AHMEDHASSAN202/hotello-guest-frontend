import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import en from '../../messages/en';
import { ApiError } from '@/lib/api';
import type { GuestHotelProfile } from '@/lib/types';
import { HotelProvider } from './hotel-provider';
import { EntryScreen } from './entry-screen';

const { apiMock } = vi.hoisted(() => ({ apiMock: vi.fn() }));
vi.mock('@/lib/api', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/api')>();
  return { ...original, api: apiMock };
});
vi.mock('@/i18n/locale', () => ({
  useSetLocale: () => ({ locale: 'en', setLocale: vi.fn(), pending: false }),
}));

const hotel: GuestHotelProfile = {
  slug: 'sunrise',
  nameEn: 'Sunrise',
  nameAr: 'شروق',
  logoUrl: null,
  status: 'active',
  brandAccentColor: null,
  checkoutTime: '12:00',
  timezone: 'Africa/Cairo',
  defaultLanguage: 'ar',
  currency: 'EGP',
  enabledModules: [],
};

function wrap(ui: ReactNode) {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <HotelProvider hotel={hotel}>{ui}</HotelProvider>
    </NextIntlClientProvider>,
  );
}

const codeInput = () => screen.getByLabelText('code-input') as HTMLInputElement;
const roomInput = () => screen.getByLabelText('Room number') as HTMLInputElement;

describe('EntryScreen (14.2 AC1/AC3)', () => {
  beforeEach(() => {
    apiMock.mockReset();
  });

  it('auto-submits the contract-exact body on the 6th digit', async () => {
    apiMock.mockResolvedValue({ accessToken: 't', profile: {} });
    const onEnter = vi.fn();
    wrap(<EntryScreen slug="sunrise" onEnter={onEnter} />);
    fireEvent.change(roomInput(), { target: { value: '304' } });
    fireEvent.change(codeInput(), { target: { value: '123456' } });
    await waitFor(() => expect(onEnter).toHaveBeenCalled());
    expect(apiMock).toHaveBeenCalledWith('/guest/sunrise/session', {
      method: 'POST',
      body: JSON.stringify({ roomNumber: '304', code: '123456' }),
    });
  });

  it('?room= locks the room: chip shown, no room field, code-only', () => {
    wrap(<EntryScreen slug="sunrise" initialRoom="304" roomLocked onEnter={() => {}} />);
    expect(screen.queryByLabelText('Room number')).toBeNull();
    expect(screen.getByText('304')).toBeTruthy();
    expect(codeInput()).toBeTruthy();
  });

  it('INVALID_CODE: message + shake, code cleared, room preserved, no navigation', async () => {
    apiMock.mockRejectedValue(new ApiError(401, 'Invalid room or code', { code: 'INVALID_CODE' }));
    wrap(<EntryScreen slug="sunrise" onEnter={() => {}} />);
    fireEvent.change(roomInput(), { target: { value: '304' } });
    fireEvent.change(codeInput(), { target: { value: '111111' } });
    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toBe(
        "The code doesn't match — check it with the front desk",
      ),
    );
    expect(codeInput().value).toBe('');
    expect(roomInput().value).toBe('304');
    expect(screen.getByTestId('code-boxes').className).toContain('animate-shake');
  });

  it('TOO_MANY_ATTEMPTS swaps to the lockout screen with the countdown', async () => {
    apiMock.mockRejectedValue(
      new ApiError(429, 'Too many attempts — try again later', {
        code: 'TOO_MANY_ATTEMPTS',
        retryAfterSeconds: 90,
      }),
    );
    wrap(<EntryScreen slug="sunrise" onEnter={() => {}} />);
    fireEvent.change(roomInput(), { target: { value: '304' } });
    fireEvent.change(codeInput(), { target: { value: '111111' } });
    await waitFor(() => expect(screen.getByRole('timer').textContent).toBe('01:30'));
  });

  it('HOTEL_UNAVAILABLE swaps to the guest-appropriate unavailable screen', async () => {
    apiMock.mockRejectedValue(new ApiError(403, 'unavailable', { code: 'HOTEL_UNAVAILABLE' }));
    wrap(<EntryScreen slug="sunrise" onEnter={() => {}} />);
    fireEvent.change(roomInput(), { target: { value: '304' } });
    fireEvent.change(codeInput(), { target: { value: '111111' } });
    await waitFor(() =>
      expect(
        screen.getByText('This service is currently unavailable. Please contact the front desk.'),
      ).toBeTruthy(),
    );
  });

  it('does not submit while the room is empty', () => {
    wrap(<EntryScreen slug="sunrise" onEnter={() => {}} />);
    fireEvent.change(codeInput(), { target: { value: '123456' } });
    expect(apiMock).not.toHaveBeenCalled();
  });
});
