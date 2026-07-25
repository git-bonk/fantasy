# TASKS — Fantasy NFL Dashboard (Frontend Build)

> **STATUS: COMPLETE** (except ESPN live-ingest, blocked on credentials — see A3/G5).
> The Python pipeline **and** the full Next.js dashboard in `web/` are built and verified.
> This file is kept as the build spec / record of work. New feature work lives in
> `TASKS-FEATURES.md`. Read `ARCHITECTURE.md` for deeper background.

---

## 0. Mission & current state

- **Done:** Python pipeline (`pipeline/`) that scrapes ESPN or generates a sample league, computes
  stats (Elo, luck, awards, SOS, playoff odds, records), and writes `data/fantasynfl.db`.
- **Done:** the `web/` Next.js app — all 10 pages built, `pnpm lint` + `pnpm build` clean.
- **Blocked:** live ESPN ingest (A3, G5) — needs real league credentials in `.env`.
- **Goal (met):** a polished, modern **dark dashboard** with 10 pages that makes a fantasy league's
  data look great. Aesthetic target: Linear/Vercel-style dark UI — clean, layered, subtle motion.

**Do NOT modify the pipeline or the DB schema** unless a task explicitly says so. Treat
`data/fantasynfl.db` as read-only input. If the DB is missing, regenerate it:
`cd pipeline && .venv/bin/python -m fantasynfl sample` (venv must exist — see §1).

---

## 1. Quick reference — commands

```bash
# (Re)generate the sample database (only if data/fantasynfl.db is missing)
cd pipeline
python3 -m venv .venv && . .venv/bin/activate && pip install -e ".[dev]"   # first time only
python -m fantasynfl sample        # writes ../data/fantasynfl.db

# Web app (you build this)
cd web
pnpm install
pnpm dev          # http://localhost:3000
pnpm build        # production build (also typechecks)
pnpm lint         # eslint
```

Node 24 and pnpm 11 are available. Python 3.14 is installed (Alpine, via apk).

---

## 2. Quick reference — SQLite schema (read-only input)

Source of truth: `pipeline/fantasynfl/db.py`. All `id`s are INTEGER PRIMARY KEY.

```sql
seasons(id, year UNIQUE, league_id, settings_json TEXT, created_at)
teams(id, season_id, espn_team_id, name, abbrev, owner_name, color TEXT /*hex*/, logo_url)
weeks(id, season_id, week_num, label TEXT, start_date, end_date, is_playoff INT /*0/1*/)
matchups(id, week_id, home_team_id, away_team_id, home_score REAL, away_score REAL,
         winner_team_id /*NULL=tie*/, is_playoff INT)
rosters(id, week_id, team_id, espn_player_id, player_name, position, nfl_team,
        lineup_slot, points REAL)
transactions(id, season_id, team_id, espn_player_id, player_name, type, bid_amount, occurred_at)

-- precomputed
elo_ratings(id, season_id, team_id, week_num, rating REAL)          -- rating AFTER that week
luck(id, season_id, team_id, week_num, actual_wins REAL, expected_wins REAL, luck_score REAL)
awards(id, week_id, type, team_id, player_name, value REAL, detail TEXT)
sos(id, season_id, team_id, week_num, opp_avg_points REAL, sos_rank INT)
playoff_snapshots(id, season_id, week_num, team_id, wins, losses, ties, points_for REAL,
                  points_against REAL, playoff_seed /*NULL if out*/, playoff_odds REAL /*0..1*/)
records(id, category, rank, season_id, team_id, player_name, value REAL, detail TEXT)
```

**Enums present in the sample data:**
- `rosters.position`: `QB, RB, WR, TE, K, DEF`
- `rosters.lineup_slot`: `QB, RB, WR, TE, FLEX, K, DEF, BN` (BN = bench; **starters are everything except BN**)
- `awards.type`: `TOP_SCORE, BIGGEST_BUST, CLOSEST_FINISH, BIGGEST_UPSET, LUCKIEST, TOP_PLAYER`
- `records.category`: `SINGLE_GAME_HIGH, SINGLE_GAME_LOW, BIGGEST_WIN, TOP_PLAYER_GAME, BEST_SEASON, LONGEST_STREAK`
- `transactions.type`: `ADD, DROP` (real ESPN ingest may also produce `TRADE_IN/TRADE_OUT`)
- `weeks`: 1–14 are regular season (`is_playoff=0`, label "Week N"); 15=Quarterfinals, 16=Semifinals,
  17=Championship (`is_playoff=1`).
