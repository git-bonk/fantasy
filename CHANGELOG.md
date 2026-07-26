# Changelog

## 2026-07-25

### Owner/team obfuscation — server foundation — NEEDS FIXING

> **Status: needs fixing.** Foundation only — obfuscation is not yet functional end-to-end and
> must be finished and verified before it can be relied on to hide identities.

Groundwork for site-wide identity obfuscation (passcode-gated reveal). Real names/IDs are
never sent to the client while locked, and the unlock cookie is HMAC-signed so it cannot be
forged in DevTools.

- `pipeline/fantasynfl/db.py` — `owners.alias_num` (UNIQUE, nullable) + idempotent migration;
  `assign_owner_aliases()` numbers owners in `sorted(owner_id)` order from `max+1`, called from
  `store_owners` (idempotent). Sample generator seeds 12 synthetic owners (`sample-owner-01..12`).
- `web/src/lib/reveal.ts` — server-only HMAC signing (`signValue`/`verifyValue`), `getRevealState()`
  (true only when unlocked AND the reveal toggle is on), and neutral `aliasOwner(n)`/`aliasTeam(n)`
- `web/src/lib/actions.ts` — server actions `unlock(passcode)` (verifies `REVEAL_PASSCODE`, sets a
  signed HttpOnly `unlocked` cookie via `REVEAL_SECRET`) and `setReveal(on)`
- `web/.env.example` + `docker-compose.yml` — `REVEAL_PASSCODE` / `REVEAL_SECRET` wiring

**Still to fix:** the query-level obfuscation transform (J2) — the part that actually withholds
real names/IDs from the client while locked — is not implemented; the reveal UI (L) and
verification/docs (M) are incomplete.

### Owner identity + running cross-season Elo (pipeline)

Owners are now tracked across seasons via ESPN's stable member ID, and a running
cross-season Elo rating is computed per owner — separate from the existing per-team,
per-season power rating (`elo_ratings`), which is unchanged.

- `pipeline/fantasynfl/models.py` — `Owner` dataclass; `Team.owner_id`; `SeasonData.owners`
- `pipeline/fantasynfl/db.py` — new `owners` + `owner_elo` tables and `teams.owner_id` column
  (with idempotent migration); `store_owners()` upsert; `store_teams`/`store_season` persist owners
- `pipeline/fantasynfl/espn.py` — fixed the `owner`→`owners` bug (real ingests previously stored
  blank owner names); `fetch_teams` returns `(teams, owners)` with deduped owners, primary-owner
  selection for co-owned teams, and `NULL` for ownerless teams
- `pipeline/fantasynfl/compute/owner_elo.py` — `compute_owner_elo` + cross-season
  `compute_owner_elo_all`; carryover regresses toward 1500 (`1500 + 0.75·(prev−1500)`), new owners
  start at 1500; processes all seasons in year order
- `pipeline/fantasynfl/ingest.py` — `ingest_espn` and `recompute` call `compute_owner_elo_all`
  after per-season compute; `recompute` orders seasons by year
- `web/src/lib/types.ts` — `Owner`, `OwnerEloRating`, `Team.owner_id` mirror

### Owner standings data layer (web)

Query functions backing the upcoming all-time owner rankings UI:

- `web/src/lib/queries.ts` — `getOwnerStandings()` (latest running Elo per owner plus career
  W/L/T aggregated across all seasons; teams with `owner_id IS NULL` are excluded),
  `getOwnerEloHistory(ownerId)` (rating trajectory across seasons), and
  `getSeasonPowerRankings(seasonId)` (semantic alias of `getRankings` for the per-season ranking)
- `web/src/lib/types.ts` — `OwnerStandingRow`, `OwnerEloHistoryRow`

### All-time owner rankings UI (web)

The all-time owner rankings view (task G) is built on top of the owner standings data layer:

- `web/src/app/all-time/page.tsx` — all-time leaderboard keyed by owner (running Elo desc),
  with rank medals, career record, and win%; rows link to an owner detail page. Empty state
  until owner data is ingested (sample data has none — built blind against the schema).
- `web/src/app/all-time/[ownerId]/page.tsx` — owner detail: rating/record/win%/seasons stat
  chips, cross-season Elo trajectory chart, and teams fielded
