# GXP Guest App

The guest-facing PWA of the GXP platform. Guests scan a QR code in their room
(`/{slug}?room=304`), enter a 6-digit stay code, and are inside in seconds —
no account, no password.

- **Stack:** Next.js 14 (App Router), TypeScript, Tailwind, next-intl, vitest
- **Languages:** ar · en · ru · fr · it · es · de (full parity, build-enforced)
- **Design:** native-app feel — see `CLAUDE.md` for the standards

## Quick start

```bash
cp .env.example .env.local    # point NEXT_PUBLIC_API_URL at the backend
npm install
npm run dev                   # http://localhost:3002/<hotel-slug>
```

Current guest-route first-load JS: ~111 kB gzipped (budget: 130 kB, build-enforced).

The backend (`hotello-backend`) must be running with at least one active
hotel + stay to log in as a guest.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server on port 3002 |
| `npm run build` | i18n parity check → offline page build → `next build` → JS budget assert |
| `npm test` | vitest (components, i18n resolution, API layer) |
| `npm run check:i18n` | Seven-locale key/placeholder parity check |
