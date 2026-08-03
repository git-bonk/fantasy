import sqlite3

from fantasynfl.db import init_db
from fantasynfl.nfl_api import AthleteSeason
from fantasynfl.nfl_refresh import refresh_nfl_stats


def _make_db() -> sqlite3.Connection:
    conn = sqlite3.connect(":memory:")
    conn.row_factory = sqlite3.Row
    init_db(conn)
    conn.execute(
        "INSERT INTO seasons (id, year, league_id, settings_json, created_at) "
        "VALUES (1, 2025, 'test', '{}', '2025-01-01')"
    )
    for i in range(1, 4):
        conn.execute(
            "INSERT INTO players (id, espn_player_id, full_name, position, nfl_team) "
            "VALUES (?, ?, ?, 'DEF', 'KC')",
            (i, -16000 - i, f"DEF {i}"),
        )
    for i in range(4, 34):
        conn.execute(
            "INSERT INTO players (id, espn_player_id, full_name, position, nfl_team) "
            "VALUES (?, ?, ?, 'WR', 'KC')",
            (i, 100000 + i, f"Player {i}"),
        )
    conn.commit()
    return conn


def test_budget_counts_api_calls_not_players(monkeypatch):
    conn = _make_db()
    calls: list[int] = []

    def fake_fetch(espn_player_id: int):
        calls.append(espn_player_id)
        return [
            AthleteSeason(season_year=2025, nfl_team="kc", gp=17, stats={"receivingYards": 100})
        ]

    monkeypatch.setattr("fantasynfl.nfl_refresh.fetch_athlete_season_stats", fake_fetch)

    made = refresh_nfl_stats(conn, max_calls=3, delay=0)

    assert made == 3
    assert len(calls) == 3
    assert all(pid > 0 for pid in calls)
    assert (
        conn.execute(
            "SELECT COUNT(*) FROM players WHERE nfl_stats_fetched_at IS NOT NULL"
        ).fetchone()[0]
        == 6  # 3 DEF (free) + 3 fetched
    )
    assert conn.execute("SELECT COUNT(*) FROM player_nfl_seasons").fetchone()[0] == 3


def test_second_run_continues_where_first_left_off(monkeypatch):
    conn = _make_db()
    calls: list[int] = []
    monkeypatch.setattr(
        "fantasynfl.nfl_refresh.fetch_athlete_season_stats",
        lambda pid: calls.append(pid) or [],
    )

    refresh_nfl_stats(conn, max_calls=3, delay=0)
    first = list(calls)
    refresh_nfl_stats(conn, max_calls=3, delay=0)

    assert len(calls) == 6
    assert set(first).isdisjoint(set(calls[3:]))


def test_failed_fetch_is_marked_and_does_not_block_queue(monkeypatch):
    conn = _make_db()

    def exploding_fetch(espn_player_id: int):
        raise RuntimeError("boom")

    monkeypatch.setattr("fantasynfl.nfl_refresh.fetch_athlete_season_stats", exploding_fetch)

    made = refresh_nfl_stats(conn, max_calls=2, delay=0)

    assert made == 2
    assert (
        conn.execute(
            "SELECT COUNT(*) FROM players WHERE nfl_stats_fetched_at IS NOT NULL"
        ).fetchone()[0]
        == 5  # 3 DEF + 2 failed-but-marked
    )
