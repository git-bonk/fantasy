# Architecture

A dashboard for a personal 12-team ESPN fantasy football league. A **Python pipeline** scrapes the
league from ESPN (or generates a realistic sample), computes advanced stats, and writes them to
**SQLite**. A **Next.js app** reads that SQLite file (read-only, in server components) and renders
a modern dark dashboard.

The pipeline and the web app communicate **only through the SQLite schema**. They share no code.

```
ESPN Fantasy API ──► pipeline/ (Python) ──► data/fantasynfl.db (SQLite) ──► web/ (Next.js) ──► browser
                     fetch OR sample          raw + precomputed tables        12 pages, dark UI
```

## Repo layout

```
fantasynfl/
├── pipeline/                     # PYTHON
│   ├── pyproject.toml            # deps: espn_api, python-dotenv · dev: pytest, ruff
│   ├── deploy/                   # crontab + entrypoint.sh (Docker cron setup)
│   ├── fantasynfl/
│   │   ├── config.py             # env (.env) loading, DB path resolution
│   │   ├── models.py             # SeasonData + Team/Matchup/RosterPlayer/... dataclasses
│   │   ├── db.py                 # SQLite schema DDL + connect() + store_season()  ← SCHEMA SOURCE OF TRUTH
│   │   ├── sample.py             # synthetic 12-team season generator
│   │   ├── espn.py               # espn_api wrapper → SeasonData (private-league cookie auth)
│   │   ├── ingest.py             # build → store → compute
│   │   ├── cli.py / __main__.py  # `python -m fantasynfl {sample|ingest|compute}`
│   │   └── compute/              # elo, owner_elo, luck, predict, awards, sos, playoffs, records
│   └── tests/                    # pytest (37 tests)
└── web/                          # NEXT.JS (12 pages)
    └── src/
        ├── app/                  # pages: /, rankings, all-time, all-time/[ownerId], scores,
        │                         #   recap, trends, predict, teams, teams/[id], history,
        │                         #   playoffs, players, transactions, records, rivalry
        ├── components/           # charts, cards, layout, motion, ui (shadcn)
        └── lib/                  # db.ts, queries.ts, types.ts, format.ts, recap.ts,
                                  #   resolve-season.ts, season-context.tsx, use-media-query.ts
```

## Data contract (SQLite)

Defined in `pipeline/fantasynfl/db.py`.

**Raw tables** (written on ingest): `seasons`, `owners`, `teams`, `weeks`, `matchups`,
`rosters`, `transactions`. `teams.owner_id` references `owners(id)` (nullable — an ownerless
team has `NULL`).

**Precomputed tables** (written by compute): `elo_ratings`, `owner_elo`, `luck`, `awards`,
`sos`, `playoff_snapshots`, `records`

**Two rating tiers:**
- `elo_ratings` — per-**team**, per-season power rating (resets each season). Drives
  "Season Power Rankings" (`/rankings`).
- `owner_elo` — per-**owner** running Elo that carries across seasons (keyed by ESPN member
  id via `owners`). Drives "All-Time Rankings" (`/all-time`).

**Invariant:** a team's matchup score == sum of its STARTER roster points that week
(starter slots: `QB, RB, WR, TE, FLEX, K, DEF`; bench = `BN`).

## Owner/team obfuscation

Identities are obfuscated site-wide by default; there is no exempt page. While locked, real
owner names, ESPN owner ids, and team names/abbrevs are **never sent to the client** — they are
absent from the DOM and from inspect. NFL player names stay public.

- **Pseudonymization** — neutral aliases `Owner N` / `Team N`. The number is `owners.alias_num`;
  a team inherits its owner's number ("Team 3" is owned by "Owner 3"). `assign_owner_aliases()`
  (in `db.py`, called from `store_owners`) is idempotent: it numbers unnumbered owners in
  `sorted(owner_id)` order from `max(alias_num)+1`.
- **Enforcement** — a query-level transform in `web/src/lib/queries.ts` masks the identity fields
  when locked. Masking lives in the server-only data layer, so it cannot be bypassed client-side.
- **Reveal** — passcode-gated (`REVEAL_PASSCODE`). `unlock(passcode)` and `setReveal(on)`
  (`web/src/lib/actions.ts`) set HMAC-signed `HttpOnly` `unlocked` / `reveal` cookies via
  `REVEAL_SECRET` — a plain cookie is forgeable in DevTools, so the signature is what enforces it.
  `getRevealState()` (`web/src/lib/reveal.ts`) returns true only when unlocked **and** the toggle is
  on. A site-wide `RevealToggle` in the Topbar drives it; the client follows with `router.refresh()`.
- **Env** — `REVEAL_PASSCODE` / `REVEAL_SECRET` are wired in `web/.env.example` and `docker-compose.yml`.

The query transform (J2) and the alias UI wiring (L2) above describe the designed model and may
still be in progress; the schema field, cookie signing, server actions, and toggle are in place.

## Pipeline

1. **Source → `SeasonData`.** Either `sample.py` (synthetic) or `espn.py` (real ESPN via
   `espn_api`, private-league cookie auth) produces a `SeasonData`. The two are interchangeable.
2. **Store.** `db.store_season()` writes raw rows (idempotent — clears the season first),
   including `owners` and each team's `owner_id`.
3. **Compute.** `compute.compute_all()` runs the per-season modules and writes their
   precomputed tables. After all seasons are computed, `compute_owner_elo_all()` runs a
   separate **cross-season** pass (seasons in year order) to write `owner_elo`, since
   carryover needs prior seasons committed first.

### Compute algorithms

- **Elo (per-team power rating)** — 538-style margin-of-victory. Start 1500, K=32,
  `expected = 1/(1+10^((opp−self)/400))`, MOV multiplier `ln(|margin|+1)·2.2/((winner_elo_diff·0.001)+2.2)`.
  Snapshot per team per week. Resets each season.
- **Owner Elo (running, cross-season)** — same formula keyed by **owner** (via a
  `team_id → owner_id` map). Carries across seasons: each owner's season seed regresses
  toward 1500 — `1500 + 0.75·(prev_season_final − 1500)`; new owners start at 1500.
- **Luck** — per team-week, `expected = fraction of other 11 teams outscored`;
  `luck = actual_wins − expected_wins`.
- **Predict** — `P(win) = 1/(1+10^((opp_elo−elo)/400))`.
- **Awards** — per week: TOP_SCORE, BIGGEST_BUST, CLOSEST_FINISH, BIGGEST_UPSET, LUCKIEST, TOP_PLAYER.
- **SOS** — cumulative average opponent points-for; ranked 1 (hardest)…12.
- **Playoffs** — standings (W/L/T, PF/PA), seeding, Monte-Carlo odds (2000 sims).
- **Records** — cross-season extremes, top 5 per category.

## Web

Next.js 16 (App Router) + TypeScript (strict) + Tailwind v4 + shadcn/ui + Recharts + Framer Motion.

- DB access: `better-sqlite3`, read-only, server components only (never client).
- Season/week resolution: cookie-based server defaults + URL search params, managed via
  `season-context.tsx` (client) and `resolve-season.ts` (server).
- Global year/week selector lives in the top bar (`TopbarControls`); pages read the resolved
  context rather than rendering their own selectors.

## Run

```bash
# Pipeline
cd pipeline && python3 -m venv .venv && . .venv/bin/activate && pip install -e ".[dev]"
python -m fantasynfl sample      # → ../data/fantasynfl.db
pytest                           # tests
ruff check . && ruff format .    # lint

# Web
cd web && pnpm install && pnpm dev   # http://localhost:3000
```