- `seasons.settings_json`: `{"scoring":"PPR","playoff_teams":6,...}`

**Invariant:** a team's `matchups.home_score`/`away_score` == sum of that team's STARTER
(`lineup_slot != 'BN'`) `rosters.points` for that week.

### Sample data facts (12 teams)
| id | name | abbrev | owner | color |
|----|------|--------|-------|-------|
| 1 | Gridiron Gladiators | GLA | Marcus Reed | #22c55e |
| 2 | End Zone Elite | EZE | Tanya Brooks | #f59e0b |
| 3 | The Pigskin Prophets | PIP | Devon Clarke | #38bdf8 |
| 4 | Blitzkrieg Battalion | BLI | Sofia Nguyen | #ef4444 |
| 5 | Catch Me If You Can | CAT | Liam O'Connor | #a855f7 |
| 6 | Hail Mary Heroes | HMH | Priya Patel | #ec4899 |
| 7 | Turbo Tight Ends | TTE | Jamal Wright | #14b8a6 |
| 8 | Fumble Nation | FUM | Grace Kim | #f97316 |
| 9 | The Running Backs | RUN | Noah Fischer | #84cc16 |
| 10 | Pick Six Society | PSS | Ava Rossi | #6366f1 |
| 11 | Sack Pack | SAC | Ethan Cole | #0ea5e9 |
| 12 | Two Point Conversions | TPC | Mia Alvarez | #eab308 |

Volume: 1 season (2025) · 12 teams · 17 weeks · 90 matchups · ~2880 roster rows · 40 transactions ·
204 elo rows · 204 luck · 98 awards · 204 sos · 168 playoff snapshots · 30 records.

---

## 3. Quick reference — tech stack & config

- **Next.js 15** (App Router) + **React 19** + **TypeScript (strict)**.
- **Tailwind CSS** (whatever `create-next-app` scaffolds — currently v4) + **shadcn/ui** (new-york style).
- **Recharts** for charts. **Framer Motion** (`motion` package) for animation. **lucide-react** for icons.
- **better-sqlite3** to read the DB (native module).
- Utilities: `clsx`, `tailwind-merge`, `class-variance-authority` (come with shadcn).

### Critical config gotchas
1. **`next.config.ts`** — add `serverExternalPackages: ['better-sqlite3']` so Next doesn't try to
   bundle the native module:
   ```ts
   const nextConfig = { serverExternalPackages: ["better-sqlite3"] };
   export default nextConfig;
   ```
2. **DB path** — `process.cwd()` is `web/`, so the DB is at `../data/fantasynfl.db`. Resolve it
   robustly in `lib/db.ts`, e.g.:
   ```ts
   import path from "node:path";
   const DB_PATH = process.env.DB_PATH ?? path.resolve(process.cwd(), "..", "data", "fantasynfl.db");
   ```
3. **Read-only, server-only** — open the DB read-only and only ever import `lib/db.ts` from
   **server components** or route handlers, never from `"use client"` components.
   ```ts
   import Database from "better-sqlite3";
   export const db = new Database(DB_PATH, { readonly: true, fileMustExist: true });
   ```
4. **No `any`** — type every query result (see `lib/types.ts`, task C1).

---

## 4. Quick reference — design system

**Vibe:** modern dark dashboard (Linear/Vercel). Clean, layered, premium — not neon-on-black.

