import { getRequestConfig } from 'next-intl/server';
import { cookies, headers } from 'next/headers';
import { LOCALE_COOKIE, SESSION_LOCALE_COOKIE } from './config';
import { loadMessages } from './messages';
import { resolveLocale } from './resolve-locale';

/**
 * Locale strategy is cookie-based — no locale URL prefix, so guest URLs stay
 * exactly what the QR codes print. The layout re-reads this on every
 * `router.refresh()`, which is how switching applies instantly.
 */
export default getRequestConfig(async () => {
  const jar = cookies();
  const locale = resolveLocale({
    explicit: jar.get(LOCALE_COOKIE)?.value,
    stay: jar.get(SESSION_LOCALE_COOKIE)?.value,
    acceptLanguage: headers().get('accept-language'),
  });

  return { locale, messages: loadMessages(locale) };
});
