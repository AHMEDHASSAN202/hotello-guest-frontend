'use client';

import { useEffect } from 'react';

/**
 * Progressive enhancement only (Capacitor-ready: core flows never depend on
 * it). Dev skips registration so stale caches never fight fast refresh —
 * except when `NEXT_PUBLIC_SW_DEV=1` (Epic 23), the escape hatch that lets
 * push notifications be exercised manually against a local dev build.
 */
export function SwRegister() {
  useEffect(() => {
    if (
      process.env.NODE_ENV !== 'production' &&
      process.env.NEXT_PUBLIC_SW_DEV !== '1'
    ) {
      return;
    }
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js').catch(() => {
      /* the app works fine without it */
    });
  }, []);
  return null;
}
