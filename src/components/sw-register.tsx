'use client';

import { useEffect } from 'react';

/**
 * Progressive enhancement only (Capacitor-ready: core flows never depend on
 * it). Dev skips registration so stale caches never fight fast refresh.
 */
export function SwRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js').catch(() => {
      /* the app works fine without it */
    });
  }, []);
  return null;
}
