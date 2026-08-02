"""High-level ingestion: incremental ESPN ingest with per-week DB writes.

After a season's initial full ingest, subsequent runs are incremental: only the
latest week (plus any not-yet-finalized weeks) are re-fetched, and seasons that
ESPN reports as finished are marked complete and skipped entirely. This keeps
API calls to the strict minimum. Use ``ingest --full`` to force a re-scrape.
"""

from __future__ import annotations

import json
import logging
import sys
import time
from pathlib import Path
from typing import Callable

from .compute import compute_all, compute_owner_elo_all, compute_players
from .config import Config
from .db import (
    clear_season_data,
    connect,
    ensure_season,
    finalize_all_weeks,
    get_max_week,
    get_season_status,
    get_unfinalized_weeks,
    init_db,
    set_season_status,
    store_owners,
    store_scheduled_matchups,
    store_season,
    store_teams,
    store_transactions,
    store_week,
)
from .lock import first_kickoff_utc
from .models import SeasonData, Team

log = logging.getLogger("fantasynfl.ingest")


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
        compute_players(conn)
    finally:
        conn.close()


def ingest_sample(
    db_path: Path, year: int = 2025, seed: int = 42, sims: int = 2000, verbose: bool = False
) -> None:
    from .sample import generate_season, store_sample_schedule, store_sample_tokens

    season = generate_season(year=year, league_id="sample", seed=seed)
    _ingest_one(db_path, season, sims=sims)
    conn = connect(db_path)
    try:
        init_db(conn)
        season_id = conn.execute("SELECT id FROM seasons WHERE year = ?", (year,)).fetchone()["id"]
        store_sample_tokens(conn, verbose=verbose)
        store_sample_schedule(conn, season_id, season)
    finally:
        conn.close()
    print(f"Sample season {year} ingested -> {db_path}")


def _season_is_over(teams: list[Team], current_week: int, settings: dict) -> bool:
    """A season is over once ESPN populates ``final_standing`` (post-season).

    Guarded by the regular-season length so a season is never marked complete
    while still in its regular-season weeks (i.e. before ~week 17/18).
    """
    if not any((t.final_standing or 0) > 0 for t in teams):
        return False
    playoff = settings.get("playoff")
    reg = playoff.get("regular_season_weeks") if isinstance(playoff, dict) else None
    if isinstance(reg, int) and current_week < reg:
        return False
    return True


def _finalize_if_over(
    conn, season_id: int, teams: list[Team], current_week: int, settings: dict
) -> None:
    if _season_is_over(teams, current_week, settings):
        finalize_all_weeks(conn, season_id)
        set_season_status(conn, season_id, "complete")
        log.info("Season marked COMPLETE (final standings populated)")


def _compute(conn, season_id: int, settings: dict, sims: int) -> None:
    log.info("Computing stats (Elo, luck, SoS, awards, playoff odds)...")
    n_playoff = int(settings.get("playoff_teams", 6))
    compute_all(conn, season_id, n_playoff=n_playoff, sims=sims)


def _fetch_and_store_weeks(
    conn, client, season_id: int, team_row_id: dict[int, int], weeks, current_week: int, year: int
) -> int:
    """Fetch each week in ``weeks`` and store it. Returns the number stored."""
    stored = 0
    for week_num in sorted(weeks):
        result = client.fetch_week(week_num)
        if result is None:
            log.info("Season %d: week %d returned no data - skipping", year, week_num)
            continue
        week_info, matchups, rosters = result
        finalized = week_num < current_week
        store_week(conn, season_id, team_row_id, week_info, matchups, rosters, finalized=finalized)
        stored += 1
        log.info(
            "[PROGRESS] Season %d: week %d stored (%d matchups, %d roster entries)%s",
            year,
            week_num,
            len(matchups),
            sum(len(r.players) for r in rosters),
            " [finalized]" if finalized else " [live]",
        )
    return stored


