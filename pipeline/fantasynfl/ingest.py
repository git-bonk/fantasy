"""High-level ingestion: resumable ESPN ingest with per-week DB writes and progress logging.

The ESPN ingest writes data to the database as it fetches each week, so:
- Progress is visible via `fantasynfl status`
- If interrupted, re-running resumes from the last completed week
- Errors are logged immediately if the API stalls
"""

from __future__ import annotations

import logging
import sys
import time
from pathlib import Path

from .compute import compute_all, compute_owner_elo_all
from .config import Config
from .db import (
    clear_season,
    clear_season_data,
    connect,
    ensure_season,
    get_completed_weeks,
    init_db,
    store_owners,
    store_season,
    store_teams,
    store_transactions,
    store_week,
)
from .models import SeasonData

log = logging.getLogger("fantasynfl.ingest")

# If no week completes within this window, log a stall warning
STALL_WARN_SECONDS = 120


def _setup_logging(verbose: bool = False) -> None:
    level = logging.DEBUG if verbose else logging.INFO
    logging.basicConfig(
        level=level,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        datefmt="%H:%M:%S",
        stream=sys.stderr,
    )


def _ingest_one(db_path: Path, season: SeasonData, sims: int = 2000) -> None:
    conn = connect(db_path)
    try:
        init_db(conn)
        season_id = store_season(conn, season)
        n_playoff = int(season.settings.get("playoff_teams", 6))
        compute_all(conn, season_id, n_playoff=n_playoff, sims=sims)
        compute_owner_elo_all(conn)
    finally:
        conn.close()


def ingest_sample(db_path: Path, year: int = 2025, seed: int = 42, sims: int = 2000) -> None:
    from .sample import generate_season

    season = generate_season(year=year, league_id="sample", seed=seed)
    _ingest_one(db_path, season, sims=sims)
    print(f"Sample season {year} ingested -> {db_path}")


def ingest_espn(config: Config, sims: int = 2000, verbose: bool = False) -> None:
    """Resumable ESPN ingest: fetches week-by-week, writes to DB incrementally."""
    _setup_logging(verbose)
    from .espn import ESPNClient

    if not config.seasons:
        raise RuntimeError("No SEASONS configured in .env")

    conn = connect(config.db_path)
    init_db(conn)

    for year in config.seasons:
        log.info("=" * 60)
        log.info("Ingesting season %d (league %s)", year, config.league_id)
        log.info("=" * 60)

        client = ESPNClient(config.league_id, year, config.espn_s2, config.swid)

        # --- Phase 1: Teams ---
        settings = client.get_settings()
        season_id = ensure_season(conn, year, config.league_id, settings)
        clear_season_data(conn, season_id)  # wipe old data so re-ingest is clean
        teams, owners = client.fetch_teams()
        store_owners(conn, owners, season_id)
        team_row_id = store_teams(conn, season_id, teams)
        log.info("Teams stored (%d teams, %d owners)", len(teams), len(owners))

        # --- Phase 2: Weeks (resumable) ---
        completed = get_completed_weeks(conn, season_id)
        if completed:
            log.info(
                "Resuming: %d week(s) already in DB (%s), skipping them",
                len(completed), ", ".join(str(w) for w in sorted(completed)),
            )

        week_num = 1
        weeks_stored = 0
        last_progress_time = time.monotonic()
        max_weeks = 25  # safety cap (NFL regular + playoffs ~ 22)

        while week_num <= max_weeks:
            if week_num in completed:
                week_num += 1
                continue

            # Stall detection: warn if no progress for a while
            elapsed_since_progress = time.monotonic() - last_progress_time
            if elapsed_since_progress > STALL_WARN_SECONDS:
                log.warning(
                    "No progress for %.0fs - ESPN API may be slow or stalled "
                    "(last completed: week %d)",
                    elapsed_since_progress,
                    week_num - 1 if weeks_stored else 0,
                )
                last_progress_time = time.monotonic()  # reset so we warn again later

            try:
                result = client.fetch_week(week_num)
            except RuntimeError as exc:
                if week_num == 1 and weeks_stored == 0:
                    # First week failed — season likely hasn't started yet
                    log.warning(
                        "Season %d appears unavailable (week 1 failed: %s). "
                        "Skipping — the season may not have started yet.",
                        year, exc,
                    )
                    break
                log.error("Fatal API error on week %d: %s", week_num, exc)
                log.error("Progress saved. Re-run to resume from week %d.", week_num)
                conn.close()
                raise

            if result is None:
                log.info("No more weeks after week %d - season complete", week_num - 1)
                break

            week_info, matchups, rosters = result
            store_week(conn, season_id, team_row_id, week_info, matchups, rosters)
            weeks_stored += 1
            last_progress_time = time.monotonic()
            log.info(
                "[PROGRESS] Season %d: week %d stored (%d matchups, %d roster entries)",
                year, week_num, len(matchups),
                sum(len(r.players) for r in rosters),
            )
            week_num += 1

        # --- Phase 3: Transactions ---
        log.info("Fetching transactions...")
        transactions = client.fetch_transactions(teams)
        store_transactions(conn, season_id, team_row_id, transactions)

        # --- Phase 4: Compute stats ---
        log.info("Computing stats (Elo, luck, SoS, awards, playoff odds)...")
        n_playoff = int(settings.get("playoff_teams", 6))
        compute_all(conn, season_id, n_playoff=n_playoff, sims=sims)
        log.info("Season %d fully ingested and computed.", year)

    # --- Phase 5: Running cross-season owner Elo (global pass) ---
    log.info("Computing running cross-season owner Elo...")
    compute_owner_elo_all(conn)

    conn.close()
    log.info("All seasons complete. DB: %s", config.db_path)


