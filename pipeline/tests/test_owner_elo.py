import sqlite3

from fantasynfl.compute.owner_elo import (
    INITIAL,
    compute_owner_elo,
    compute_owner_elo_all,
    regress_to_mean,
)
from fantasynfl.compute.types import GameResult
from fantasynfl.db import SCHEMA


def game(week, home, away, hs, as_):
    return GameResult(week, home, away, hs, as_, False)


def test_regress_to_mean():
    assert regress_to_mean(1500) == 1500
    assert regress_to_mean(1600) == 1575
    assert regress_to_mean(1400) == 1425
    assert regress_to_mean(1600, factor=0.5) == 1550


def test_seed_is_starting_point():
    final, snap = compute_owner_elo([], {}, {"a": 1600.0, "b": 1400.0})
    assert final == {"a": 1600.0, "b": 1400.0}
    assert snap == {}


def test_new_owner_starts_at_initial():
    final, _ = compute_owner_elo([game(1, 1, 2, 120, 80)], {1: "a", 2: "b"}, {})
    assert final["a"] > INITIAL > final["b"]


def test_teams_without_owner_skipped():
    final, _ = compute_owner_elo([game(1, 1, 2, 120, 80)], {1: "a"}, {"a": 1500.0})
    assert final["a"] == 1500.0


def test_same_owner_skipped():
    final, _ = compute_owner_elo([game(1, 1, 2, 120, 80)], {1: "a", 2: "a"}, {"a": 1500.0})
    assert final["a"] == 1500.0


def test_underdog_win_moves_more_than_favorite():
    games = [game(1, 1, 2, 100, 90)]
    mapping = {1: "a", 2: "b"}
    fav, _ = compute_owner_elo(games, mapping, {"a": 1700.0, "b": 1300.0})
    und, _ = compute_owner_elo(games, mapping, {"a": 1300.0, "b": 1700.0})
    assert (und["a"] - 1300.0) > (fav["a"] - 1700.0)


def test_snapshot_each_week():
    games = [game(1, 1, 2, 120, 80), game(2, 1, 2, 120, 80)]
    _, snap = compute_owner_elo(games, {1: "a", 2: "b"}, {})
    assert ("a", 1) in snap and ("a", 2) in snap
    assert snap[("a", 2)] > snap[("a", 1)]


def _make_db() -> sqlite3.Connection:
    conn = sqlite3.connect(":memory:")
    conn.row_factory = sqlite3.Row
    conn.executescript(SCHEMA)
    conn.execute(
        "INSERT INTO seasons (id, year, league_id, settings_json, created_at) "
        "VALUES (1, 2025, 't', '{}', 'x')"
    )
    conn.execute(
        "INSERT INTO seasons (id, year, league_id, settings_json, created_at) "
        "VALUES (2, 2024, 't', '{}', 'x')"
    )
    for oid, name in [("alice", "Alice"), ("bob", "Bob"), ("carol", "Carol"), ("dave", "Dave")]:
        conn.execute("INSERT INTO owners (id, display_name) VALUES (?, ?)", (oid, name))
    teams = [
        (1, 2, 1, "A24", "alice"),
        (2, 2, 2, "B24", "bob"),
        (3, 1, 3, "A25", "alice"),
        (4, 1, 4, "B25", "bob"),
        (5, 1, 5, "C25", "carol"),
        (6, 1, 6, "D25", "dave"),
    ]
    for tid, sid, eid, name, owner in teams:
        conn.execute(
            "INSERT INTO teams (id, season_id, espn_team_id, name, abbrev, owner_name, color, "
            "owner_id) VALUES (?, ?, ?, ?, ?, ?, '#fff', ?)",
            (tid, sid, eid, name, name[:1], owner, owner),
        )
    for wid, sid, wn in [(1, 2, 1), (2, 2, 2), (3, 2, 3), (4, 1, 1)]:
        conn.execute(
            "INSERT INTO weeks (id, season_id, week_num, label, is_playoff) "
            "VALUES (?, ?, ?, 'W', 0)",
            (wid, sid, wn),
        )
    for wid in (1, 2, 3):
        conn.execute(
            "INSERT INTO matchups (week_id, home_team_id, away_team_id, home_score, away_score, "
            "winner_team_id, is_playoff) VALUES (?, 1, 2, 130, 80, 1, 0)",
            (wid,),
        )
    conn.execute(
        "INSERT INTO matchups (week_id, home_team_id, away_team_id, home_score, away_score, "
        "winner_team_id, is_playoff) VALUES (4, 4, 6, 100, 90, 4, 0)"
    )
    conn.commit()
    return conn


def test_carryforward_regresses_and_orders_by_year():
    conn = _make_db()
    compute_owner_elo_all(conn)
    alice_2024_final = conn.execute(
        "SELECT rating FROM owner_elo WHERE owner_id='alice' AND season_id=2 "
        "ORDER BY week_num DESC LIMIT 1"
    ).fetchone()["rating"]
    alice_2025_w1 = conn.execute(
        "SELECT rating FROM owner_elo WHERE owner_id='alice' AND season_id=1 AND week_num=1"
    ).fetchone()["rating"]
    assert alice_2024_final > INITIAL
    assert abs(alice_2025_w1 - regress_to_mean(alice_2024_final)) < 1e-9
    assert INITIAL < alice_2025_w1 < alice_2024_final


def test_new_owner_seeded_at_initial():
    conn = _make_db()
    compute_owner_elo_all(conn)
    carol = conn.execute(
        "SELECT rating FROM owner_elo WHERE owner_id='carol' AND season_id=1 AND week_num=1"
    ).fetchone()["rating"]
    assert carol == INITIAL


def test_idempotent():
    conn = _make_db()
    compute_owner_elo_all(conn)
    n1 = conn.execute("SELECT COUNT(*) c FROM owner_elo").fetchone()["c"]
    compute_owner_elo_all(conn)
    n2 = conn.execute("SELECT COUNT(*) c FROM owner_elo").fetchone()["c"]
    assert n1 == n2 > 0


def test_season_without_owners_writes_nothing():
    conn = sqlite3.connect(":memory:")
    conn.row_factory = sqlite3.Row
    conn.executescript(SCHEMA)
    conn.execute(
        "INSERT INTO seasons (id, year, league_id, settings_json, created_at) "
        "VALUES (1, 2025, 't', '{}', 'x')"
    )
    conn.execute(
        "INSERT INTO teams (id, season_id, espn_team_id, name, abbrev, owner_name, color) "
        "VALUES (1, 1, 1, 'X', 'X', 'OX', '#fff')"
    )
    conn.execute(
        "INSERT INTO teams (id, season_id, espn_team_id, name, abbrev, owner_name, color) "
        "VALUES (2, 1, 2, 'Y', 'Y', 'OY', '#000')"
    )
    conn.execute(
        "INSERT INTO weeks (id, season_id, week_num, label, is_playoff) VALUES (1, 1, 1, 'W', 0)"
    )
    conn.execute(
        "INSERT INTO matchups (week_id, home_team_id, away_team_id, home_score, away_score, "
        "winner_team_id, is_playoff) VALUES (1, 1, 2, 100, 90, 1, 0)"
    )
    conn.commit()
    compute_owner_elo_all(conn)
    assert conn.execute("SELECT COUNT(*) c FROM owner_elo").fetchone()["c"] == 0
