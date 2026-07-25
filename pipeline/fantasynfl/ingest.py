"""High-level ingestion: build a SeasonData (sample or ESPN), store it, compute stats."""

from __future__ import annotations

from pathlib import Path

from .compute import compute_all
from .config import Config
from .db import connect, init_db, store_season
from .models import SeasonData


def _ingest_one(db_path: Path, season: SeasonData, sims: int = 2000) -> None:
    conn = connect(db_path)
    try:
        init_db(conn)
        season_id = store_season(conn, season)
        n_playoff = int(season.settings.get("playoff_teams", 6))
        compute_all(conn, season_id, n_playoff=n_playoff, sims=sims)
    finally:
        conn.close()


def ingest_sample(db_path: Path, year: int = 2025, seed: int = 42, sims: int = 2000) -> None:
    from .sample import generate_season

    season = generate_season(year=year, league_id="sample", seed=seed)
    _ingest_one(db_path, season, sims=sims)
    print(f"Sample season {year} ingested -> {db_path}")


def ingest_espn(config: Config, sims: int = 2000) -> None:
    from .espn import fetch_season

    if not config.seasons:
        raise RuntimeError("No SEASONS configured in .env")
    for year in config.seasons:
        season = fetch_season(config.league_id, year, config.espn_s2, config.swid)
        _ingest_one(config.db_path, season, sims=sims)
        print(f"Season {year} ingested -> {config.db_path}")


def recompute(db_path: Path, sims: int = 2000) -> None:
    conn = connect(db_path)
    try:
        init_db(conn)
        seasons = conn.execute("SELECT id, settings_json FROM seasons").fetchall()
        for row in seasons:
            import json

            settings = json.loads(row["settings_json"])
            n_playoff = int(settings.get("playoff_teams", 6))
            compute_all(conn, row["id"], n_playoff=n_playoff, sims=sims)
    finally:
        conn.close()
    print(f"Recomputed stats for {len(seasons)} season(s).")