def _store_schedule(conn, client, season_id: int, year: int) -> None:
    """Ingest full-season scheduled pairings (free once the league is initialized)."""
    scheduled = client.fetch_schedule()
    store_scheduled_matchups(conn, season_id, scheduled)
    _backfill_kickoffs(conn, season_id, year, {m.week_num for m in scheduled})
    log.info("Season %d: stored %d scheduled matchups", year, len(scheduled))


def _backfill_kickoffs(conn, season_id: int, year: int, weeks: set[int]) -> None:
    """Fill NULL kickoffs with the deterministic fallback rule until real dates land."""
    for week_num in sorted(weeks):
        conn.execute(
            "UPDATE scheduled_matchups SET kickoff = ? "
            "WHERE season_id = ? AND week_num = ? AND kickoff IS NULL",
            (first_kickoff_utc(week_num, year), season_id, week_num),
        )
    conn.commit()


def _ingest_season_full(conn, client, year: int, league_id: str, sims: int) -> None:
    """Initial setup / forced re-scrape: fetch every week up to the current one."""
    log.info("Season %d: FULL ingest", year)
    settings = client.get_settings()
    season_id = ensure_season(conn, year, league_id, settings)
    clear_season_data(conn, season_id)
    teams, owners = client.fetch_teams()
    store_owners(conn, owners)
    team_row_id = store_teams(conn, season_id, teams)
    log.info("Teams stored (%d teams, %d owners)", len(teams), len(owners))
    _store_schedule(conn, client, season_id, year)

    current_week = client.current_week()
    if current_week < 1:
        log.warning("Season %d has no current week - it may not have started yet", year)
    else:
        _fetch_and_store_weeks(
            conn, client, season_id, team_row_id, range(1, current_week + 1), current_week, year
        )

    log.info("Fetching transactions...")
    transactions = client.fetch_transactions(teams)
    store_transactions(conn, season_id, team_row_id, transactions)
    _finalize_if_over(conn, season_id, teams, current_week, settings)
    _compute(conn, season_id, settings, sims)


def _ingest_season_incremental(conn, client, year: int, league_id: str, sims: int) -> None:
    """Refresh only the latest week plus any not-yet-finalized weeks."""
    season_id = conn.execute("SELECT id FROM seasons WHERE year = ?", (year,)).fetchone()["id"]
    settings = client.get_settings()
    ensure_season(conn, year, league_id, settings)
    teams, owners = client.fetch_teams()
    store_owners(conn, owners)
    team_row_id = store_teams(conn, season_id, teams)
    _store_schedule(conn, client, season_id, year)

    current_week = client.current_week()
    fetch_set = set(get_unfinalized_weeks(conn, season_id))
    if current_week >= 1:
        fetch_set.add(current_week)
    fetch_set = {w for w in fetch_set if 1 <= w <= max(current_week, 1)}
    log.info(
        "Season %d: INCREMENTAL (current_week=%d, refreshing %s)",
        year,
        current_week,
        ", ".join(str(w) for w in sorted(fetch_set)) or "nothing",
    )
    if fetch_set:
        _fetch_and_store_weeks(conn, client, season_id, team_row_id, fetch_set, current_week, year)

    log.info("Fetching transactions...")
    transactions = client.fetch_transactions(teams)
    store_transactions(conn, season_id, team_row_id, transactions)
    _finalize_if_over(conn, season_id, teams, current_week, settings)
    _compute(conn, season_id, settings, sims)


