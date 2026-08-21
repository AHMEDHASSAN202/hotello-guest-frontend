import type { AbstractIntlMessages } from 'next-intl';
import ar from '../../messages/ar';
import de from '../../messages/de';
import en from '../../messages/en';
import es from '../../messages/es';
import fr from '../../messages/fr';
import it from '../../messages/it';
import ru from '../../messages/ru';
import type { Locale } from './config';

const bundles: Record<Locale, AbstractIntlMessages> = { ar, en, ru, fr, it, es, de };

type Messages = Record<string, unknown>;

/** Layer a locale over English so a missing key degrades, never crashes. */
function deepMerge(base: Messages, override: Messages): Messages {
  const out: Messages = { ...base };
  for (const [key, value] of Object.entries(override)) {
    const baseValue = out[key];
    if (
      value && typeof value === 'object' && !Array.isArray(value) &&
      baseValue && typeof baseValue === 'object' && !Array.isArray(baseValue)
    ) {
      out[key] = deepMerge(baseValue as Messages, value as Messages);
    } else {
      out[key] = value;
    }
  }
  return out;
}

export function loadMessages(locale: Locale): AbstractIntlMessages {
  // Dev returns the raw bundle so missing keys fail loudly; the parity check
  // (scripts/check-i18n.mjs) is the real guarantee — prod merge is a backstop.
  if (locale === 'en' || process.env.NODE_ENV === 'development') {
    return bundles[locale];
  }
  return deepMerge(bundles.en as Messages, bundles[locale] as Messages) as AbstractIntlMessages;
}
