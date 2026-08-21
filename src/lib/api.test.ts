import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const tokenStore = vi.hoisted(() => ({
  get: vi.fn((): string | null => 'guest-token'),
  set: vi.fn(),
  clear: vi.fn(),
}));
vi.mock('./auth', () => ({ tokenStore }));

import { api, ApiError, assetUrl, onSessionDeath } from './api';

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

describe('api() — guest client (14.2 AC4/AC5 plumbing)', () => {
  let deaths: number;
  let unsubscribe: () => void;

  beforeEach(() => {
    vi.clearAllMocks();
    tokenStore.get.mockReturnValue('guest-token');
    deaths = 0;
    unsubscribe = onSessionDeath(() => {
      deaths += 1;
    });
  });

  afterEach(() => unsubscribe());

  it('attaches the bearer token when present', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { guestName: 'Dmitry' }));
    await api('/guest/me');
    const [, init] = fetchMock.mock.calls[0];
    expect((init.headers as Record<string, string>).Authorization).toBe(
      'Bearer guest-token',
    );
  });

  it('sends no Authorization header without a token', async () => {
    tokenStore.get.mockReturnValue(null);
    fetchMock.mockResolvedValue(jsonResponse(200, {}));
    await api('/guest/sunrise/profile');
    const [, init] = fetchMock.mock.calls[0];
    expect((init.headers as Record<string, string>).Authorization).toBeUndefined();
  });

  it('401 mid-use (guest/me) = session death: clears token, notifies, SESSION_ENDED', async () => {
    fetchMock.mockResolvedValue(jsonResponse(401, { message: 'Unauthorized' }));
    await expect(api('/guest/me')).rejects.toMatchObject({
      status: 401,
      code: 'SESSION_ENDED',
    });
    expect(tokenStore.clear).toHaveBeenCalled();
    expect(deaths).toBe(1);
  });

  it('401 from the session endpoint is a business error — never session death', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(401, { code: 'INVALID_CODE', message: 'Invalid room or code' }),
    );
    await expect(api('/guest/sunrise/session', { method: 'POST' })).rejects.toMatchObject(
      { status: 401, code: 'INVALID_CODE' },
    );
    expect(tokenStore.clear).not.toHaveBeenCalled();
    expect(deaths).toBe(0);
  });

  it('parses the layered limiter 429 body (code + retryAfterSeconds)', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(429, {
        code: 'TOO_MANY_ATTEMPTS',
        message: 'Too many attempts — try again later',
        retryAfterSeconds: 720,
      }),
    );
    await expect(api('/guest/sunrise/session', { method: 'POST' })).rejects.toMatchObject(
      { status: 429, code: 'TOO_MANY_ATTEMPTS', retryAfterSeconds: 720 },
    );
  });

  it("normalizes Nest's coarse ThrottlerException 429 (no code, no retryAfterSeconds)", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(429, {
        statusCode: 429,
        message: 'ThrottlerException: Too many requests',
      }),
    );
    await expect(api('/guest/sunrise/session', { method: 'POST' })).rejects.toMatchObject(
      { status: 429, code: 'TOO_MANY_ATTEMPTS', retryAfterSeconds: 60 },
    );
  });

  it('surfaces stable error codes (HOTEL_UNAVAILABLE)', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(403, { code: 'HOTEL_UNAVAILABLE', message: 'unavailable' }),
    );
    await expect(api('/guest/sunrise/session', { method: 'POST' })).rejects.toMatchObject(
      { status: 403, code: 'HOTEL_UNAVAILABLE' },
    );
  });

  it('joins NestJS validation message arrays', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(400, { message: ['roomNumber should not be empty', 'Code must be six digits'] }),
    );
    await expect(api('/guest/sunrise/session', { method: 'POST' })).rejects.toMatchObject(
      { status: 400, message: 'roomNumber should not be empty. Code must be six digits' },
    );
  });

  it('maps network failure to a NETWORK ApiError (offline surface)', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(api('/guest/me')).rejects.toMatchObject({ status: 0, code: 'NETWORK' });
    expect(deaths).toBe(0);
  });

  it('returns parsed JSON on success', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { roomNumber: '304' }));
    await expect(api('/guest/me')).resolves.toEqual({ roomNumber: '304' });
  });

  it('unsubscribed handlers are not called', async () => {
    unsubscribe();
    fetchMock.mockResolvedValue(jsonResponse(401, {}));
    await expect(api('/guest/me')).rejects.toBeInstanceOf(ApiError);
    expect(deaths).toBe(0);
  });
});

describe('assetUrl', () => {
  it('joins relative storage paths to the API base', () => {
    expect(assetUrl('files/hotels/h1/logo.png')).toMatch(/\/files\/hotels\/h1\/logo\.png$/);
  });
  it('passes null through', () => {
    expect(assetUrl(null)).toBeNull();
  });
});