def ingest_espn(
    config: Config,
    sims: int = 2000,
    verbose: bool = False,
    full: bool = False,
    only_year: int | None = None,
    client_factory: Callable[[int], object] | None = None,
) -> None:
    """Ingest league data from ESPN, incrementally by default.

    For each configured season:
      - not yet in the DB  -> FULL ingest (initial setup),
      - marked ``complete`` -> skipped (past season) unless ``full=True``,
      - otherwise           -> INCREMENTAL (latest week + unfinalized weeks).

    ``full=True`` forces a complete re-scrape; ``only_year`` limits work to one
    season. ``client_factory`` (year -> client) is injectable for testing.
    """
    _setup_logging(verbose)
    from .espn import ESPNClient

    if not config.seasons:
        raise RuntimeError("No SEASONS configured in .env")
    factory = client_factory or (
        lambda year: ESPNClient(config.league_id, year, config.espn_s2, config.swid)
    )

    conn = connect(config.db_path)
    init_db(conn)

    for year in config.seasons:
        if only_year is not None and year != only_year:
            continue
        log.info("=" * 60)
        log.info("Season %d (league %s)", year, config.league_id)
        log.info("=" * 60)

        status = get_season_status(conn, year)
        if full or status is None:
            mode = "full"
        elif status == "complete":
            log.info("Season %d already complete - skipping (use --full to force)", year)
            continue
        else:
            row = conn.execute("SELECT id FROM seasons WHERE year = ?", (year,)).fetchone()
            mode = "incremental" if get_max_week(conn, row["id"]) else "full"

        client = factory(year)
        if mode == "full":
            _ingest_season_full(conn, client, year, config.league_id, sims)
        else:
            _ingest_season_incremental(conn, client, year, config.league_id, sims)

    log.info("Computing running cross-season owner Elo...")
    compute_owner_elo_all(conn)
    compute_players(conn)
    conn.close()
    log.info("All seasons complete. DB: %s", config.db_path)


def _playoff_start_week(settings: dict) -> int | None:
    """First playoff week number from league settings, or None if unknown."""
    playoff = settings.get("playoff")
    if not isinstance(playoff, dict):
        return None
    start = playoff.get("start_week")
    if isinstance(start, int):
        return start
    reg = playoff.get("regular_season_weeks")
    return reg + 1 if isinstance(reg, int) else None


def backfill(
    config: Config,
    sims: int = 2000,
    verbose: bool = False,
    only_year: int | None = None,
    delay: float = 0.0,
    client_factory: Callable[[int], object] | None = None,
) -> None:
    """One-time targeted backfill for already-ingested seasons.

    Refreshes teams (to capture ``final_standing``/``standing``) and re-fetches
    only the playoff weeks (to capture ``playoff_tier``/``is_playoff``) for each
    configured season, then marks finished seasons complete. Regular-season weeks
    are left untouched, so this is far cheaper than a full re-scrape. ``delay``
    pauses that many seconds between week fetches to go easy on the ESPN API.
    """
    _setup_logging(verbose)
    from .espn import ESPNClient

    if not config.seasons:
        raise RuntimeError("No SEASONS configured in .env")
    factory = client_factory or (
        lambda year: ESPNClient(config.league_id, year, config.espn_s2, config.swid)
    )

    conn = connect(config.db_path)
    init_db(conn)

    for year in config.seasons:
        if only_year is not None and year != only_year:
            continue
        row = conn.execute("SELECT id FROM seasons WHERE year = ?", (year,)).fetchone()
        if row is None:
            log.warning("Season %d not in DB - skipping (run ingest first)", year)
            continue
        season_id = row["id"]
        log.info("=" * 60)
        log.info("Backfilling season %d (league %s)", year, config.league_id)
        log.info("=" * 60)

        client = factory(year)
        settings = client.get_settings()
        ensure_season(conn, year, config.league_id, settings)
        teams, owners = client.fetch_teams()
        store_owners(conn, owners)
        team_row_id = store_teams(conn, season_id, teams)
        current_week = client.current_week()

        start_week = _playoff_start_week(settings)
        if start_week and current_week >= start_week:
            playoff_weeks = list(range(start_week, current_week + 1))
            log.info(
                "Season %d: re-fetching playoff week(s) %s",
                year,
                ", ".join(str(w) for w in playoff_weeks),
            )
            for week_num in playoff_weeks:
                result = client.fetch_week(week_num)
                if result is None:
                    log.info("Season %d: week %d returned no data - skipping", year, week_num)
                    continue
                week_info, matchups, rosters = result
                store_week(
                    conn, season_id, team_row_id, week_info, matchups, rosters, finalized=True
                )
                log.info(
                    "[PROGRESS] Season %d: week %d backfilled (%d matchups)",
                    year,
                    week_num,
                    len(matchups),
                )
                if delay:
                    time.sleep(delay)
        else:
            log.info(
                "Season %d: no playoff weeks to backfill (start=%s, current=%d)",
                year,
                start_week,
                current_week,
            )

        _finalize_if_over(conn, season_id, teams, current_week, settings)
        _compute(conn, season_id, settings, sims)

    log.info("Computing running cross-season owner Elo...")
    compute_owner_elo_all(conn)
    compute_players(conn)
    conn.close()
    log.info("Backfill complete. DB: %s", config.db_path)


