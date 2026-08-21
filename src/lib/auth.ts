const TOKEN_KEY = 'gxp_guest_token';

/**
 * Single guest access token — there is NO refresh token (re-entry is by
 * code, per the 13.5 decision). localStorage survives browser restarts for
 * the stay's duration (14.2 AC4) and works inside a Capacitor WebView.
 * All token handling lives here so a storage swap is a one-file change.
 */
export const tokenStore = {
  get(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(TOKEN_KEY);
  },
  set(token: string) {
    localStorage.setItem(TOKEN_KEY, token);
  },
  clear() {
    localStorage.removeItem(TOKEN_KEY);
  },
};
