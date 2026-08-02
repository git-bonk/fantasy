import sqlite3
from datetime import UTC, datetime, timedelta

from fantasynfl.db import SCHEMA
from fantasynfl.lock import first_kickoff_utc, is_locked


def _conn() -> sqlite3.Connection:
    conn = sqlite3.connect(":memory:")
    conn.row_factory = sqlite3.Row
    conn.executescript(SCHEMA)
    conn.execute(
        "INSERT INTO seasons (year, league_id, settings_json, created_at) "
        "VALUES (2025, 'x', '{}', 'now')"
    )
    return conn


def _season_id(conn: sqlite3.Connection) -> int:
    return conn.execute("SELECT id FROM seasons").fetchone()["id"]


def _add_week(conn: sqlite3.Connection, season_id: int, week_num: int, finalized: int = 0) -> None:
    conn.execute(
        "INSERT INTO weeks (season_id, week_num, label, is_playoff, finalized) "
        "VALUES (?, ?, ?, 0, ?)",
        (season_id, week_num, f"Week {week_num}", finalized),
    )
    conn.commit()


def _add_kickoff(conn: sqlite3.Connection, season_id: int, week_num: int, kickoff: str) -> None:
    conn.execute(
        "INSERT INTO scheduled_matchups (season_id, week_num, home_team_id, away_team_id, kickoff) "
        "VALUES (?, ?, 1, 2, ?)",
        (season_id, week_num, kickoff),
    )
    conn.commit()


def test_first_kickoff_is_deterministic_utc():
    a = first_kickoff_utc(1, 2025)
    assert a == first_kickoff_utc(1, 2025)
    assert a.endswith("+00:00")
    d1 = datetime.fromisoformat(a)
    d2 = datetime.fromisoformat(first_kickoff_utc(2, 2025))
    assert (d2 - d1).days == 7


def test_before_kickoff_is_open():
    conn = _conn()
    sid = _season_id(conn)
    _add_week(conn, sid, 1)
    _add_kickoff(conn, sid, 1, first_kickoff_utc(1, 2025))
    ko = datetime.fromisoformat(first_kickoff_utc(1, 2025))
    assert is_locked(conn, sid, 1, ko - timedelta(days=1)) is False


def test_after_kickoff_is_locked():
    conn = _conn()
    sid = _season_id(conn)
    _add_week(conn, sid, 1)
    _add_kickoff(conn, sid, 1, first_kickoff_utc(1, 2025))
    ko = datetime.fromisoformat(first_kickoff_utc(1, 2025))
    assert is_locked(conn, sid, 1, ko + timedelta(days=1)) is True


def test_finalized_week_is_locked():
    conn = _conn()
    sid = _season_id(conn)
    _add_week(conn, sid, 1, finalized=1)
    assert is_locked(conn, sid, 1, datetime(2020, 1, 1, tzinfo=UTC)) is True


def test_missing_kickoff_fails_closed():
    conn = _conn()
    sid = _season_id(conn)
    _add_week(conn, sid, 1)
    assert is_locked(conn, sid, 1, datetime(2020, 1, 1, tzinfo=UTC)) is True
