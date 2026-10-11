# Lewis Jail Roster — Project Context

## What it is
A public jail roster monitor for Lewis County, WA, built from the same
template as `recordwatch/cowlitz-county-monitor` (itself modeled on the Kitsap
monitor). Scrapes the jail roster every 30 minutes, tracks bookings and
releases, and serves a static site.

## Sources
- https://jail.lewiscountywa.gov/roster.html — one static page. Each inmate is
  a `<tr class="name">` row (name, inmate number, booked-at) followed by a
  hidden row with a charges sub-table.
- https://jail.lewiscountywa.gov/releases.html — "Completed Releases": recent
  releases with official release time and destination ("Released To"), but
  **no inmate number**.

## Architecture
- **Scraper:** `scrape.js` (orchestrator) + `scrapers/lewis.js` (Cheerio parsing), Node 20 built-in fetch
- **Schedule:** `.github/workflows/scrape.yml`, cron every 30 min (backup only — see Scheduling)
- **Storage:** JSON committed to `data/` — no server, no database
- **Frontend:** React + Vite in `frontend/`, built and pushed to the `gh-pages` branch

## Key facts / gotchas
- "Number" is a **per-person** inmate number reused across bookings. A
  booking's `id` is `<inmateNumber>-<bookedAt digits>`.
- Release time: when someone leaves the roster we look for exactly one
  same-name entry on the releases page released after their booking time.
  Found → `releaseSource: 'official'` with `releasedTo`. Not found or
  ambiguous → `releaseSource: 'observed'` (scrape time, ~30 min accuracy),
  and later runs retry the match for two days.
- Names contain non-breaking spaces (U+00A0) between given names. `clean()`
  normalizes them; compare cleaned names only.
- No demographics, no housing location, no booking-level bond total
  (`bondTotal` is the sum of charge bond amounts) or agency (taken from the
  first charge).
- Agency/court codes (e.g. CENT, CHEH, SUP, LCD) are mapped to names in
  `stats.js` and `frontend/src/format.js`; unknown codes show as-is.
- Entries present on the very first scrape have `baseline: true`.
- Timestamps are Pacific local, `YYYY-MM-DDTHH:MM:SS`, so they sort as strings.
- Safety: if the roster comes back empty or < 50% of the previous in-custody
  count, the run exits non-zero without marking anyone released.

## Scheduling (important)
- GitHub's own `schedule:` cron is unreliable for small repos — Kitsap's
  measured gaps were 3–9 hours (median ~5.5 h), not 30 minutes.
- The real trigger is an external **cron-job.org** job that POSTs every 30
  minutes to
  `https://api.github.com/repos/recordwatch/lewis-county-monitor/actions/workflows/scrape.yml/dispatches`
  with body `{"ref":"main"}`. The workflow's own `schedule:` stays as a backup.
- It authenticates with a fine-grained GitHub token (Actions: read & write on
  the county repos only). **The token expires Aug 28, 2027** — after that, runs
  silently fall back to GitHub's slow schedule. Renew the token and update
  the cron-job.org job before then.

## Data files
- `data/change_log.json` — every booking ever seen, newest `bookedAt` first
- `data/stats.json` — precomputed stats (`stats.js`)
- `data/status.json` — `{ inCustody, lastUpdated }`

## Local dev
- `ROSTER_HTML_FILE=r.html RELEASES_HTML_FILE=rel.html node scrape.js` parses saved pages
- Frontend: copy `data/*.json` into `frontend/public/data/`, then `cd frontend && npm run dev`