def recompute(db_path: Path, sims: int = 2000) -> None:
    conn = connect(db_path)
    try:
        init_db(conn)
        seasons = conn.execute(
            "SELECT id, settings_json FROM seasons ORDER BY year"
        ).fetchall()
        for row in seasons:
            import json

            settings = json.loads(row["settings_json"])
            n_playoff = int(settings.get("playoff_teams", 6))
            compute_all(conn, row["id"], n_playoff=n_playoff, sims=sims)
        compute_owner_elo_all(conn)
    finally:
        conn.close()
    print(f"Recomputed stats for {len(seasons)} season(s).")


def show_status(db_path: Path) -> None:
    """Print ingest progress for all seasons in the DB."""
    conn = connect(db_path, readonly=True)
    try:
        init_db(conn)
        seasons = conn.execute(
            "SELECT id, year, league_id, created_at FROM seasons ORDER BY year"
        ).fetchall()
        if not seasons:
            print("No seasons in database.")
            return

        for s in seasons:
            season_id = s["id"]
            weeks = conn.execute(
                "SELECT week_num, label, is_playoff FROM weeks WHERE season_id = ? ORDER BY week_num",
                (season_id,),
            ).fetchall()
            teams = conn.execute(
                "SELECT COUNT(*) as cnt FROM teams WHERE season_id = ?", (season_id,)
            ).fetchone()["cnt"]
            matchups = conn.execute(
                "SELECT COUNT(*) as cnt FROM matchups m JOIN weeks w ON w.id = m.week_id "
                "WHERE w.season_id = ?", (season_id,)
            ).fetchone()["cnt"]
            has_elo = conn.execute(
                "SELECT COUNT(*) as cnt FROM elo_ratings WHERE season_id = ?", (season_id,)
            ).fetchone()["cnt"]

            print(f"\nSeason {s['year']} (league: {s['league_id']})")
            print(f"  Created: {s['created_at']}")
            print(f"  Teams: {teams}")
            print(f"  Weeks: {len(weeks)} ({', '.join(w['label'] for w in weeks)})")
            print(f"  Matchups: {matchups}")
            print(f"  Stats computed: {'yes' if has_elo > 0 else 'no'}")

            # Detect incomplete seasons (sample data or partial ingest)
            if s["league_id"] == "sample":
                print(f"  Status: SAMPLE DATA (not real league)")
            elif len(weeks) < 14:
                print(f"  Status: INCOMPLETE ({len(weeks)}/~18 weeks ingested)")
            else:
                print(f"  Status: COMPLETE")
    finally:
        conn.close()
