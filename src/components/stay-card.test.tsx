import { fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import en from '../../messages/en';
import { todayInTimezone } from '@/i18n/format';
import type { GuestHotelProfile, GuestProfile } from '@/lib/types';
import { HotelProvider } from './hotel-provider';
import { StayCard, type StayCardDnd } from './stay-card';

const baseHotel: GuestHotelProfile = {
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
  enabledModules: ['requests', 'housekeeping'],
  hotelInfoHasContent: true,
  coverImageUrl: null,
  welcomeMessage: null,
};

const futureDate = (days: number) => {
  const [y, m, d] = todayInTimezone('Africa/Cairo').split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
};

const profile: GuestProfile = {
  guestName: 'Dmitry',
  roomNumber: '304',
  hotelNameEn: 'Sunrise',
  hotelNameAr: 'شروق',
  slug: 'sunrise',
  language: 'ru',
  checkOutDate: futureDate(3),
  stayType: 'all_inclusive',
  stayId: 'stay-1',
};

function wrap(ui: ReactNode, hotel = baseHotel, locale = 'en', messages: typeof en = en) {
  return render(
    <NextIntlClientProvider locale={locale} messages={messages}>
      <HotelProvider hotel={hotel}>{ui}</HotelProvider>
    </NextIntlClientProvider>,
  );
}

const dnd = (over: Partial<StayCardDnd> = {}): StayCardDnd => ({
  active: false,
  busy: false,
  onToggle: vi.fn(),
  ...over,
});

describe('StayCard DND row (Epic 20, 20.4)', () => {
  it('AC1 — renders the row (label + explainer + switch) when the prop is given', () => {
    wrap(<StayCard profile={profile} dnd={dnd()} />);
    expect(screen.getByText('Do not disturb today')).toBeTruthy();
    expect(screen.getByText('Housekeeping will skip your room today')).toBeTruthy();
    expect(screen.getByTestId('dnd-switch')).toBeTruthy();
  });

  it('module off (null/absent prop) → no row at all', () => {
    wrap(<StayCard profile={profile} dnd={null} />);
    expect(screen.queryByTestId('dnd-switch')).toBeNull();
    expect(screen.queryByText('Do not disturb today')).toBeNull();
  });

  it('the switch reflects the active state via aria-checked', () => {
    wrap(<StayCard profile={profile} dnd={dnd({ active: true })} />);
    expect(screen.getByTestId('dnd-switch').getAttribute('aria-checked')).toBe('true');
  });

  it('off state reads aria-checked=false', () => {
    wrap(<StayCard profile={profile} dnd={dnd()} />);
    expect(screen.getByTestId('dnd-switch').getAttribute('aria-checked')).toBe('false');
  });

  it('toggling calls onToggle with the flipped value (off → true, on → false)', () => {
    const onToggle = vi.fn();
    const view = wrap(<StayCard profile={profile} dnd={dnd({ onToggle })} />);
    fireEvent.click(screen.getByTestId('dnd-switch'));
    expect(onToggle).toHaveBeenCalledWith(true);
    view.unmount();

    const onToggleBack = vi.fn();
    wrap(<StayCard profile={profile} dnd={dnd({ active: true, onToggle: onToggleBack })} />);
    fireEvent.click(screen.getByTestId('dnd-switch'));
    expect(onToggleBack).toHaveBeenCalledWith(false);
  });

  it('busy disables the switch — no double taps', () => {
    const onToggle = vi.fn();
    wrap(<StayCard profile={profile} dnd={dnd({ busy: true, onToggle })} />);
    const sw = screen.getByTestId('dnd-switch') as HTMLButtonElement;
    expect(sw.disabled).toBe(true);
    fireEvent.click(sw);
    expect(onToggle).not.toHaveBeenCalled();
  });

  it('AC3 — the reset note appears only while DND is active', () => {
    const view = wrap(<StayCard profile={profile} dnd={dnd()} />);
    expect(screen.queryByText('Cleaning resumes automatically tomorrow')).toBeNull();
    view.unmount();

    wrap(<StayCard profile={profile} dnd={dnd({ active: true })} />);
    expect(screen.getByText('Cleaning resumes automatically tomorrow')).toBeTruthy();
  });

  it('AC4 — the cross-link renders only when onRequestCleaning is provided, and fires it', () => {
    const view = wrap(<StayCard profile={profile} dnd={dnd()} />);
    expect(screen.queryByTestId('dnd-cross-link')).toBeNull();
    view.unmount();

    const onRequestCleaning = vi.fn();
    wrap(<StayCard profile={profile} dnd={dnd({ onRequestCleaning })} />);
    const link = screen.getByTestId('dnd-cross-link');
    expect(link.textContent).toContain('Need cleaning now? Request it from services');
    fireEvent.click(link);
    expect(onRequestCleaning).toHaveBeenCalled();
  });
});
