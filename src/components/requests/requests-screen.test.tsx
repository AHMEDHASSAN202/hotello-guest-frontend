import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import en from '../../../messages/en';
import ru from '../../../messages/ru';
import { ApiError } from '@/lib/api';
import type {
  GuestCatalogCategory,
  GuestHotelProfile,
  GuestProfile,
  GuestRequest,
} from '@/lib/types';
import { HotelProvider } from '../hotel-provider';
import { RequestsScreen } from './requests-screen';

const { apiMock, routerRefresh } = vi.hoisted(() => ({
  apiMock: vi.fn(),
  routerRefresh: vi.fn(),
}));

vi.mock('@/lib/api', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/api')>();
  return { ...original, api: apiMock };
});
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
  defaultLanguage: 'en',
  enabledModules: ['requests'],
};

const profile: GuestProfile = {
  guestName: 'Ivan',
  roomNumber: '204',
  hotelNameEn: 'Sunrise',
  hotelNameAr: 'شروق',
  slug: 'sunrise',
  language: 'en',
  checkOutDate: '2026-08-30',
};

const catalog: { categories: GuestCatalogCategory[] } = {
  categories: [
    {
      id: 'cat-hk',
      name: 'Housekeeping',
      icon: 'sparkles',
      items: [
        {
          id: 'item-towels',
          name: 'Extra towels',
          description: 'Fresh towels brought to your room',
          icon: 'layers',
          optionType: 'quantity',
          optionMin: 1,
          optionMax: 4,
        },
        {
          id: 'item-clean',
          name: 'Room cleaning',
          description: null,
          icon: 'sparkles',
          optionType: null,
          optionMin: null,
          optionMax: null,
        },
      ],
    },
  ],
};

function makeRequest(overrides: Partial<GuestRequest> = {}): GuestRequest {
  return {
    id: 'req-1',
    itemName: 'Extra towels',
    icon: 'layers',
    optionType: 'quantity',
    optionValue: '2',
    note: null,
    status: 'new',
    slaTargetMinutes: 20,
    createdAt: '2026-08-22T10:00:00.000Z',
    startedAt: null,
    completedAt: null,
    cancelledAt: null,
    cancelledReason: null,
    updatedAt: '2026-08-22T10:00:00.000Z',
    ...overrides,
  };
}

function stubApi({
  catalogResult = catalog,
  requests = [] as GuestRequest[],
  catalogError = null as ApiError | null,
}: {
  catalogResult?: { categories: GuestCatalogCategory[] };
  requests?: GuestRequest[];
  catalogError?: ApiError | null;
} = {}) {
  apiMock.mockImplementation(async (path: string, init?: RequestInit) => {
    if (path === '/guest/catalog') {
      if (catalogError) throw catalogError;
      return catalogResult;
    }
    if (path.startsWith('/guest/requests') && init?.method === 'POST') {
      return makeRequest({ id: 'req-new' });
    }
    if (path.startsWith('/guest/requests')) {
      return { data: requests, serverTime: '2026-08-22T12:00:00.000Z' };
    }
    throw new Error(`unmocked ${path}`);
  });
}

function wrap(ui: ReactNode, messages: typeof en = en, locale = 'en') {
  return render(
    <NextIntlClientProvider locale={locale} messages={messages}>
      <HotelProvider hotel={hotel}>{ui}</HotelProvider>
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  apiMock.mockReset();
  routerRefresh.mockClear();
});

