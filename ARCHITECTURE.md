# Architecture

A dashboard for a personal 12-team ESPN fantasy football league. A **Python pipeline** scrapes the
league from ESPN (or generates a realistic sample), computes advanced stats, and writes them to
**SQLite**. A **Next.js app** reads that SQLite file (read-only, in server components) and renders
a modern dark dashboard.

The pipeline and the web app communicate **only through the SQLite schema**. They share no code.

```
ESPN Fantasy API ──► pipeline/ (Python) ──► data/fantasynfl.db (SQLite) ──► web/ (Next.js) ──► browser
                     fetch OR sample          raw + precomputed tables        10 pages, dark UI
```

## Repo layout

```
fantasynfl/
├── README.md  PLAN.md  AGENTS.md  ARCHITECTURE.md  TASKS.md  .gitignore  .env.example
├── data/fantasynfl.db            # generated SQLite (gitignored)
├── pipeline/                     # PYTHON — DONE
│   ├── pyproject.toml            # deps: espn_api, python-dotenv · dev: pytest, ruff
│   ├── fantasynfl/
│   │   ├── config.py             # env (.env) loading, DB path resolution
│   │   ├── models.py             # SeasonData + Team/Matchup/RosterPlayer/... dataclasses
│   │   ├── db.py                 # SQLite schema DDL + connect() + store_season()  ← SCHEMA SOURCE OF TRUTH
│   │   ├── sample.py             # synthetic 12-team season generator
│   │   ├── espn.py               # espn_api wrapper → SeasonData (needs creds; untested live)
│   │   ├── ingest.py             # build → store → compute
│   │   ├── cli.py / __main__.py  # `python -m fantasynfl {sample|ingest|compute}`
│   │   └── compute/              # elo, luck, predict, awards, sos, playoffs, records, __init__
│   └── tests/                    # pytest
└── web/                          # NEXT.JS — TO BE BUILT (see TASKS.md)
```

## Data contract (SQLite)

Defined in `pipeline/fantasynfl/db.py`. **Raw** tables (written on ingest): `seasons`, `teams`,
`weeks`, `matchups`, `rosters`, `transactions`. **Precomputed** tables (written by compute):
`elo_ratings`, `luck`, `awards`, `sos`, `playoff_snapshots`, `records`.

**Invariant:** a team's matchup score == sum of its STARTER roster points that week
(starter slots: `QB, RB, WR, TE, FLEX, K, DEF`; bench = `BN`).

See `TASKS.md §Quick Reference` for the full column-by-column schema.

## Pipeline (Python) — how it works

1. **Source → `SeasonData`.** Either `sample.py` (synthetic) or `espn.py` (real ESPN via
   `espn_api`, private-league cookie auth) produces a `SeasonData` (teams, weeks, matchups,
   rosters, transactions, settings). The two are interchangeable.
2. **Store.** `db.store_season()` writes raw rows (idempotent — clears the season first).
3. **Compute.** `compute.compute_all()` runs every module and writes precomputed tables.

### Compute algorithms
- **Elo** (`elo.py`): 538-style margin-of-victory Elo. Start 1500, K=32,
  `expected = 1/(1+10^((opp−self)/400))`, MOV multiplier `ln(|margin|+1)·2.2/((winner_elo_diff·0.001)+2.2)`.
  Snapshot per team per week (rating *after* that week).
- **Luck** (`luck.py`): per team-week, `expected = fraction of the other 11 teams you outscored`;
  summed → expected wins. `luck = actual_wins − expected_wins`. +ve = lucky, −ve = unlucky.
- **Predict** (`predict.py`): `P(win) = 1/(1+10^((opp_elo−elo)/400))`.
- **Awards** (`awards.py`): per week — TOP_SCORE, BIGGEST_BUST, CLOSEST_FINISH, BIGGEST_UPSET
  (winner with biggest pre-game Elo deficit), LUCKIEST (winner with lowest outscored-fraction),
  TOP_PLAYER (highest individual points).
- **SOS** (`sos.py`): cumulative average points scored by opponents faced; ranked 1 (hardest)…12.
- **Playoffs** (`playoffs.py`): standings (W/L/T, PF/PA), seeding by (wins, ties, PF), and
  Monte-Carlo playoff odds (2000 sims of remaining regular-season games using Elo win probs).
- **Records** (`records.py`): cross-season extremes — single-game high/low, biggest win, top
  player game, best season, longest streak. Top 5 per category.

### Sample generator (`sample.py`)
12 themed teams, each with a hidden quality factor (0.82–1.22) and a 16-player roster. Weekly
points = `gauss(base·talent·quality, base·0.45)`. Starters = best at each slot; team score = sum
of the 9 starters (invariant holds by construction). 14 regular weeks (round-robin + rematches)
+ a top-6 playoff bracket (weeks 15–17). ~40 transactions. Deterministic seed (42).

## Web (Next.js) — to be built

Next.js 15 (App Router) + TypeScript + Tailwind + shadcn/ui + Recharts + Framer Motion. Reads the
SQLite DB read-only via `better-sqlite3` in **server components only** (never client). 10 pages:
overview, rankings, scores, recap, trends, predict, teams (+`[id]`), playoffs, players,
transactions, records. Full spec in `TASKS.md`.

## Run

```bash
# Pipeline
cd pipeline && python3 -m venv .venv && . .venv/bin/activate && pip install -e ".[dev]"
python -m fantasynfl sample      # → ../data/fantasynfl.db
pytest                           # tests
ruff check . && ruff format .    # lint

# Web (once built)
cd web && pnpm install && pnpm dev
```

## Verified state
Sample DB generated: 1 season · 12 teams · 17 weeks · 90 matchups · 2880 roster rows ·
40 transactions · 204 elo · 204 luck · 98 awards · 204 sos · 168 playoff snapshots · 30 records.
Invariant check: 0 mismatches. Tests written (pytest). See `TASKS.md` for what remains.
