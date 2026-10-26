# When is it?

A tiny, serverless web app for sharing an event time across time zones — inspired by
[inyourowntime.zone](https://www.inyourowntime.zone/), extended with **end times**, **titles**,
**extra pre-selected time zones**, and a **timeline chart** instead of a plain countdown.

Everything lives in the URL: there is no backend, no storage and no accounts.

**Live:** https://justinmcbride.github.io/when-is-it/ — e.g.
[a 90-minute team sync in Denver, also shown in London](https://justinmcbride.github.io/when-is-it/#/2026-10-26_17.30-19.00_America.Denver,Europe.London?t=Team%20sync)

## What it does

- **Create** (home page): pick a title, date, start time, optional end time and the event's time zone,
  optionally add extra time zones everyone should see, then copy the shareable link.
- **View** (event page): shows the event in the original time zone, the viewer's auto-detected time
  zone and any included zones, with a live "starts in / happening now / ended" status, and a timeline:
  - one bar per time zone on a shared time axis, shaded for working hours (09–17), off hours and
    night (22–07) in that zone's local time;
  - day boundaries and local hour ticks per zone (correct for DST and :30/:45 offsets);
  - the event span and a live **now** marker overlaid across every zone.
- DST-aware: times that don't exist (spring-forward gap) are moved forward with a warning; times that
  happen twice (fall-back overlap) use the first occurrence, also with a warning. These notices
  only appear for a time that falls inside a DST transition.
- Displayed times follow the browser locale's 12h/24h hour cycle (e.g. `en-US` → 5:30 PM,
  `en-GB` → 17:30). The URL always stores 24h wall time.

## URL format

Links use hash routing so they work on any static host with no server rewrites:

```
https://<host>/#/<YYYY-MM-DD>_<HH.MM>[-[<YYYY-MM-DD>_]<HH.MM>]_<Zone>[,<Zone>...][?t=<title>]
```

| Part | Meaning |
| --- | --- |
| `2026-10-26_17.30` | Start date and 24h wall-clock time in the event's zone |
| `-19.00` | Optional end time. If it is not after the start time it means the **next day** (e.g. `22.00-01.00`) |
| `-2026-10-28_17.00` | Optional end with an explicit date (multi-day events) |
| `_America.Denver` | IANA time zone of the event, with `/` written as `.` |
| `,Europe.London,Asia.Kolkata` | Optional extra zones shown to every viewer |
| `?t=Team%20sync` | Optional URL-encoded title |

Examples:

- `#/2026-10-26_17.30_America.Denver` — start only (same shape as inyourowntime.zone links)
- `#/2026-10-26_17.30-19.00_America.Denver,Europe.London?t=Team%20sync`
- `#/2026-10-26_22.00-01.00_Europe.Berlin` — ends at 01:00 the next day
- `#/2026-10-26_09.00-2026-10-28_17.00_Asia.Tokyo,America.Los_Angeles` — multi-day

`#/edit/<event path>` opens the create form pre-filled from an existing event ("Edit a copy").

## Development

```sh
npm install
npm run dev      # start the dev server
npm test         # unit tests (Vitest)
npm run lint     # oxlint
npm run build    # type-check and build to dist/
npm run preview  # serve the production build
```

Stack: Vite + React + TypeScript, [Luxon](https://moment.github.io/luxon/) for time zone math.

Core logic is framework-free and unit-tested in `src/lib`:

- `url.ts` — parse / serialize the URL format
- `time.ts` — wall time ⇄ instant conversion with DST gap/overlap detection
- `format.ts` — locale-aware (12h/24h) display formatting
- `timeline.ts` — the pure chart model (window, per-zone segments, ticks, day markers)
- `form.ts` — create-form state ⇄ event conversion
- `zoneRows.ts` — which zones to show and in what order

## Deployment

`npm run build` produces a fully static `dist/` folder built with a relative base path, so it can be
served from any static host or sub-path — GitHub Pages, Netlify, Vercel, Cloudflare Pages, S3, etc. No
rewrite rules are needed because routing happens in the URL hash.

This repo deploys to GitHub Pages automatically on every push to `main` via
[`.github/workflows/pages.yml`](.github/workflows/pages.yml) (Pages source: **GitHub Actions**).
