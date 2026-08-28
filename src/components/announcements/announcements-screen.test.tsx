import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import en from '../../../messages/en';
import ru from '../../../messages/ru';
import { ApiError } from '@/lib/api';
import type { GuestAnnouncement, GuestHotelProfile, GuestProfile } from '@/lib/types';
import { HotelProvider } from '../hotel-provider';
import { AnnouncementsScreen, type AnnouncementsFeedHandle } from './announcements-screen';

const routerRefresh = vi.hoisted(() => vi.fn());
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: routerRefresh }),
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
  enabledModules: ['announcements'],
  hotelInfoHasContent: true,
  coverImageUrl: null,
  welcomeMessage: null,
};

const profile = {
  guestName: 'Dmitry',
  roomNumber: '304',
  hotelNameEn: 'Sunrise',
  hotelNameAr: 'شروق',
  slug: 'sunrise',
  language: 'ru',
  checkOutDate: '2030-01-01',
  stayType: 'all_inclusive',
  stayId: 'stay-1',
} as GuestProfile;

const make = (o: Partial<GuestAnnouncement> = {}): GuestAnnouncement => ({
  id: 'ann-1',
  title: 'Pool closed tomorrow',
  body: 'Maintenance from 9 to 12.\n\nSorry for the inconvenience.',
  priority: false,
  infoChip: null,
  publishedAt: '2026-01-15T09:00:00.000Z',
  readAt: null,
  active: true,
  ...o,
});

function makeFeed(over: Partial<AnnouncementsFeedHandle> = {}): AnnouncementsFeedHandle {
  return {
    announcements: [],
    unreadCount: 0,
    error: null,
    refresh: vi.fn(),
    markRead: vi.fn(),
    ...over,
  };
}

function wrap(ui: ReactNode, locale = 'en', messages: typeof en = en) {
  return render(
    <NextIntlClientProvider locale={locale} messages={messages} timeZone="Africa/Cairo">
      <HotelProvider hotel={hotel}>{ui}</HotelProvider>
    </NextIntlClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  routerRefresh.mockClear();
});

describe('AnnouncementsScreen (19.4 AC2)', () => {
  it('renders the inbox with priority chip and unread styling', () => {
    const feed = makeFeed({
      announcements: [
        make({ id: 'p1', priority: true, title: 'Beach bar closes early' }),
        make({ id: 'n1', readAt: '2026-01-15T10:00:00.000Z' }),
      ],
      unreadCount: 1,
    });
    wrap(
      <AnnouncementsScreen feed={feed} profile={profile} onBack={vi.fn()} onOpenInfo={vi.fn()} />,
    );
    expect(screen.getByText('Beach bar closes early')).toBeTruthy();
    expect(screen.getByText('Important')).toBeTruthy();
    // Unread row carries the dot; the read row does not.
    expect(screen.getByTestId('unread-dot-p1')).toBeTruthy();
    expect(screen.queryByTestId('unread-dot-n1')).toBeNull();
  });

  it('opening an item marks it read and shows the detail sheet; the info chip deep-links', () => {
    const chip = { entryId: 'entry-1', section: 'facilities', name: 'Бассейн' };
    const feed = makeFeed({
      announcements: [make({ id: 'a1', infoChip: chip })],
      unreadCount: 1,
    });
    const onOpenInfo = vi.fn();
    wrap(
      <AnnouncementsScreen feed={feed} profile={profile} onBack={vi.fn()} onOpenInfo={onOpenInfo} />,
    );
    fireEvent.click(screen.getByText('Pool closed tomorrow'));
    expect(feed.markRead).toHaveBeenCalledWith('a1');
    expect(screen.getByTestId('bottom-sheet')).toBeTruthy();
    expect(screen.getByText('Sorry for the inconvenience.')).toBeTruthy();
    // The Hotel Info chip carries the entry name and fires the deep link.
    fireEvent.click(screen.getByText(/Бассейн/));
    expect(onOpenInfo).toHaveBeenCalledWith(chip);
  });

  it('warm empty state in English and Russian', () => {
    wrap(
      <AnnouncementsScreen feed={makeFeed()} profile={profile} onBack={vi.fn()} onOpenInfo={vi.fn()} />,
    );
    expect(screen.getByText('Nothing new right now')).toBeTruthy();
    cleanup();
    wrap(
      <AnnouncementsScreen feed={makeFeed()} profile={profile} onBack={vi.fn()} onOpenInfo={vi.fn()} />,
      'ru',
      ru as unknown as typeof en,
    );
    expect(screen.getByText('Пока ничего нового')).toBeTruthy();
  });

  it('module death mid-stay shows the warm screen and refreshes the server layout once', () => {
    const feed = makeFeed({
      error: new ApiError(403, 'nope', { code: 'MODULE_NOT_ENABLED' }),
    });
    wrap(
      <AnnouncementsScreen feed={feed} profile={profile} onBack={vi.fn()} onOpenInfo={vi.fn()} />,
    );
    expect(screen.getByText('Announcements are taking a break')).toBeTruthy();
    expect(routerRefresh).toHaveBeenCalledTimes(1);
  });

  it('back button returns home', () => {
    const onBack = vi.fn();
    wrap(
      <AnnouncementsScreen feed={makeFeed()} profile={profile} onBack={onBack} onOpenInfo={vi.fn()} />,
    );
    fireEvent.click(screen.getByTestId('announcements-back'));
    expect(onBack).toHaveBeenCalled();
  });

  it('never leaks internal vocabulary to guests', () => {
    const { container } = wrap(
      <AnnouncementsScreen
        feed={makeFeed({ announcements: [make()] })}
        profile={profile}
        onBack={vi.fn()}
        onOpenInfo={vi.fn()}
      />,
    );
    const text = container.textContent?.toLowerCase() ?? '';
    for (const forbidden of ['subscription', 'trial', 'tenant', 'session', '401', 'expired', 'suspended']) {
      expect(text).not.toContain(forbidden);
    }
  });
});