- `web/src/components/charts/OwnerEloChart.tsx` — single-series Elo line spanning seasons
  (x ticks at season boundaries)
- `web/src/app/rankings/page.tsx` — relabeled "Season Power Rankings" (per-team, per-season)
  to distinguish it from the all-time owner view; now calls `getSeasonPowerRankings`
- `web/src/components/layout/Sidebar.tsx` — added "All-Time" nav item (Crown) after Rankings
- `web/src/lib/format.ts` — shared `ownerColor(id)` + `initials(name)` helpers

### Docs: owner model + running-Elo-vs-power-score split (H4)

Synced the docs to the owner-identity work:

- `ARCHITECTURE.md` — `owners`/`owner_elo` tables + `teams.owner_id` in the data contract;
  the two-tier rating model (per-team power rating vs running cross-season owner Elo);
  owner-Elo compute (regressed carryover) + the separate year-ordered pass; 12 pages
  (added `/all-time`, `/all-time/[ownerId]`, `/history`); 37 pipeline tests
- `PLAN.md` — All-Time + League History in the page list; owner identity + owner Elo in
  infrastructure
- `README.md` — All-Time Rankings + League History in the feature list
- `TASKS.md` was cleared by the pipeline agent, so there was nothing to sync there

### Teams: filterable by week

`/teams` now reflects the selected week instead of always showing final standings. The
topbar week selector (which re-renders instantly) drives it; no new on-page control.

- `web/src/lib/queries.ts` — `getTeams(seasonId, weekNum?)` joins each team's latest
  `playoff_snapshots` row with `week_num <= weekNum` ("standings as of week N"); playoff
  weeks clamp to the final regular-season snapshot. `getStreaks(seasonId, weekNum?)` likewise
  limits to matchups through that week. Both params are optional, so other callers (overview,
  playoffs, trends, team detail) keep their full-season behavior.
- `web/src/app/teams/page.tsx` — passes `weekNum` to both; subtitle now reads
  "Standings through Week N".

### League History page (replaces Rivalry in the sidebar)

New `/history` page listing every owner who's ever fielded a team, grouped across seasons.
Takes the sidebar slot previously held by Rivalry (the `/rivalry` route is kept — still
reachable from the `/trends` head-to-head matrix).

- `web/src/lib/types.ts` + `queries.ts` — `LeagueHistoryRow` + `getLeagueHistory()`
  (`teams ⋈ seasons`); owners grouped in-page by `owner_id ?? owner_name` (works for sample
  data, which has no `owners` rows, and real ESPN data)
- `web/src/app/history/page.tsx` — seasons/owners stat strip + owner cards (tenure span,
  teams fielded with colored abbrev chips)
- `web/src/components/layout/Sidebar.tsx` — swapped the Rivalry nav item for League History
  (`History` icon), in both desktop sidebar and mobile nav

### Scores: box scores auto-open on desktop

`/scores` matchup cards now open their box scores automatically on desktop viewports
(≥1280px, the `xl` breakpoint). Mobile and `/recap` behavior is unchanged.

