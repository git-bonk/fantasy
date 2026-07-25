# TASKS — Fantasy NFL Dashboard (Engagement Features)

> **For an independent agent.** This file is self-contained. Read `ARCHITECTURE.md` and
> `PLAN.md` for background, and `TASKS.md` for the design system / conventions that are
> still in force. The Python pipeline and the base 10-page dashboard are **DONE**.
> Your job: add **5 engagement features** to the existing `web/` Next.js app.
>
> **Do NOT modify the pipeline or the DB schema.** All features below are derivable from
> the existing SQLite tables. Treat `data/fantasynfl.db` as read-only input.

---

## 0. Mission & current state

- **Done:** Python pipeline → `data/fantasynfl.db`, and a 10-page dark dashboard (`web/`).
- **Your job:** make the dashboard *fun* and *shareable*. Five features, in priority order:
  - **A. Recap Results + Performance Tags** (the explicit ask) — show every matchup on `/recap` with a narrative tag (Upset, Blowout, Nail-biter, …).
  - **B. Streak Flames** — fire/snowflake badges for active win/loss streaks.
  - **C. Shame Corner** — a mocking "worst of the league" section on `/records`.
  - **D. Shareable Recap Card** — a screenshot-worthy weekly summary card.
  - **E. Rivalry Finder** — pick any two teams, see their all-time head-to-head.

The goals are **delight** and **shareability**. Lean into sports-product energy: big numbers,
team colors, motion, a bit of trash-talk personality. But stay on the established design system.

---

## 1. Quick reference — commands

```bash
# Web app (all work happens here)
cd web
pnpm install
pnpm dev          # http://localhost:3000
pnpm build        # production build (also typechecks)
pnpm lint         # eslint

# Regenerate sample DB ONLY if data/fantasynfl.db is missing:
cd pipeline && .venv/bin/python -m fantasynfl sample
```

---

## 2. Quick reference — conventions & design system (still in force)

- Strict TypeScript; **no `any`**, no `@ts-ignore`. **Named exports only**, `const` by default, early returns.
- DB access only in `lib/` + server components. Client components receive props.
- Queries live in `web/src/lib/queries.ts`; row types in `web/src/lib/types.ts`.
- **Design system:** base `zinc-950` bg; cards `border border-zinc-800 bg-zinc-900/60 rounded-xl`;
  hover `border-zinc-700` + slight lift. Accents: **emerald-500** primary, **amber-400** secondary,
  per-team `color` from the DB for team-specific chips. Positive emerald-500, negative rose-500,
  muted text `zinc-400`/`zinc-500`. Numbers: `font-mono tabular-nums`. Headline numbers big & bold
  (`font-display`). Motion via the existing `Reveal` / `Stagger` / `StaggerItem` / `CountUp` wrappers.
