#!/usr/bin/env node
/**
 * Generates public/offline.html — the service worker's offline fallback
 * (14.1 AC3) — from messages/<locale>/states.json so the copy has ONE source
 * of truth. The page picks the guest's language at display time from the
 * locale cookies (explicit, then stay), then navigator.language, then en —
 * the same order as src/i18n/resolve-locale.ts.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
// Same seven as src/i18n/config.ts — asserted against it below.
const LOCALES = ['ar', 'en', 'ru', 'fr', 'it', 'es', 'de'];

const configSource = readFileSync(join(ROOT, 'src/i18n/config.ts'), 'utf8');
for (const locale of LOCALES) {
  if (!configSource.includes(`'${locale}'`)) {
    console.error(`✗ build-offline: locale "${locale}" missing from src/i18n/config.ts`);
    process.exit(1);
  }
}

const strings = {};
for (const locale of LOCALES) {
  const states = JSON.parse(
    readFileSync(join(ROOT, 'messages', locale, 'states.json'), 'utf8'),
  );
  strings[locale] = { title: states.offline.title, body: states.offline.body };
}

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Offline</title>
<style>
  :root { --accent: #0e2a47; --accent-soft: #e7ebf0; }
  * { margin: 0; box-sizing: border-box; }
  body {
    min-height: 100dvh; display: flex; align-items: center; justify-content: center;
    background: #f6f5f2; color: #1a1d21; text-align: center;
    font-family: 'IBM Plex Sans', 'IBM Plex Sans Arabic', system-ui, sans-serif;
    padding: 2rem; -webkit-tap-highlight-color: transparent; user-select: none;
  }
  .medallion {
    width: 7rem; height: 7rem; margin: 0 auto 2rem; border-radius: 50%;
    background: var(--accent-soft); display: flex; align-items: center; justify-content: center;
  }
  h1 { font-size: 1.25rem; margin-bottom: .5rem; font-weight: 600; }
  p { font-size: .9375rem; line-height: 1.6; color: #5a6068; max-width: 36ch; margin: 0 auto; }
  svg { width: 2.75rem; height: 2.75rem; stroke: var(--accent); }
</style>
</head>
<body>
<div>
  <div class="medallion">
    <svg viewBox="0 0 24 24" fill="none" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M12 20h.01"/><path d="M8.5 16.429a5 5 0 0 1 7 0"/>
      <path d="M5 12.859a10 10 0 0 1 5.17-2.69"/><path d="M19 12.859a10 10 0 0 0-2.007-1.523"/>
      <path d="M2 8.82a15 15 0 0 1 4.177-2.643"/><path d="M22 8.82a15 15 0 0 0-11.288-3.764"/>
      <path d="m2 2 20 20"/>
    </svg>
  </div>
  <h1 id="t"></h1>
  <p id="b"></p>
</div>
<script>
  var S = ${JSON.stringify(strings)};
  function cookie(name) {
    var m = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
    return m ? decodeURIComponent(m[1]) : null;
  }
  var lang = cookie('gxp_guest_locale') || cookie('gxp_guest_locale_stay');
  if (!S[lang]) lang = (navigator.language || 'en').split('-')[0];
  if (!S[lang]) lang = 'en';
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  document.getElementById('t').textContent = S[lang].title;
  document.getElementById('b').textContent = S[lang].body;
</script>
</body>
</html>
`;

writeFileSync(join(ROOT, 'public', 'offline.html'), html);
console.log(`✓ public/offline.html generated (${LOCALES.length} languages inlined)`);
