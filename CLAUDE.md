# CLAUDE.md — GXP Guest App (`hotello-guest-frontend`)

The guest-facing PWA of GXP (Guest Experience Platform) — the fourth surface,
opened from a QR code in a hotel room. Next.js 14 App Router + TypeScript +
Tailwind + next-intl + vitest.

## The prime directive: app, not website

Guests compare this to Instagram and WhatsApp, not to hotel software. Design
and interaction quality outrank feature count. Concretely (Story 14.5):

- No website tells: no visible scrollbars, no hover-dependent UI, no blue
  links, no default focus rings, no tap-highlight flash, no accidental text
  selection on chrome, no layout shift (CLS ≈ 0), no long-press callouts on
  UI elements. The `globals.css` app-feel layer enforces these — don't undo it.
- Motion: screen changes are animated state transitions (200–300ms, eased),
  never full navigations. One animation system: CSS keyframes/transitions via
  the Tailwind tokens (`screen-in`, `sheet-in`, `shake`) — no animation
  libraries. Pressed states on every interactive element (`.pressable`).
  Skeletons for every loading state — never spinners alone, never blank
  screens. `prefers-reduced-motion` is respected globally.
- Touch: ≥44×44px targets, primary actions in the thumb zone, safe-area
  padding (`.pt-safe`/`.pb-safe`), bottom-nav slot reserved in the shell.
- The entry screen and home screen ARE the demo — pixel polish is a
  requirement, not a nicety.

## Seven locales, one constant

`ar, en, ru, fr, it, es, de` — full UI coverage in all seven, always. The
list lives in `src/i18n/config.ts` ONLY (same set and order as the backend's
`GUEST_LANGUAGES`). `scripts/check-i18n.mjs` fails the build on any key or
ICU-placeholder drift across the seven — a red parity check is a red build.

- Language resolution order (implemented in `src/i18n/resolve-locale.ts`,
  unit-tested): explicit user choice (`gxp_guest_locale` cookie) → stay's
  guest language (`gxp_guest_locale_stay` session cookie) → browser
  `Accept-Language` → `en`.
- Arabic flips the app (logical properties, mirrored directional icons, bidi
  isolation via `<Bdi>` for room numbers/codes). Latin digits everywhere
  (`-u-nu-latn` — see `src/i18n/format.ts`).
- Guest-facing copy NEVER mentions internal concepts: trial, subscription,
  tenant, session, 401. Warm hospitality register in every language.

## Consume the contract — never redefine it

The backend session contract (Epic 13.5) is consumed verbatim:

- `POST /guest/{slug}/session` `{ roomNumber, code }` → `{ accessToken, profile }`
- `GET /guest/me` → profile; any 401 on it mid-use = session death → warm
  goodbye screen (checkout/suspension); boot 401 = silent entry screen.
- `GET /guest/{slug}/profile` (public) → branding + `enabledModules`.
- Error codes: `HOTEL_NOT_FOUND`, `HOTEL_UNAVAILABLE`, `INVALID_CODE`,
  `TOO_MANY_ATTEMPTS` (+ `retryAfterSeconds` in the BODY — no header).

Backend response shapes live in `src/lib/types.ts` and nowhere else. All API
calls go through `src/lib/api.ts` (`api<T>()`); never call raw `fetch`. There
is NO guest refresh token — re-entry is by code. The guest access token lives
in `localStorage` (`gxp_guest_token`) via `src/lib/auth.ts`.

The `?room=` URL param only pre-fills the entry form — never trusted for
anything else, dropped once a session exists.

## Performance budgets are law

LCP < 2.5s and TTI < 3.5s on mid-range Android over throttled 4G. The build
asserts the initial JS budget (`scripts/check-bundle-size.mjs`) and Lighthouse
CI enforces the rest — a red budget fails the build like a red test. Fonts are
subset per script via `next/font` (Latin+Cyrillic body font, Arabic companion),
`display: swap`, no FOIT.

## Capacitor-ready

No browser-only APIs in core flows. Service worker and manifest are
progressive enhancements — entry and home must work without them. Session
storage is `localStorage` (works in a WebView), never cookies-only, never URLs.

## Specs

Feature specs live in the backend repo under `hotello-backend/specs/` —
`epic-14-guest-app-foundation.md` is this app's founding spec and the source
of truth; `epic-13-stays-guest-sessions.md` (Story 13.5) defines the session
contract. Durable decisions made during implementation go back into the epic
file.

## Commands

```bash
cp .env.example .env.local    # NEXT_PUBLIC_API_URL → the backend
npm install
npm run dev                   # http://localhost:3002/{slug} (e.g. /sunrise)
npm run build                 # i18n parity check + next build + bundle budget
npm test                      # vitest
npm run check:i18n            # seven-locale parity check alone
```

## Workflow (pre-production convention — revisit at launch)

- All work happens directly on `master` (the GitHub default for this repo).
  No feature branches, no stacked epic branches, no worktrees.
- Small, clear commits per task; push to origin after each verified green
  state — `origin/master` always holds the latest work.
- Quality gates never relax: `npm test` + `npm run build` (seven-locale
  parity check, offline page, JS budget) must be green before every push.
  Never push red.
- Changes spanning repos land backend-first, then the frontends.