- Respect `prefers-reduced-motion` (existing motion components already handle it — reuse them,
  don't hand-roll new animation branching).

---

## 3. Existing building blocks — REUSE, don't reinvent

**Queries (`web/src/lib/queries.ts`)** you will use:
- `getMatchups(seasonId, weekNum)` → `MatchupRow[]` (both teams joined: `hid/hname/habb/hcolor`, `aid/aname/aabb/acolor`, scores, `winner_team_id`)
- `getPredictData(seasonId, weekNum)` → `PredictMatchupRow[]` — same as MatchupRow **plus `h_elo`/`a_elo`** (pre-week Elo, null for week 1)
- `getRecapAwards(seasonId, weekNum)` → `RecapAwardRow[]`
- `getRecapLuck(seasonId, weekNum)` → `LuckRow[]`
- `getTopPerformers(seasonId, weekNum)` → `PlayerRow[]` (starters, sorted desc)
- `getStreaks(seasonId)` → `{ team_id, name, color, streak, type: "W"|"L" }[]` (current streaks ≥ 2, regular season)
- `getTeams(seasonId)`, `getTeam(seasonId, teamId)`, `getWeeks(seasonId)`, `getMaxWeek`, `getMaxRegularWeek`, `getLatestSeasonId`, `getRecords()`, `getEloHistory(seasonId)`

**Components:** `MatchupCard`, `AwardBadge`, `LuckMeter`, `StatCard`, `PageHeader`, `WeekSelector`,
`Reveal/Stagger/StaggerItem/AnimatedRow`, `CountUp`, `RecordCategory`, `StandingsTable`, `TeamCard`,
`WinProbBar`, `ChartTooltip`. All in `web/src/components/`.

**Helpers:** `cn` (`@/lib/utils`), `fmtPts/fmtRecord/fmtPct/fmtDate` (`@/lib/format`).

---

## Feature A — Recap Results + Performance Tags  *(the explicit ask — do first)*

`/recap` currently shows only Awards + Luck Meter. Add a **Results** section that shows **every
matchup** for the selected week, each tagged with a single narrative "performance tag".

### A1. Types (`web/src/lib/types.ts`)
```ts
export type MatchupTag =
  | "UPSET" | "NAIL_BITER" | "BLOWOUT" | "STATEMENT"
  | "REVENGE" | "BUST" | "SHOOTOUT";

export interface RecapMatchupRow extends MatchupRow {
  tag: MatchupTag | null;
}

export interface SeasonMatchupRow {
  week_num: number;
  home_team_id: number;
  away_team_id: number;
  winner_team_id: number | null;
}

export interface EloAtWeekRow { team_id: number; rating: number; }
```

### A2. Queries (`web/src/lib/queries.ts`)
```ts
export function getSeasonMatchups(seasonId: number): SeasonMatchupRow[]
// SELECT w.week_num, m.home_team_id, m.away_team_id, m.winner_team_id
// FROM matchups m JOIN weeks w ON w.id = m.week_id
// WHERE w.season_id = ? AND w.is_playoff = 0 ORDER BY w.week_num

export function getEloAtWeek(seasonId: number, weekNum: number): EloAtWeekRow[]
// SELECT team_id, rating FROM elo_ratings WHERE season_id = ? AND week_num = ?
```

### A3. Tag logic — new file `web/src/lib/recap.ts`
Export `getRecapMatchups(seasonId, weekNum): RecapMatchupRow[]`.
Gather: this week's matchups (`getPredictData` — gives pre-week elo), weekly league average
(mean of all 12 team scores that week), max combined score that week, top-4 team ids by pre-week
Elo (`getEloAtWeek(seasonId, weekNum - 1)`), and all earlier-season matchups (`getSeasonMatchups`).

Centralize thresholds as a `const TAG_THRESHOLDS` object so they're easy to tune:
```ts
const TAG_THRESHOLDS = {
  nailBiterMargin: 5,     // margin <= this
  blowoutMargin: 30,      // margin >= this
  statementMargin: 15,    // margin >= this AND both teams top-4 elo
  statementTopN: 4,
  bustFraction: 0.85,     // winner scored < this fraction of weekly avg
};
```

Assign **exactly one tag** per matchup — the **first** rule that matches wins (priority order).
Ties (`winner_team_id === null`) get `null`. Use pre-week Elo from `getPredictData`.
1. **UPSET** — winner's pre-week Elo < loser's pre-week Elo (both non-null).
2. **NAIL_BITER** — margin ≤ `nailBiterMargin`.
3. **BLOWOUT** — margin ≥ `blowoutMargin`.
4. **STATEMENT** — both teams in the pre-week top-`statementTopN` by Elo AND margin ≥ `statementMargin`.
5. **REVENGE** — the same two teams played earlier this season (regular season) and the winner of *this* game *lost* that earlier game.
6. **BUST** — the winner's score < `bustFraction` × weekly league average.
7. **SHOOTOUT** — this game has the highest combined score of the week.
8. Otherwise `null`.

### A4. Tag presentation — new component `web/src/components/cards/MatchupTagBadge.tsx`
A small pill: icon + label. Color/icon map (keep distinct):
| tag | label | icon | color |
|---|---|---|---|
| UPSET | Upset | Zap | #f97316 |
| NAIL_BITER | Nail-biter | Scale | #38bdf8 |
| BLOWOUT | Blowout | Flame | #f43f5e |
| STATEMENT | Statement | Crown | #fbbf24 |
| REVENGE | Revenge | RotateCcw | #a855f7 |
| BUST | Bust | ThumbsDown | #ef4444 |
| SHOOTOUT | Shootout | TrendingUp | #10b981 |

Style like `AwardBadge`'s icon chip: `bg ${color}1a`, text `color`, `text-[10px] font-bold uppercase tracking-wider`, rounded.

### A5. Add tag to `MatchupCard`
Add an **optional** `tag?: MatchupTag | null` prop to `MatchupCard`. When present, render
`MatchupTagBadge` in the top-right corner of the card (absolute, or a slim header row). The
`/scores` page does **not** pass a tag (unchanged). Keep `MatchupCard` a server component.

### A6. Integrate into `/recap` (`web/src/app/recap/page.tsx`)
Add a **Results** section as the **first** section (above Awards). Header: "Results" (small-caps,
matching the existing Awards header style). Render `RecapMatchupRow[]` via `MatchupCard` in the
same responsive grid the `/scores` page uses (`grid-cols-1 sm:grid-cols-2 xl:grid-cols-3`), wrapped
in `Stagger`/`StaggerItem`. Empty state if no matchups.

**Accept (A):** `/recap?week=N` shows all matchups for week N, each with at most one tag; tags are
correct per the rules; `/scores` is unchanged; no `any`; `pnpm build` + `pnpm lint` clean.

---

## Feature B — Streak Flames

Show an active win/loss streak badge next to team names across the app.

### B1. Component `web/src/components/cards/StreakBadge.tsx`
```ts
interface StreakBadgeProps { streak: number; type: "W" | "L"; className?: string; }
```
- Return `null` if `streak < 2`.
- Win: `Flame` icon, amber/orange (`text-amber-500`), label `W{streak}`.
- Loss: `Snowflake` icon, sky (`text-sky-400`), label `L{streak}`.
- Compact pill: `inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-mono text-[11px] font-bold tabular-nums` with a tinted bg (`bg-amber-500/10` / `bg-sky-500/10`).
- For `streak >= 4`, add a subtle glow/ring to make it feel earned (e.g. `ring-1 ring-amber-500/40`).
- Server component (no hooks) is fine.

### B2. Wire streak data through
`getStreaks(seasonId)` returns current streaks. Build a `Map<number, {streak, type}>` in the pages
below and pass an optional `streak` into each component (components render nothing when absent):
- **`TeamCard`** — add optional `streak?: {streak:number; type:"W"|"L"}` prop; render `StreakBadge` next to the team name. Update `/teams` page to build the map and pass it.
- **`StandingsTable`** — add optional `streaks?: Map<number, {streak:number; type:"W"|"L"}>` prop; render a `StreakBadge` beside each team name. Update `/playoffs` page to pass it.
- **`/teams/[id]`** — show the team's `StreakBadge` in the header row (near the playoff-seed badge).

**Accept (B):** Flame/snowflake badges appear on `/teams`, `/playoffs` standings, and team detail for
teams with streaks ≥ 2; teams without streaks show nothing; existing layouts don't break.

---

## Feature C — Shame Corner

A mocking "worst of the league" counterpart to the Hall of Fame, appended to `/records`.

### C1. Query — `web/src/lib/queries.ts` → `getShameData(seasonId)`
Compute in TS from matchups + luck (follow the pattern of `getStreaks`/`getHeadToHead`). Return:
```ts
export interface ShameItem {
  kind: "BIGGEST_LOSS" | "LOWEST_SCORE" | "LONGEST_LOSING_STREAK" | "UNLUCKIEST" | "CHEAPEST_WIN";
  label: string;        // e.g. "Biggest Loss"
  headline: string;     // e.g. "Fumble Nation lost by 52.0"
  value: number;        // the number to feature
  suffix: string;       // e.g. "pt loss", "pts", "straight", "luck"
  teamId: number | null;
  teamName: string;
  color: string;        // team color
  detail: string;       // e.g. "Week 7 vs Sack Pack"
}
export function getShameData(seasonId: number): ShameItem[]
```
Derive (use **all** matchups, regular + playoff — shame knows no bounds):
- **BIGGEST_LOSS** — max `(opp_score − score)`; headline "<Team> lost by X"; detail "Week N vs <Opponent>".
- **LOWEST_SCORE** — min single-game score; "<Team> managed just X pts".
- **LONGEST_LOSING_STREAK** — longest consecutive-loss run per team.
- **UNLUCKIEST** — most negative `luck_score` at the latest regular week (use `getRecapLuck` at `getMaxRegularWeek`, or query `luck` directly); "<Team> was robbed X wins".
- **CHEAPEST_WIN** — winner with the lowest score; "<Team> won with just X pts".

### C2. Component `web/src/components/records/ShameCorner.tsx`
A self-contained section. Title: **"The Shame Corner"** with a `Skull` (or `Ghost`) icon,
subtitle with personality, e.g. *"Every league has one. This is yours."*
- Distinct styling from the Hall of Fame: lean **rose / darker** — e.g. cards
  `border-rose-500/20 bg-rose-950/20` (or a darker zinc with rose accents), rose-400 icons.
- Render the 5 `ShameItem`s as a responsive grid of small cards: big `font-display` value
  (`CountUp`), label, headline, team chip (colored abbrev square), detail line.
- Wrap in `Reveal`/`Stagger`.

### C3. Integrate into `/records` (`web/src/app/records/page.tsx`)
After the Hall of Fame grid, add `<ShameCorner items={getShameData(seasonId)} />`.

**Accept (C):** `/records` shows the Shame Corner below the Hall of Fame with 5 distinct items
computed from real data; rose/dark styling clearly differentiates it; responsive.

---

## Feature D — Shareable Recap Card

A compact, screenshot-worthy card summarizing a week — built to be pasted into the league group chat.

### D1. Component `web/src/components/cards/RecapCard.tsx`
A **fixed-width** card (~`w-[560px]`, `max-w-full`) designed to be screenshotted. Self-contained,
dense, branded. Suggested layout (top → bottom):
1. **Header:** small-caps "FANTASY NFL · {season year}" + big `font-display` week label; subtle
   emerald/amber radial glow background + `border-zinc-800`.
2. **Featured matchup:** the week's highest-combined game — two team abbrev chips (team colors),
   names, big bold scores, winner highlighted.
3. **Awards strip:** compact chips for the week's awards (reuse award icon/color mapping — you can
   import the meta from `AwardBadge` if you export it, or duplicate a small map): icon + label + value.