- **Background:** `zinc-950` (#09090b) base. Add ambient depth in `globals.css`: 1–2 large soft
  radial glows (emerald & amber at ~6–10% opacity) + a very subtle field-line/grid pattern
  (low-opacity repeating linear gradients). Keep it tasteful and static (no busy animation).
- **Surfaces/cards:** `zinc-900/60` bg, `border border-zinc-800`, `rounded-xl`, subtle shadow.
  Hover: `border-zinc-700` + slight lift (`-translate-y-0.5`) and/or glow.
- **Accents:** primary **emerald-500** (#10b981, "turf green"); secondary **amber-400** (#fbbf24,
  for awards/highlights). Use **per-team `color`** from the DB for team-specific chips/bars.
- **Semantic:** positive/emerald-500, negative/rose-500, muted text `zinc-400`, faint `zinc-500`.
- **Typography:** display **"Space Grotesk"**, body **"Manrope"**, numbers/mono **"JetBrains Mono"**
  (load via `next/font/google`). Use `tabular-nums` for all stats. Strong size/weight contrast for
  headline numbers (e.g. scores ~text-4xl/5xl bold).
- **Motion:** Framer Motion page/section reveals (fade+rise, ~0.3s, staggered), animated count-up
  for big stats, animated luck-meter gauge and win-probability bars. Respect `prefers-reduced-motion`.
- **Layout:** fixed **left sidebar** (nav for the 10 pages, lucide icons + labels, active state
  highlighted) + **top bar** (league name, season selector, week selector). Main content scrolls.
  Responsive: sidebar collapses to a top/bottom nav on mobile.

Avoid: indigo/violet/purple gradients, single-neon-accent-on-near-black, generic Inter-only type,
cookie-cutter shadcn-default look. Make it feel like a real sports product.

---

## 5. Quick reference — conventions

- Strict TypeScript; **no `any`**, no `@ts-ignore`.
- **Named exports only** (no default exports), `const` by default, early returns.
- DB access only in `lib/` + server components. Client components receive props.
- `lib/types.ts` must mirror the SQLite schema (§2). Keep in sync if the schema ever changes.
- Colocate small helpers; keep queries in `lib/queries.ts`.
- Run `pnpm lint` and `pnpm build` before considering a task done.

---

## 6. Quick reference — starter SQL per page

Use `season_id = 1` (single sample season) or read the latest season: `SELECT id FROM seasons ORDER BY year DESC LIMIT 1`.

```sql
-- RANKINGS: current Elo (end of regular season) + history for chart
SELECT t.id, t.name, t.abbrev, t.color, e.rating
FROM elo_ratings e JOIN teams t ON t.id=e.team_id
WHERE e.season_id=? AND e.week_num=(SELECT MAX(week_num) FROM weeks WHERE season_id=? AND is_playoff=0)
ORDER BY e.rating DESC;
SELECT e.week_num, t.id, t.name, e.rating FROM elo_ratings e JOIN teams t ON t.id=e.team_id
WHERE e.season_id=? ORDER BY e.week_num;   -- pivot client-side for the line chart

-- SCORES: matchups for a week
SELECT m.id, m.home_score, m.away_score, m.winner_team_id, w.is_playoff,
       th.id hid, th.name hname, th.abbrev habb, th.color hcolor,
       ta.id aid, ta.name aname, ta.abbrev aabb, ta.color acolor
FROM matchups m JOIN weeks w ON w.id=m.week_id
JOIN teams th ON th.id=m.home_team_id JOIN teams ta ON ta.id=m.away_team_id
WHERE w.season_id=? AND w.week_num=?;

-- RECAP: awards + luck for a week
SELECT a.type, a.value, a.detail, a.player_name, t.name tname, t.color
FROM awards a JOIN weeks w ON w.id=a.week_id LEFT JOIN teams t ON t.id=a.team_id
WHERE w.season_id=? AND w.week_num=?;
SELECT t.id, t.name, t.color, l.actual_wins, l.expected_wins, l.luck_score
FROM luck l JOIN teams t ON t.id=l.team_id WHERE l.season_id=? AND l.week_num=?
ORDER BY l.luck_score DESC;

-- TRENDS: league avg points per week (union of both sides)
SELECT w.week_num, AVG(score) avg_pts FROM (
  SELECT m.id mid, w.week_num, m.home_score score FROM matchups m JOIN weeks w ON w.id=m.week_id
  UNION ALL
  SELECT m.id, w.week_num, m.away_score FROM matchups m JOIN weeks w ON w.id=m.week_id
) JOIN weeks w ON w.week_num=week_num WHERE w.season_id=? GROUP BY w.week_num ORDER BY w.week_num;
-- per-team points per week: same union but keep team_id; streaks/H2H derive from matchups.

-- TEAMS: list + per-team detail
SELECT t.*, /* latest */ ps.wins, ps.losses, ps.points_for, ps.points_against, ps.playoff_seed, ps.playoff_odds
FROM teams t LEFT JOIN playoff_snapshots ps ON ps.team_id=t.id
  AND ps.week_num=(SELECT MAX(week_num) FROM playoff_snapshots WHERE season_id=t.season_id AND team_id=t.id)
WHERE t.season_id=?;
-- SOS: SELECT opp_avg_points, sos_rank FROM sos WHERE season_id=? AND team_id=? AND week_num=<latest>;

-- PLAYOFFS: snapshot for a week (seeds + odds)
SELECT t.name, t.color, ps.wins, ps.losses, ps.points_for, ps.playoff_seed, ps.playoff_odds
FROM playoff_snapshots ps JOIN teams t ON t.id=ps.team_id
WHERE ps.season_id=? AND ps.week_num=? ORDER BY ps.playoff_seed IS NULL, ps.playoff_seed;
-- bracket: matchups WHERE is_playoff=1 (weeks 15-17).

-- PLAYERS: top performers in a week / season leaders
SELECT r.player_name, r.position, r.nfl_team, r.points, t.name tname, t.color
FROM rosters r JOIN teams t ON t.id=r.team_id JOIN weeks w ON w.id=r.week_id
WHERE w.season_id=? AND w.week_num=? AND r.lineup_slot!='BN' ORDER BY r.points DESC LIMIT 25;
-- season leaders: GROUP BY r.espn_player_id, r.player_name, r.position; SUM(r.points) (starters only).

-- TRANSACTIONS
SELECT tx.type, tx.player_name, tx.bid_amount, tx.occurred_at, t.name tname, t.color
FROM transactions tx LEFT JOIN teams t ON t.id=tx.team_id WHERE tx.season_id=? ORDER BY tx.occurred_at DESC;

-- RECORDS
SELECT category, rank, detail, value, player_name FROM records ORDER BY category, rank;
```

> **Predict nuance:** the sample season is fully played, so there are no "upcoming" games. For
> `/predict`, either (a) show the latest week's matchups as *predicted vs actual* (predict from the
> pre-week Elo: `P = 1/(1+10^((away_elo − home_elo)/400))` using `elo_ratings` from the prior week),
> or (b) show a "season complete" state. Option (a) is more interesting — prefer it.

