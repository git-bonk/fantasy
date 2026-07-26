# fantasynfl

A beautiful, data-rich dashboard for your ESPN fantasy football league.

It scrapes your league's data from ESPN, computes power rankings (Elo), a luck meter,
matchup predictions, weekly awards, strength-of-schedule, playoff odds, all-time records,
and a running cross-season Elo for every owner — then presents it all in a clean, modern
dark dashboard.

## Features

- **Season Power Rankings** — per-team Elo ratings that react to margin of victory and opponent strength
- **All-Time Rankings** — a running Elo keyed by owner that carries across seasons, with career records and per-owner detail
- **Luck Meter** — how much your record over/under-performed your scoring
- **Predict** — Elo-based win probabilities for each matchup
- **Recap** — weekly summary with top scorer, biggest upset, closest finish, and award badges
- **Trends** — points over time, streaks, head-to-head matrix
- **Teams & League History** — per-week standings and every owner who's ever fielded a team
- **Playoffs** — live standings, seeds, Monte-Carlo playoff odds, and bracket
- **Players** — weekly top performers and season leaders
- **Transactions** — the league's move history
- **Records** — all-time single-game highs/lows, best/worst seasons, Hall of Fame

## Quickstart

### 1. Generate a sample database (no ESPN account needed)

```bash
cd pipeline
python3 -m venv .venv && . .venv/bin/activate
pip install -e ".[dev]"
python -m fantasynfl sample      # writes ../data/fantasynfl.db
```

### 2. Run the dashboard

```bash
cd web
pnpm install
pnpm dev                          # http://localhost:3000
```

### 3. Use your real league (optional)

Copy `.env.example` to `.env` and fill in your ESPN league ID and cookies
(`espn_s2`, `SWID`) from your browser while logged into ESPN. Then:

```bash
cd pipeline && . .venv/bin/activate
python -m fantasynfl ingest       # pulls your real league into the DB
```

See [PLAN.md](./PLAN.md) for full architecture and design notes.

## Deploy (Docker) & weekly cron

The whole stack runs as two containers that share a `league-data` volume holding
`fantasynfl.db`:

- **`web`** — the Next.js dashboard (reads the DB read-only via `DB_PATH`).
  The build stage installs `python3`, `make`, and `g++` to compile the native
  `better-sqlite3` module; these are discarded before the final slim image.
- **`pipeline`** — a `cron` daemon that refreshes the DB from ESPN **weekly**
  (Mondays 06:00) by running `fantasynfl ingest`. On first boot, if no DB exists,
  it seeds a sample season so the dashboard has data immediately.
- **`tunnel`** — a `cloudflare/cloudflared` container that provides HTTPS via a
  Cloudflare Tunnel. No inbound ports are exposed; the tunnel dials out.

```bash
cp .env.example .env              # fill in ESPN_LEAGUE_ID, ESPN_S2, SWID
docker compose up --build -d      # dashboard at http://localhost:3000
```

The Next app reads the DB straight off the shared volume, so each weekly ingest is
reflected on the next page load — no redeploy needed.

```bash
docker compose logs -f pipeline   # watch ingest/cron output
docker compose exec pipeline fantasynfl ingest   # trigger a manual refresh
```

> Without `.env` credentials the pipeline container seeds sample data instead of
> ingesting a real league.