4. **Stat row:** three mini-stats — Top Scorer (player + pts), Biggest Bust (team + pts), League Avg.
5. **Footer:** "Screenshot this for the group chat" (tiny, `zinc-500`) + league name.

Use team colors throughout. Numbers `font-mono tabular-nums`. This is a **server component**
(no hooks) — it just renders props.

### D2. Integrate into `/recap`
Add a **"Share this week"** section (put it **first**, above Results, or last — your call; recommend
first so it's immediately visible). Render `RecapCard` centered on a slightly darker backdrop with
generous padding so it reads as a discrete card. Assemble its props from the recap page's existing
queries (`getMatchups`, `getRecapAwards`, `getTopPerformers`, weekly avg).

> **Stretch (optional):** a dedicated clean route for screenshots. This requires moving the existing
> pages under a `(dashboard)` route group and adding a `(share)/recap-card/[week]` route with a bare
> layout (no sidebar/topbar). Only attempt if the core card is done and everything builds.

**Accept (D):** `/recap` shows a polished, fixed-width RecapCard for the selected week using real
data; it looks good when screenshotted (no clipped content, balanced spacing); responsive on mobile.

---

## Feature E — Rivalry Finder

Pick any two teams, see their all-time head-to-head with every meeting.

### E1. Query — `web/src/lib/queries.ts`
```ts
export interface RivalryGameRow {
  id: number; week_num: number; label: string; is_playoff: number;
  home_team_id: number; away_team_id: number;
  home_score: number; away_score: number; winner_team_id: number | null;
}
export function getRivalryGames(seasonId: number, a: number, b: number): RivalryGameRow[]
// WHERE w.season_id=? AND ((home_team_id=? AND away_team_id=?) OR (home_team_id=? AND away_team_id=?))
// ORDER BY w.week_num   (params: seasonId, a, b, b, a)
```

### E2. Page `web/src/app/rivalry/page.tsx`
Read `searchParams` `{ a?: string; b?: string }`; default `a=1, b=2`; clamp to valid team ids;
if `a === b`, nudge `b` to a different team. Load both teams (`getTeam`) and `getRivalryGames`.
Derive: wins/losses/ties for team A vs B, current head-to-head streak (team + length), average
margin, total points. Layout:
- **Header:** big "VS" lockup — team A chip+name on the left, team B on the right, a bold
  `font-display` "VS" between them, tinted with each team's color. Below: the series record
  (e.g. "Gladiators lead 2–1") in large type.
- **Stat chips:** H2H streak (with `StreakBadge`-style styling), avg margin, total points.
- **Meetings list:** one row per game — week label (+ playoff badge if `is_playoff`), both
  abbrev/scores with the winner bolded + team color, margin. Wrap in `Reveal`/`Stagger`.
- Empty state if the two teams never played.

### E3. Team picker — `web/src/components/rivalry/RivalryPicker.tsx` (client)
Two `Select`s (Team A / Team B) populated from `getTeams`. On change, `router.push`
`/rivalry?a=<id>&b=<id>` (preserve both params). Prevent selecting the same team twice
(disable the chosen option in the other select). Model it on `WeekSelector`.

### E4. Navigation
- Add to `Sidebar.tsx` `navItems`: `{ href: "/rivalry", label: "Rivalry", icon: Crosshair }`
  (place it after Teams).
- **Bonus:** make the `/trends` Head-to-Head matrix cells clickable — wrap each non-empty cell in a
  `Link` to `/rivalry?a=<rowId>&b=<colId>`.

**Accept (E):** `/rivalry?a=X&b=Y` shows the correct all-time series and every meeting between X and
Y; the picker updates the URL and re-renders; the page is linked from the sidebar; same-team edge
case handled; responsive.

---

## 4. Suggested order & dependencies

`A` → `B` → `C` → `D` → `E`. All five are largely independent; A is the explicit ask and D reuses
A's data, so do A first, then the rest in any order. B's `StreakBadge` is reused by E's header.

## 5. Definition of done (whole feature set)

- `pnpm lint` and `pnpm build` pass with **zero errors**.
- All five features render **real data** from `data/fantasynfl.db`, are responsive, and follow the
  design system (§2).
- No `any`, no `@ts-ignore`, named exports only, no DB access in client components.
- `/scores` page is unchanged; existing pages don't regress.

## 6. Risks / things to watch

- **Pre-week Elo is null for week 1** (`getPredictData` joins `week_num - 1`). UPSET/STATEMENT must
  tolerate null (they simply don't fire for week 1).
- **Ties** (`winner_team_id === null`) — every tag rule that assumes a winner must guard for this.
- **`MatchupCard` is shared** by `/scores` — the new `tag` prop must be optional and default to nothing.
- **Don't change the SQLite schema** — everything here is derivable from existing tables.
- **Motion** — reuse `Reveal`/`Stagger`/`CountUp`; they already handle `prefers-reduced-motion`
  correctly (a hydration fix landed recently — don't reintroduce server/client branching on
  `useReducedMotion` in new components).
- **Team colors** come from the DB; use them for chips/bars, not hardcoded palettes.
