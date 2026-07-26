# Fantasy NFL Dashboard

A beautiful, data-rich dashboard for a personal 12-team ESPN fantasy football league.

## Goals

- Polished, modern dark dashboard (Linear/Vercel-style) that makes fantasy data look great
- Data-rich: Elo ratings, luck scores, playoff odds, awards, streaks, predictions
- Shareable: screenshot-worthy recap cards, rivalry pages, trash-talk personality
- Low-maintenance: weekly cron ingest, single SQLite file, one-command deploy

## Features

### Core pages
- Overview (hero, stat cards, sparklines)
- Rankings (per-season per-team power table + history chart)
- All-Time (running cross-season owner Elo leaderboard + owner detail)
- Scores (weekly matchup grid with rosters)
- Recap (results with narrative tags, awards, luck meter, shareable card)
- Trends (league/per-team points, streaks, H2H matrix)
- Predict (Elo win-probability vs actual)
- Teams + team detail (record, SOS, odds, roster, season chart; filterable by week)
- League History (every owner who's ever fielded a team, across seasons)
- Playoffs (standings, cut line, odds bars, bracket)
- Players (weekly performers, season leaders by position)
- Transactions (chronological ADD/DROP/TRADE feed)
- Records (Hall of Fame + Shame Corner)

### Engagement features
- Recap performance tags (Upset, Nail-biter, Blowout, Statement, Revenge, Bust, Shootout)
- Streak flames (win/loss badges across the app)
- Shame Corner (worst-of-the-league counterpart to Hall of Fame)
- Shareable recap card (fixed-width, screenshot-ready)
- Rivalry finder (all-time head-to-head with team picker)

### Infrastructure
- Python pipeline: ESPN scrape or sample generation → SQLite
- Owner identity via ESPN's stable member id (persists across seasons)
- Compute: per-team power Elo (538-style MOV) + running cross-season owner Elo
  (regressed carryover), luck, awards, SOS, Monte-Carlo playoff odds, records
- Weekly cron ingest (Monday 06:00)
- Docker Compose deploy with Cloudflare Tunnel (HTTPS, no exposed ports)

### Owner/team obfuscation
- Site-wide identity obfuscation, locked by default (no exempt page); NFL player names stay public
- While locked, real owner names + ESPN owner ids + team names/abbrevs are never sent to the client
  (absent from DOM/inspect) — enforced by a server-only query transform, not bypassable client-side
- Neutral aliases `Owner N` / `Team N`; number = `owners.alias_num`, a team inherits its owner's
  number; assigned idempotently by `assign_owner_aliases()` (sorted(owner_id), from max+1)
- Passcode-gated reveal (`REVEAL_PASSCODE`): HMAC-signed HttpOnly `unlocked` + `reveal` cookies
  (`REVEAL_SECRET`) via `unlock()` / `setReveal()`; `getRevealState()` is true only when unlocked
  and the toggle is on; site-wide `RevealToggle` in the Topbar, client follows with `router.refresh()`
- Env wired in `web/.env.example` + `docker-compose.yml`
