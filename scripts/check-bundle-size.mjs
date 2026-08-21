#!/usr/bin/env node
/**
 * Initial-JS budget assert (14.1 AC4) — a red budget fails the build like a
 * red test. Sums the gzipped client JS the guest route (/[slug]) ships on
 * first load, from Next's app-build-manifest.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BUDGET_KB = 130; // gzipped
const ROUTE = '/[slug]/page';

let manifest;
try {
  manifest = JSON.parse(readFileSync(join(ROOT, '.next', 'app-build-manifest.json'), 'utf8'));
} catch {
  console.error('✗ bundle check: .next/app-build-manifest.json not found — run `next build` first.');
  process.exit(1);
}

const assets = manifest.pages?.[ROUTE];
if (!assets) {
  console.error(`✗ bundle check: route "${ROUTE}" not in the app build manifest.`);
  process.exit(1);
}

let total = 0;
const rows = [];
for (const asset of assets) {
  if (!asset.endsWith('.js')) continue;
  const bytes = gzipSync(readFileSync(join(ROOT, '.next', asset))).length;
  total += bytes;
  rows.push(`  ${(bytes / 1024).toFixed(1).padStart(7)} kB  ${asset}`);
}

const totalKb = total / 1024;
console.log(`Guest route (${ROUTE}) initial JS, gzipped:`);
console.log(rows.join('\n'));
console.log(`  ─────────\n  ${totalKb.toFixed(1).padStart(7)} kB  total (budget ${BUDGET_KB} kB)`);

if (totalKb > BUDGET_KB) {
  console.error(`\n✗ JS budget exceeded: ${totalKb.toFixed(1)} kB > ${BUDGET_KB} kB. The build is red.`);
  process.exit(1);
}
console.log('✓ within budget');
