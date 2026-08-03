import sqlite3

from fantasynfl.compute.transactions import compute_transactions, store_derived_transactions
from fantasynfl.db import SCHEMA, init_db

SEASON_ID = 1


def _make_db() -> sqlite3.Connection:
    conn = sqlite3.connect(":memory:")
    conn.row_factory = sqlite3.Row
    conn.executescript(SCHEMA)
    conn.execute(
        "INSERT INTO seasons (id, year, league_id, settings_json, created_at) "
        "VALUES (1, 2025, 'test', '{}', '2025-01-01')"
    )
    conn.execute(
        "INSERT INTO teams (id, season_id, espn_team_id, name, abbrev, owner_name, color) "
        "VALUES (1, 1, 1, 'Alpha', 'ALP', 'Owner A', '#fff')"
    )
    conn.execute(
        "INSERT INTO teams (id, season_id, espn_team_id, name, abbrev, owner_name, color) "
        "VALUES (2, 1, 2, 'Bravo', 'BRV', 'Owner B', '#000')"
    )
    for week_id, week_num, is_playoff in [(1, 1, 0), (2, 2, 0), (3, 3, 0), (4, 4, 1)]:
        conn.execute(
            "INSERT INTO weeks (id, season_id, week_num, label, is_playoff) VALUES (?, 1, ?, ?, ?)",
            (week_id, week_num, f"Week {week_num}", is_playoff),
        )

    def roster(week_id: int, team_id: int, pid: int, name: str, pos: str) -> None:
        conn.execute(
            "INSERT INTO rosters (week_id, team_id, espn_player_id, player_name, position, "
            "nfl_team, lineup_slot, points) VALUES (?, ?, ?, ?, ?, 'KC', 'QB', 10.0)",
            (week_id, team_id, pid, name, pos),
        )

    # Week 1: Alpha {101, 102}, Bravo {103, 104}
    roster(1, 1, 101, "P One", "QB")
    roster(1, 1, 102, "P Two", "RB")
    roster(1, 2, 103, "P Three", "WR")
    roster(1, 2, 104, "P Four", "TE")
    # Week 2: 102 <-> 103 traded between the teams
    roster(2, 1, 101, "P One", "QB")
    roster(2, 1, 103, "P Three", "WR")
    roster(2, 2, 102, "P Two", "RB")
    roster(2, 2, 104, "P Four", "TE")
    # Week 3: Alpha adds 105, Bravo drops 104
    roster(3, 1, 101, "P One", "QB")
    roster(3, 1, 103, "P Three", "WR")
    roster(3, 1, 105, "P Five", "K")
    roster(3, 2, 102, "P Two", "RB")
    # Week 4 (playoff): Alpha adds 109 - must be ignored
    roster(4, 1, 101, "P One", "QB")
    roster(4, 1, 103, "P Three", "WR")
    roster(4, 1, 105, "P Five", "K")
    roster(4, 1, 109, "P Nine", "DEF")
    conn.commit()
    return conn


def _move_set(conn: sqlite3.Connection) -> set[tuple[int, int, str, int]]:
    return {
        (team_id, pid, ttype, week_num)
        for (_season, team_id, pid, _name, ttype, week_num) in compute_transactions(conn, SEASON_ID)
    }


def test_derives_trades_adds_and_drops():
    conn = _make_db()
    assert _move_set(conn) == {
        (1, 103, "TRADE_IN", 2),
        (2, 103, "TRADE_OUT", 2),
        (2, 102, "TRADE_IN", 2),
        (1, 102, "TRADE_OUT", 2),
        (1, 105, "ADD", 3),
        (2, 104, "DROP", 3),
    }


def test_unchanged_players_produce_no_moves():
    conn = _make_db()
    pids = {pid for (_t, pid, _ty, _w) in _move_set(conn)}
    assert 101 not in pids


def test_playoff_weeks_are_excluded():
    conn = _make_db()
    moves = _move_set(conn)
    assert all(week_num != 4 for (_t, _p, _ty, week_num) in moves)
    assert 109 not in {pid for (_t, pid, _ty, _w) in moves}


def test_player_name_is_carried_through():
    conn = _make_db()
    names = {
        (team_id, pid, ttype): name
        for (_s, team_id, pid, name, ttype, _w) in compute_transactions(conn, SEASON_ID)
    }
    assert names[(1, 105, "ADD")] == "P Five"


def test_store_is_idempotent_and_preserves_espn():
    conn = _make_db()
    conn.execute(
        "INSERT INTO transactions (season_id, team_id, espn_player_id, player_name, type, "
        "occurred_at, source) "
        "VALUES (1, 1, 105, 'P Five', 'ADD', '2025-09-01T00:00:00', 'espn')"
    )
    conn.commit()

    store_derived_transactions(conn, SEASON_ID)
    store_derived_transactions(conn, SEASON_ID)
    conn.commit()

    espn = conn.execute(
        "SELECT player_name FROM transactions WHERE season_id = 1 AND source = 'espn'"
    ).fetchall()
    derived = conn.execute(
        "SELECT COUNT(*) AS n FROM transactions WHERE season_id = 1 AND source = 'derived'"
    ).fetchone()["n"]

    assert [r["player_name"] for r in espn] == ["P Five"]
    assert derived == 6


def test_init_db_migrates_legacy_transactions_table():
    conn = sqlite3.connect(":memory:")
    conn.row_factory = sqlite3.Row
    conn.execute(
        "CREATE TABLE transactions ("
        "id INTEGER PRIMARY KEY AUTOINCREMENT, season_id INTEGER NOT NULL, "
        "team_id INTEGER, espn_player_id INTEGER, player_name TEXT, type TEXT NOT NULL, "
        "bid_amount INTEGER, occurred_at TEXT NOT NULL)"
    )
    conn.execute(
        "INSERT INTO transactions (season_id, team_id, espn_player_id, player_name, type, "
        "bid_amount, occurred_at) VALUES (1, 1, 5, 'Legacy', 'ADD', 10, '2025-01-01')"
    )
    conn.commit()

    init_db(conn)

    cols = {r["name"] for r in conn.execute("PRAGMA table_info(transactions)").fetchall()}
    assert {"week_num", "source"} <= cols
    assert "bid_amount" not in cols
    row = conn.execute("SELECT source, week_num FROM transactions").fetchone()
    assert row["source"] == "espn"
    assert row["week_num"] is None
    idx = conn.execute(
        "SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'idx_transactions_season'"
    ).fetchone()
    assert idx is not None
    conn.close()
