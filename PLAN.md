# Fantasy NFL Dashboard — Build Plan

A beautiful, data-rich dashboard for a personal 12-team ESPN fantasy football league.
Rebuild of a 6-tab Claude artifact (Teams, Weekly Scores, Rankings, Trends, Predict, Recap)
into a cleaner, more aesthetic app — plus 4 extra feature areas.

## Decisions (locked)

| Decision | Choice |
|---|---|
| Data source | ESPN Fantasy API via `espn_api` (private league; `league_id` + `espn_s2` + `SWID`) |
| Data scope | Historical / season-long; import past seasons too |
| Refresh | Weekly batch (cron on VPS) |
| Pipeline | **Python 3** (`espn_api` + built-in `sqlite3`) |
| Frontend | Next.js 15 (App Router), TypeScript, Tailwind, shadcn/ui, Recharts, Framer Motion |
| Storage | SQLite (pipeline writes, Next server components read via `better-sqlite3`) |
| Hosting | VPS / server |
| Aesthetic | Modern dark dashboard (Linear/Vercel-style), layered ambient bg, motion |
| League size | 12 teams |
| Tabs | Core 6 + Playoffs, Players, Transactions, Records (10 total) |
| Build strategy | Synthetic 12-team sample season first; swap in real ESPN creds later |

## Architecture

```
fantasynfl/
├── pipeline/                # PYTHON
│   ├── pyproject.toml
│   └── fantasynfl/
│       ├── config.py        # env loading
│       ├── db.py            # SQLite schema DDL + writers
│       ├── sample.py        # synthetic 12-team season generator
│       ├── espn.py          # espn_api wrapper -> normalized rows
│       ├── ingest.py        # load -> store -> compute
│       ├── cli.py           # argparse: sample / ingest / compute
│       └── compute/         # elo, luck, predict, awards, sos, playoffs, records
└── web/                     # NEXT.JS (reads SQLite in server components)
    └── src/{app,components,lib}
```

Pipeline and web communicate only through the SQLite schema.

## SQLite schema

Raw: `seasons`, `teams`, `weeks`, `matchups`, `rosters`, `transactions`
Precomputed: `elo_ratings`, `luck`, `awards`, `sos`, `playoff_snapshots`, `records`

Invariant: a team's matchup score == sum of its STARTER roster points that week.

## Compute logic

- **Elo**: start 1500; expected = 1/(1+10^((opp-self)/400)); K=32 with margin-of-victory
  multiplier `ln(margin+1) * 2.2/((elo_diff*0.001)+2.2)`. Snapshot after each week.
- **Luck**: per team-week, `expected = (# of other 11 teams outscored) / 11`;
  sum -> expected_wins; `luck = actual_wins - expected_wins`.
- **Predict**: `P(win) = 1/(1+10^((opp_elo-elo)/400))` for next week.
- **Awards** (per week): TOP_SCORE, BIGGEST_UPSET, CLOSEST_FINISH, LUCKIEST, BIGGEST_BUST, TOP_PLAYER.
- **SOS**: cumulative mean of opponent points-for; rank 1..12.
- **Playoffs**: standings by wins then PF; top-6 seeds; Monte-Carlo (2000 sims) -> odds;
  bracket weeks 15-17 (QF 3v6, 4v5; 1&2 byes).
- **Records**: scan all seasons for extremes; top-N per category.

## Sample generator

- 12 teams (names, owners, abbrevs, colors), hidden strength (0..1) driving scores.
- 14 regular-season weeks (6 matchups each) + playoff weeks 15-17.
- Rosters ~16 players/team/week; starter points summed -> team score (consistent).
- Sprinkle ADD/DROP/trade transactions. Deterministic seeded RNG.

## Web design system

- Dark, layered: zinc-950 bg + subtle field-line/grid pattern + soft radial glows.
  Cards zinc-900/60, border zinc-800, hover lift.
- Accent: emerald-500 primary, amber-400 secondary, per-team colors.
- Type: display "Space Grotesk", body "Manrope", numbers "JetBrains Mono" (tabular).
- Motion: Framer Motion reveals, animated counters, luck-meter gauge, win-prob bars.
- Layout: fixed left sidebar (10 tabs, lucide icons), top bar (league + season + week selectors).

## The 10 pages

`/` overview · `/rankings` · `/scores` · `/recap` · `/trends` · `/predict` ·
`/teams` (+ `/teams/[id]`) · `/playoffs` · `/players` · `/transactions` · `/records`

## Build order

1. Root config + docs
2. Python pipeline: config, db, sample generator, compute modules, CLI
3. Run pipeline -> `data/fantasynfl.db`
4. ESPN client (`espn.py`) for real creds
5. pytest for compute modules
6. Next.js scaffold + dark theme + sidebar + DB reader
7. Core pages, then extra pages
8. Verify: pytest, `pnpm lint`, `pnpm build`, visual pass

## Conventions

- Python: type hints, `ruff`, `pytest`.
- TS: strict, no `any`, named exports, `const`, early returns.
- No secrets in code; creds via `.env`.
- Web reads DB only in server components/lib.
