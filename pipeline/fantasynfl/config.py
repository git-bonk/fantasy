"""Environment / configuration loading."""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

REPO_ROOT = Path(__file__).resolve().parents[2]


@dataclass(frozen=True)
class Config:
    league_id: str
    espn_s2: str
    swid: str
    seasons: tuple[int, ...]
    db_path: Path


def _load_env() -> None:
    load_dotenv(REPO_ROOT / ".env")
    load_dotenv(REPO_ROOT / "pipeline" / ".env")


def resolve_db_path(raw: str | None) -> Path:
    if not raw:
        return REPO_ROOT / "data" / "fantasynfl.db"
    p = Path(raw)
    return p if p.is_absolute() else REPO_ROOT / p


def load_config(require_creds: bool = True) -> Config:
    _load_env()
    league_id = os.getenv("ESPN_LEAGUE_ID", "").strip()
    espn_s2 = os.getenv("ESPN_S2", "").strip()
    swid = os.getenv("SWID", "").strip()

    if require_creds and not (league_id and espn_s2 and swid):
        raise RuntimeError(
            "Missing ESPN credentials. Copy .env.example to .env and fill in "
            "ESPN_LEAGUE_ID, ESPN_S2, and SWID. (Use `fantasynfl sample` to run "
            "without credentials.)"
        )

    seasons_raw = os.getenv("SEASONS", "").strip()
    seasons = tuple(int(s) for s in seasons_raw.split(",") if s.strip()) if seasons_raw else ()

    return Config(
        league_id=league_id,
        espn_s2=espn_s2,
        swid=swid,
        seasons=seasons,
        db_path=resolve_db_path(os.getenv("DB_PATH")),
    )
