#!/usr/bin/env node
/**
 * i18n completeness check (Epic 07, Story 7.1 AC4).
 *
 * Verifies that every locale exposes an identical set of translation keys —
 * same spirit as the migrations sync check. A mismatch (missing key, extra key,
 * or a missing namespace file) exits non-zero so the build/CI fails loudly.
 *
 * Also flags ICU placeholder drift (e.g. `{count}` present in en but not ar),
 * the most common way a translation silently breaks interpolation/plurals.
 *
 * The reference locale is `en` (the canonical key set).
 */
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MESSAGES_DIR = join(ROOT, 'messages');
const REFERENCE = 'en';

function localeDirs() {
  return readdirSync(MESSAGES_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name);
}

function namespaceFiles(locale) {
  return readdirSync(join(MESSAGES_DIR, locale))
    .filter((f) => f.endsWith('.json'))
    .sort();
}

function loadNamespace(locale, file) {
  return JSON.parse(readFileSync(join(MESSAGES_DIR, locale, file), 'utf8'));
}

/** Flatten to `a.b.c` → value, recording ICU placeholders per leaf. */
function flatten(obj, prefix = '', out = {}) {
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      flatten(value, path, out);
    } else {
      out[path] = String(value);
    }
  }
  return out;
}

/** Extract `{name}` placeholders, ignoring ICU plural/select bodies' literals. */
function placeholders(str) {
  const set = new Set();
  const re = /\{\s*([a-zA-Z0-9_]+)\s*[,}]/g;
  let m;
  while ((m = re.exec(str)) !== null) set.add(m[1]);
  return set;
}

const errors = [];
const locales = localeDirs();

if (!locales.includes(REFERENCE)) {
  console.error(`✗ Reference locale "${REFERENCE}" not found in messages/`);
  process.exit(1);
}

const refFiles = namespaceFiles(REFERENCE);

for (const locale of locales) {
  if (locale === REFERENCE) continue;

  // 1. Namespace file parity.
  const files = namespaceFiles(locale);
  for (const f of refFiles) {
    if (!files.includes(f)) errors.push(`[${locale}] missing namespace file: ${f}`);
  }
  for (const f of files) {
    if (!refFiles.includes(f)) errors.push(`[${locale}] extra namespace file: ${f}`);
  }

  // 2. Per-namespace key + placeholder parity.
  for (const file of refFiles) {
    if (!files.includes(file)) continue;
    const ref = flatten(loadNamespace(REFERENCE, file));
    const cur = flatten(loadNamespace(locale, file));
    const ns = file.replace(/\.json$/, '');

    for (const key of Object.keys(ref)) {
      if (!(key in cur)) {
        errors.push(`[${locale}] missing key: ${ns}.${key}`);
        continue;
      }
      const refPh = placeholders(ref[key]);
      const curPh = placeholders(cur[key]);
      for (const p of refPh) {
        if (!curPh.has(p)) errors.push(`[${locale}] ${ns}.${key}: missing placeholder {${p}}`);
      }
    }
    for (const key of Object.keys(cur)) {
      if (!(key in ref)) errors.push(`[${locale}] extra key: ${ns}.${key}`);
    }
  }
}

if (errors.length > 0) {
  console.error(`✗ i18n completeness check failed (${errors.length} issue(s)):\n`);
  for (const e of errors) console.error(`  ${e}`);
  console.error('\nEvery locale must expose the same keys as the reference locale (en).');
  process.exit(1);
}

const count = Object.keys(
  refFiles.reduce((acc, f) => ({ ...acc, ...flatten(loadNamespace(REFERENCE, f), f) }), {}),
).length;
console.log(`✓ i18n complete: ${locales.length} locales, ${count} keys each, all in sync.`);
