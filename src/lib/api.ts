import { tokenStore } from './auth';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

export class ApiError extends Error {
  public readonly status: number;
  /** Stable backend code — the UI maps it to translated copy. */
  public readonly code?: string;
  /** 14.2 AC3 — lockout countdown seconds (429 body, not a header). */
  public readonly retryAfterSeconds?: number;
  public readonly details?: unknown;

  constructor(
    status: number,
    message: string,
    opts: { code?: string; retryAfterSeconds?: number; details?: unknown } = {},
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = opts.code;
    this.retryAfterSeconds = opts.retryAfterSeconds;
    this.details = opts.details;
  }
}

/** Resolve a backend-relative asset path (`files/{key}`) to a full URL. */
export function assetUrl(path: string | null): string | null {
  return path ? `${BASE_URL}/${path}` : null;
}

/**
 * Session-death subscription (14.2 AC5): a 401 on an authenticated guest
 * route means the stay ended (checkout/suspension) — the provider routes to
 * the warm goodbye screen. Returns an unsubscribe function.
 */
const deathHandlers = new Set<() => void>();
export function onSessionDeath(handler: () => void): () => void {
  deathHandlers.add(handler);
  return () => deathHandlers.delete(handler);
}

/**
 * Public guest endpoints where a 401 is a BUSINESS answer (wrong code) —
 * never a dead session. The session-death flow must not run for these.
 */
const SESSION_EXEMPT = [/^\/guest\/[^/]+\/session$/, /^\/guest\/[^/]+\/profile$/];
function isSessionExempt(path: string): boolean {
  const bare = path.split('?')[0];
  return SESSION_EXEMPT.some((re) => re.test(bare));
}

async function parseError(res: Response): Promise<ApiError> {
  let code: string | undefined;
  let message = `Request failed (${res.status})`;
  let retryAfterSeconds: number | undefined;
  let details: unknown;
  try {
    const body = (await res.json()) as Record<string, unknown>;
    details = body;
    if (typeof body?.code === 'string') code = body.code;
    if (Array.isArray(body?.message)) message = body.message.join('. ');
    else if (typeof body?.message === 'string') message = body.message;
    if (typeof body?.retryAfterSeconds === 'number') {
      retryAfterSeconds = body.retryAfterSeconds;
    }
  } catch {
    /* non-JSON body — keep defaults */
  }
  // Nest's coarse ThrottlerException has neither code nor retryAfterSeconds —
  // normalize so the lockout UI has one shape to handle.
  if (res.status === 429) {
    code ??= 'TOO_MANY_ATTEMPTS';
    retryAfterSeconds ??= 60;
  }
  return new ApiError(res.status, message, { code, retryAfterSeconds, details });
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = tokenStore.get();

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init.headers,
      },
    });
  } catch {
    throw new ApiError(0, 'Network request failed', { code: 'NETWORK' });
  }

  if (res.status === 401 && !isSessionExempt(path)) {
    // The stay is over (or the token is stale) — one path for all of it.
    tokenStore.clear();
    deathHandlers.forEach((handler) => handler());
    throw new ApiError(401, 'Session ended', { code: 'SESSION_ENDED' });
  }

  if (!res.ok) throw await parseError(res);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