- `web/src/lib/use-media-query.ts` — new `useMediaQuery` hook (`useSyncExternalStore`,
  server snapshot `false` so there's no hydration mismatch)
- `web/src/components/cards/MatchupCard.tsx` — new `autoOpenOnDesktop` prop; open state is
  derived (`userOpen ?? (autoOpenOnDesktop && isDesktop)`) so a manual toggle always wins
- `web/src/app/scores/page.tsx` — passes `autoOpenOnDesktop` to each card

### Week/year selectors require a page reload — STILL BROKEN

> **Status: still broken.** Changing the week or year (topbar or per-page selector) updates the
> URL but leaves the rendered data stale until a manual reload, notably on `/scores` and `/predict`.

- Reverted attempt: `setYear`/`setWeek` in `web/src/lib/season-context.tsx` called
  `router.refresh()` after `router.replace(...)`. This raced the navigation (`refresh()`
  re-fetched the pre-navigation route) and did not fix the staleness.
- Current attempt: removed the `router.refresh()` calls, relying on `router.replace(...)` alone
  (re-renders the server-component page from `searchParams`; the topbar selector is reactive via
  the season context). Typechecks clean and deployed, but **not yet confirmed** in the browser.

### Removed duplicate week selectors

The top bar (`TopbarControls`) already provides a global year/week selector. Removed redundant
per-page `WeekSelector` instances from:

- `web/src/app/scores/page.tsx` — removed `action` prop from `PageHeader`
- `web/src/app/recap/page.tsx` — removed `action` prop from `PageHeader`
- `web/src/app/predict/page.tsx` — removed `action` prop from `PageHeader`
- `web/src/app/players/page.tsx` — removed selector from section header
- `web/src/app/playoffs/page.tsx` — removed selector from section header + unused `weeks` variable

### Rankings: win/loss records + sortable columns

The power rankings table now shows each team's W-L(-T) record and supports sorting by either
rating or record. Sort is always highest→lowest (no direction toggle); the rank column
renumbers to match the active sort.

- `web/src/lib/types.ts` — `RankingRow` extended with `wins`, `losses`, `ties`, `points_for`
- `web/src/lib/queries.ts` — `getRankings` LEFT JOINs `playoff_snapshots` at the latest
  regular-season week
- `web/src/components/rankings/RankingsTable.tsx` — new client component; sort by rating
  (default) or record (wins → ties → points_for → rating tiebreak), layout-animated reorders
- `web/src/components/motion/Reveal.tsx` — `AnimatedRow` gained an optional `layout` prop
- `web/src/app/rankings/page.tsx` — server-only data fetch, delegates table to `RankingsTable`

### Docs refresh

Updated `ARCHITECTURE.md`, `TASKS.md`, `TASKS-FEATURES.md`, `DEPLOY.md`, `README.md`, and
`PLAN.md` to reflect current state: 11 pages (rivalry added), Next.js 16, all engagement
features complete, container-based Cloudflare Tunnel.

### docker-compose: tunnel token externalized

The Cloudflare tunnel token was hardcoded in `docker-compose.yml`; it is now referenced as
`${TUNNEL_TOKEN}` and should be set in `.env` (gitignored).

---

## Project history (completed)

### Pipeline (Python)

- Python pipeline (`pipeline/`) that scrapes ESPN or generates a sample league, computes
  stats (Elo, luck, awards, SOS, playoff odds, records), and writes `data/fantasynfl.db`.
- Sample generator: 12 themed teams, 17 weeks, 90 matchups, ~2880 roster rows, 40 transactions,
  204 elo rows, 204 luck, 98 awards, 204 sos, 168 playoff snapshots, 30 records.
- ESPN client (`espn.py`) for real league ingest via `espn_api` (private-league cookie auth).
  Transactions fetched via `league.recent_activity` (best-effort, recent events only).
- 26 pytest tests pass; `ruff` clean.
- Live ESPN ingest blocked on credentials (A3/G5).

### Web dashboard (Next.js)

Next.js 16 (App Router) + TypeScript + Tailwind v4 + shadcn/ui + Recharts + Framer Motion.
Reads SQLite read-only via `better-sqlite3` in server components only. 11 pages:

- `/` overview — hero, stat cards, sparklines
- `/rankings` — Elo power table + line chart
- `/scores` — weekly matchup grid
- `/recap` — shareable recap card, results with narrative tags, awards, luck meter
- `/trends` — league points trend, per-team toggle, streaks, H2H matrix
- `/predict` — Elo win-probability vs actual results
- `/teams` + `/teams/[id]` — team grid + detail (record, SOS, odds, roster)
- `/playoffs` — standings with cut line, odds bars, bracket
- `/players` — weekly top performers + season leaders by position
- `/transactions` — chronological ADD/DROP feed
- `/records` — Hall of Fame + Shame Corner
- `/rivalry` — head-to-head finder with team picker

### Engagement features

- **Recap tags** — narrative performance tags on matchup cards (Upset, Nail-biter, Blowout,
  Statement, Revenge, Bust, Shootout)
- **Streak flames** — fire/snowflake badges for active win/loss streaks (≥2)
- **Shame Corner** — mocking "worst of the league" section on `/records`
- **Shareable recap card** — fixed-width screenshot-worthy weekly summary
- **Rivalry finder** — pick two teams, see all-time head-to-head history

### Deployment

- Docker Compose: `web` (Next.js) + `pipeline` (cron ingest Monday 06:00) + `tunnel` (Cloudflare)
- Cloudflare Tunnel for HTTPS (no exposed ports except SSH)
- Deploy guide in `DEPLOY.md`