def recompute(db_path: Path, sims: int = 2000) -> None:
    conn = connect(db_path)
    try:
        init_db(conn)
        seasons = conn.execute("SELECT id, settings_json FROM seasons ORDER BY year").fetchall()
        for row in seasons:
            import json

            settings = json.loads(row["settings_json"])
            n_playoff = int(settings.get("playoff_teams", 6))
            compute_all(conn, row["id"], n_playoff=n_playoff, sims=sims)
        compute_owner_elo_all(conn)
        compute_players(conn)
    finally:
        conn.close()
    print(f"Recomputed stats for {len(seasons)} season(s).")


def refresh_settings(config: Config) -> None:
    """Re-fetch league settings (playoff format) for each configured season.

    Updates only ``seasons.settings_json`` without re-scraping teams or weeks,
    so it is cheap to run against an already-ingested database. Seasons that are
    not yet in the DB are skipped (run ``ingest`` first).
    """
    _setup_logging(False)
    from .espn import ESPNClient

    if not config.seasons:
        raise RuntimeError("No SEASONS configured in .env")

    conn = connect(config.db_path)
    updated = 0
    try:
        init_db(conn)
        for year in config.seasons:
            row = conn.execute("SELECT id FROM seasons WHERE year = ?", (year,)).fetchone()
            if row is None:
                log.warning("Season %d not in DB - skipping (run ingest first)", year)
                continue
            client = ESPNClient(config.league_id, year, config.espn_s2, config.swid)
            settings = client.get_settings()
            conn.execute(
                "UPDATE seasons SET league_id = ?, settings_json = ? WHERE id = ?",
                (config.league_id, json.dumps(settings), row["id"]),
            )
            conn.commit()
            updated += 1
            log.info("Refreshed settings for %d", year)
    finally:
        conn.close()
    print(f"Refreshed settings for {updated} season(s).")


def show_status(db_path: Path) -> None:
    """Print ingest progress for all seasons in the DB."""
    conn = connect(db_path, readonly=True)
    try:
        init_db(conn)
        seasons = conn.execute(
            "SELECT id, year, league_id, created_at, status FROM seasons ORDER BY year"
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
                "WHERE w.season_id = ?",
                (season_id,),
            ).fetchone()["cnt"]
            has_elo = conn.execute(
                "SELECT COUNT(*) as cnt FROM elo_ratings WHERE season_id = ?", (season_id,)
            ).fetchone()["cnt"]
            finalized = conn.execute(
                "SELECT COUNT(*) as cnt FROM weeks WHERE season_id = ? AND finalized = 1",
                (season_id,),
            ).fetchone()["cnt"]

            print(f"\nSeason {s['year']} (league: {s['league_id']})")
            print(f"  Created: {s['created_at']}")
            print(f"  Teams: {teams}")
            print(f"  Weeks: {len(weeks)} ({', '.join(w['label'] for w in weeks)})")
            print(f"  Weeks finalized: {finalized}/{len(weeks)}")
            print(f"  Matchups: {matchups}")
            print(f"  Stats computed: {'yes' if has_elo > 0 else 'no'}")

            if s["league_id"] == "sample":
                status_line = "SAMPLE DATA (not real league)"
            elif s["status"] == "complete":
                status_line = "COMPLETE"
            elif len(weeks) < 14:
                status_line = f"INCOMPLETE ({len(weeks)}/~18 weeks ingested)"
            else:
                status_line = "ACTIVE (in progress)"
            print(f"  Status: {status_line}")
    finally:
        conn.close()