---

## 7. Task list

Legend: `[x]` done · `[ ]` open · `[!]` blocked on ESPN credentials.
Worked roughly in order A → G. Each task lists **Acceptance criteria**.

### Group A — Pipeline finishing (quick warm-up; Python)
- [x] **A1.** Make `ruff check .` clean and `pytest` fully green in `pipeline/`.
  - *Accept:* `ruff check .` → 0 errors; `pytest` → all pass. *(26 tests pass.)*
- [x] **A2.** Add `pipeline/requirements.txt` mirroring pyproject deps (convenience).
- [!] **A3.** *(Blocked on credentials)* Verify `pipeline/fantasynfl/espn.py` against a real league;
  fix field mapping (lineup slots, `proTeam`, `playoff_tier_type`, transactions). Skip if no creds.

### Group B — Web scaffold & design foundation
- [x] **B1.** Scaffold Next.js into `web/`: `pnpm create next-app@latest web --ts --tailwind --app --eslint`
  (accept defaults; App Router). Add deps: `better-sqlite3 @types/better-sqlite3 recharts framer-motion
  lucide-react clsx tailwind-merge class-variance-authority`. Init shadcn/ui (`pnpm dlx shadcn@latest init`,
  new-york). Add the `next.config.ts` change from §3.
  - *Accept:* `pnpm build` succeeds on the default page.
- [x] **B2.** Implement the design system (§4): fonts via `next/font`, Tailwind theme tokens / CSS vars,
  `globals.css` ambient background, base card/button styling.
  - *Accept:* a throwaway page renders the dark theme, fonts, a card, and the ambient bg correctly.
- [x] **B3.** Add shadcn components needed: `button, card, badge, table, tabs, progress, select, tooltip, skeleton, separator`.
- [x] **B4.** Build layout: `app/layout.tsx` + `components/layout/Sidebar.tsx` (10 nav items, icons,
  active highlight) + `components/layout/Topbar.tsx` (league name + season/week selectors).
  - *Accept:* sidebar navigates between placeholder pages; active item highlighted; responsive collapse.

### Group C — Data layer (`web/src/lib/`)
- [x] **C1.** `types.ts` — TS interfaces mirroring the schema (§2) + row types for queries.
- [x] **C2.** `db.ts` — read-only `better-sqlite3` singleton (§3 gotchas).
- [x] **C3.** `queries.ts` — typed functions for each page using the SQL in §6 (e.g. `getRankings(seasonId)`,
  `getMatchups(seasonId, week)`, `getRecap(...)`, `getTrends(...)`, `getTeams(...)`, `getPlayoffs(...)`,
  `getPlayers(...)`, `getTransactions(...)`, `getRecords()`, `getSeasons()`, `getWeeks(seasonId)`).
- [x] **C4.** `format.ts` — helpers (`fmtPts`, `fmtRecord`, `fmtPct`, `fmtDate`, `cn` class merger).
  - *Accept (C1–C4):* a server component can call each query and log typed results without errors.