describe('RequestsScreen (15.2)', () => {
  it('AC2 — renders categories and items from the catalog', async () => {
    stubApi();
    wrap(<RequestsScreen profile={profile} />);
    expect(await screen.findByText('Housekeeping')).toBeTruthy();
    expect(screen.getByText('Extra towels')).toBeTruthy();
    expect(screen.getByText('Room cleaning')).toBeTruthy();
  });

  it('AC3 — tap item → sheet with quantity stepper → submit → confirmation', async () => {
    stubApi();
    wrap(<RequestsScreen profile={profile} />);
    fireEvent.click(await screen.findByTestId('catalog-item-item-towels'));
    expect(screen.getByTestId('bottom-sheet')).toBeTruthy();
    expect(screen.getByText('How many?')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Send request' }));
    expect(await screen.findByText('Request sent!')).toBeTruthy();
    const post = apiMock.mock.calls.find((c) => c[1]?.method === 'POST');
    expect(post).toBeTruthy();
    expect(JSON.parse(post![1].body as string)).toEqual({
      itemId: 'item-towels',
      optionValue: '1',
    });
  });

  it('AC5 — the throttle error shows the friendly limit copy', async () => {
    stubApi();
    apiMock.mockImplementation(async (path: string, init?: RequestInit) => {
      if (path === '/guest/catalog') return catalog;
      if (init?.method === 'POST') {
        throw new ApiError(429, 'Too many', { code: 'REQUEST_LIMIT_OPEN' });
      }
      return { data: [], serverTime: 'now' };
    });
    wrap(<RequestsScreen profile={profile} />);
    fireEvent.click(await screen.findByTestId('catalog-item-item-clean'));
    fireEvent.click(screen.getByRole('button', { name: 'Send request' }));
    expect(
      await screen.findByText(/requests in progress/i),
    ).toBeTruthy();
  });

  it('AC6 — an all-disabled catalog lands on the warm front-desk screen', async () => {
    stubApi({ catalogResult: { categories: [] } });
    const { container } = wrap(<RequestsScreen profile={profile} />);
    expect(await screen.findByText('Nothing to order here yet')).toBeTruthy();
    expect(screen.getByText('Contact the front desk')).toBeTruthy();
    const text = (container.textContent ?? '').toLowerCase();
    for (const forbidden of ['subscription', 'trial', 'tenant', 'session', '401', 'expired', 'suspended']) {
      expect(text).not.toContain(forbidden);
    }
  });

  it('AC6 — module disabled mid-stay falls back to the soon state + profile refresh', async () => {
    stubApi({
      catalogError: new ApiError(403, 'no module', {
        code: 'MODULE_NOT_ENABLED',
      }),
    });
    const { container } = wrap(<RequestsScreen profile={profile} />);
    expect(await screen.findByText('Coming soon')).toBeTruthy();
    await waitFor(() => expect(routerRefresh).toHaveBeenCalledTimes(1));
    const text = (container.textContent ?? '').toLowerCase();
    for (const forbidden of ['subscription', 'trial', 'tenant', 'session', '401', 'expired', 'suspended']) {
      expect(text).not.toContain(forbidden);
    }
  });
});

describe('My requests (15.3)', () => {
  it('AC1 — active rows with status chips; finished ones collapse into history', async () => {
    stubApi({
      requests: [
        makeRequest(),
        makeRequest({ id: 'req-2', status: 'in_progress' }),
        makeRequest({ id: 'req-3', status: 'done' }),
      ],
    });
    wrap(<RequestsScreen profile={profile} />);
    fireEvent.click(await screen.findByRole('tab', { name: /My requests/ }));

    expect(await screen.findByTestId('request-row-req-1')).toBeTruthy();
    expect(screen.getByText('Received')).toBeTruthy();
    expect(screen.getByText('In progress')).toBeTruthy();
    // done row is behind the collapsed history disclosure
    expect(screen.queryByTestId('request-row-req-3')).toBeNull();
    fireEvent.click(screen.getByText('1 earlier request'));
    expect(screen.getByTestId('request-row-req-3')).toBeTruthy();
  });

  it('AC3 — cancel offered while `new` only', async () => {
    stubApi({ requests: [makeRequest()] });
    wrap(<RequestsScreen profile={profile} />);
    fireEvent.click(await screen.findByRole('tab', { name: /My requests/ }));
    fireEvent.click(await screen.findByTestId('request-row-req-1'));
    expect(screen.getByText('Cancel this request')).toBeTruthy();
  });

  it('AC3 — once started, cancel is replaced by the front-desk explanation', async () => {
    stubApi({
      requests: [
        makeRequest({
          status: 'in_progress',
          startedAt: '2026-08-22T10:10:00.000Z',
        }),
      ],
    });
    wrap(<RequestsScreen profile={profile} />);
    fireEvent.click(await screen.findByRole('tab', { name: /My requests/ }));
    fireEvent.click(await screen.findByTestId('request-row-req-1'));
    expect(screen.queryByText('Cancel this request')).toBeNull();
    expect(
      screen.getByText(/already started on this one/i),
    ).toBeTruthy();
  });

  it('AC4 — the Russian bundle renders the status chips', async () => {
    stubApi({ requests: [makeRequest({ status: 'in_progress' })] });
    wrap(
      <RequestsScreen profile={{ ...profile, language: 'ru' }} />,
      ru as typeof en,
      'ru',
    );
    fireEvent.click(await screen.findByRole('tab', { name: /Мои запросы/ }));
    expect(await screen.findByText('В работе')).toBeTruthy();
  });
});
