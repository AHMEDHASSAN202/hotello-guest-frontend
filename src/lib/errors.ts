'use client';

import { useTranslations } from 'next-intl';
import { useCallback } from 'react';
import { ApiError } from './api';

type ErrorTranslator = ReturnType<typeof useTranslations>;

/**
 * Maps any thrown error to a translated, user-safe message.
 *
 * Resolution order:
 *   1. Stable backend `code` → `errors.code.<CODE>` (specific wording).
 *   2. HTTP status → `errors.byStatus.<status>` (generic but translated).
 *   3. Anything else → `errors.generic`.
 *
 * Raw English backend messages are never surfaced — so the Arabic UI never
 * leaks an untranslated string.
 */
export function resolveApiError(err: unknown, t: ErrorTranslator): string {
  if (err instanceof ApiError) {
    if (err.code && t.has(`code.${err.code}`)) {
      return t(`code.${err.code}`);
    }
    if (t.has(`byStatus.${err.status}`)) {
      return t(`byStatus.${err.status}`);
    }
  }
  return t('generic');
}

/** Hook form: binds the `errors` namespace once and returns a resolver. */
export function useApiError() {
  const t = useTranslations('errors');
  return useCallback((err: unknown) => resolveApiError(err, t), [t]);
}