### Group D — Shared components
- [x] **D1.** `components/charts/`: `EloLineChart`, `PointsTrend`, `WinProbBar`, `Sparkline` (Recharts, themed).
- [x] **D2.** `components/cards/`: `MatchupCard` (two teams, scores, winner highlight), `TeamCard`,
  `AwardBadge` (icon + label per award type), `LuckMeter` (animated gauge −/+, Framer Motion), `StatCard`.
- [x] **D3.** Motion wrappers: page/section reveal, animated `CountUp` number.
  - *Accept:* each component renders with sample props and matches the design system.

### Group E — Core pages (6)
- [x] **E1. `/` Overview** — hero (league name, current/last week, #1 team, top matchup), 3–4 `StatCard`s
  (highest score, closest finish, biggest upset, league avg), sparklines.
- [x] **E2. `/rankings`** — Elo power table (rank, team, rating, movement vs last week) + `EloLineChart`.
- [x] **E3. `/scores`** — week selector + grid of `MatchupCard`s (winner highlighted).
- [x] **E4. `/recap`** — week selector; award badges, top scorer, biggest upset, closest finish,
  `LuckMeter` per team (sorted luckiest→unluckiest).
- [x] **E5. `/trends`** — league `PointsTrend`, per-team trend toggle, streak list, head-to-head matrix.
- [x] **E6. `/predict`** — matchups with `WinProbBar`s (predicted vs actual; see §6 nuance).
- [x] **E7. `/teams` + `/teams/[id]`** — responsive grid of `TeamCard`s; detail page: record, rating,
  SOS rank, playoff odds, season points chart, roster (latest week).
  - *Accept (E1–E7):* each page renders real data from the DB, is responsive, and matches the design.

### Group F — Extra pages (4)
- [x] **F1. `/playoffs`** — standings table with in/out cut line (top 6), odds bars, bracket (weeks 15–17).
- [x] **F2. `/players`** — week selector + top performers table; season leaders by position.
- [x] **F3. `/transactions`** — chronological feed (ADD/DROP chips, player, team, bid, date).
- [x] **F4. `/records`** — grouped record cards (single-game high/low, biggest win, top player game,
  best season, longest streak) — "Hall of Fame" styling.
  - *Accept (F1–F4):* render real data, responsive, on-brand.

### Group G — Polish & verification
- [x] **G1.** Empty states, loading `skeleton`s, error boundary for missing DB, mobile responsive pass.
- [x] **G2.** `pnpm lint` clean and `pnpm build` succeeds (typecheck passes).
- [x] **G3.** Visual QA over all 10 pages against the sample DB (no overflow, consistent spacing, motion smooth).
- [x] **G4.** Add `Dockerfile`/`docker-compose.yml` + a short "deploy & weekly cron" note in README
  (cron runs `python -m fantasynfl ingest` weekly; Next reads the refreshed DB). *(See `DEPLOY.md`.)*
- [!] **G5.** *(When creds available)* run `python -m fantasynfl ingest`, reload the app, confirm pages
  still render with real data.

### Suggested order & dependencies
`A1` → `B1→B4` → `C1→C4` → `D1→D3` → `E1→E7` → `F1→F4` → `G1→G5`.
B/C/D are prerequisites for E/F. Within E and F, pages are independent and parallelizable.

---

## 8. Definition of done (whole feature) — MET

- `pnpm lint` and `pnpm build` pass with zero errors.
- All 10 pages render real data from `data/fantasynfl.db`, are responsive, and follow the design system.
- No DB access in client components; no `any`; named exports only.
- README updated with web run instructions.
- (Stretch) Docker + cron docs added. *(Done — `Dockerfile`, `docker-compose.yml`, `DEPLOY.md`.)*

> Only A3/G5 remain, both gated on real ESPN credentials.

## 9. Risks / things to watch
- **`better-sqlite3` bundling** — must be in `serverExternalPackages`; import only server-side.
- **Tailwind v4 vs v3** — v4 uses CSS `@theme` (no `tailwind.config.ts`); v3 uses the config file.
  Match whichever `create-next-app` gave you; shadcn works with both.
- **Predict page** has no future games in sample data — use the "predicted vs actual" approach (§6).
- **Player identity** — the same `player_name` can recur; group season leaderboards by `espn_player_id`.
- **Don't change the schema** to suit the UI; adapt the queries instead.
