import sqlite3

from fantasynfl.compute.players import compute_players
from fantasynfl.db import SCHEMA


def _make_db() -> sqlite3.Connection:
    conn = sqlite3.connect(":memory:")
    conn.row_factory = sqlite3.Row
    conn.executescript(SCHEMA)
    # id order deliberately differs from year order (id 1 -> 2025, id 2 -> 2024)
    conn.execute(
        "INSERT INTO seasons (id, year, league_id, settings_json, created_at) "
        "VALUES (1, 2025, 't', '{}', 'x')"
    )
    conn.execute(
        "INSERT INTO seasons (id, year, league_id, settings_json, created_at) "
        "VALUES (2, 2024, 't', '{}', 'x')"
    )
    conn.execute(
        "INSERT INTO teams (id, season_id, espn_team_id, name, abbrev, owner_name, color) "
        "VALUES (1, 1, 1, 'A25', 'A', 'OA', '#fff')"
    )
    conn.execute(
        "INSERT INTO teams (id, season_id, espn_team_id, name, abbrev, owner_name, color) "
        "VALUES (2, 2, 2, 'A24', 'A', 'OA', '#fff')"
    )
    for wid, sid, wn in [(1, 1, 1), (2, 1, 2), (3, 2, 1)]:
        conn.execute(
            "INSERT INTO weeks (id, season_id, week_num, label, is_playoff) "
            "VALUES (?, ?, ?, 'W', 0)",
            (wid, sid, wn),
        )

    def roster(week_id: int, team_id: int, pid: int, name: str, pos: str, nfl: str) -> None:
        conn.execute(
            "INSERT INTO rosters (week_id, team_id, espn_player_id, player_name, position, "
            "nfl_team, lineup_slot, points) VALUES (?, ?, ?, ?, ?, ?, 'QB', 10.0)",
            (week_id, team_id, pid, name, pos, nfl),
        )

    # Player 101: 2024 (season 2) as RB/KC, then 2025 (season 1) weeks 1-2 as WR/BUF
    roster(3, 2, 101, "Pat One", "RB", "KC")
    roster(1, 1, 101, "Pat One", "WR", "BUF")
    roster(2, 1, 101, "Pat One", "WR", "BUF")
    # Player 102: only 2025 week 1
    roster(1, 1, 102, "Pat Two", "QB", "DEN")
    # Player 103: only 2024
    roster(3, 2, 103, "Pat Three", "TE", "PHI")
    conn.commit()
    return conn


def _player(conn: sqlite3.Connection, pid: int) -> sqlite3.Row:
    return conn.execute("SELECT * FROM players WHERE espn_player_id = ?", (pid,)).fetchone()


def test_one_row_per_player():
    conn = _make_db()
    compute_players(conn)
    assert conn.execute("SELECT COUNT(*) c FROM players").fetchone()["c"] == 3


def test_first_last_season_follow_year_not_id():
    conn = _make_db()
    compute_players(conn)
    p = _player(conn, 101)
    # 2024 is season id 2, 2025 is season id 1 -> year order, not id order
    assert p["first_season_id"] == 2
    assert p["last_season_id"] == 1


def test_latest_attributes_win():
    conn = _make_db()
    compute_players(conn)
    p = _player(conn, 101)
    assert p["full_name"] == "Pat One"
    assert p["position"] == "WR"
    assert p["nfl_team"] == "BUF"


def test_single_season_player_spans_one_season():
    conn = _make_db()
    compute_players(conn)
    p = _player(conn, 102)
    assert p["first_season_id"] == 1
    assert p["last_season_id"] == 1
    assert p["position"] == "QB"


def test_idempotent():
    conn = _make_db()
    compute_players(conn)
    compute_players(conn)
    assert conn.execute("SELECT COUNT(*) c FROM players").fetchone()["c"] == 3
