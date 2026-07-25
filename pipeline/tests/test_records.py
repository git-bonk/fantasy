import sqlite3

from fantasynfl.compute.records import (
    BEST_SEASON,
    BIGGEST_WIN,
    LONGEST_STREAK,
    SINGLE_GAME_HIGH,
    SINGLE_GAME_LOW,
    TOP_PLAYER_GAME,
    compute_records,
)
from fantasynfl.db import SCHEMA


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
    conn.execute(
        "INSERT INTO weeks (id, season_id, week_num, label, is_playoff) "
        "VALUES (1, 1, 1, 'Week 1', 0)"
    )
    conn.execute(
        "INSERT INTO weeks (id, season_id, week_num, label, is_playoff) "
        "VALUES (2, 1, 2, 'Week 2', 0)"
    )
    conn.execute(
        "INSERT INTO matchups (week_id, home_team_id, away_team_id, home_score, away_score, "
        "winner_team_id, is_playoff) VALUES (1, 1, 2, 150, 80, 1, 0)"
    )
    conn.execute(
        "INSERT INTO matchups (week_id, home_team_id, away_team_id, home_score, away_score, "
        "winner_team_id, is_playoff) VALUES (2, 2, 1, 90, 120, 1, 0)"
    )
    conn.execute(
        "INSERT INTO rosters (week_id, team_id, espn_player_id, player_name, position, "
        "nfl_team, lineup_slot, points) VALUES (1, 1, 999, 'Star QB', 'QB', 'KC', 'QB', 45.5)"
    )
    conn.commit()
    return conn


def test_single_game_high():
    conn = _make_db()
    records = compute_records(conn)
    highs = [r for r in records if r.category == SINGLE_GAME_HIGH]
    assert len(highs) > 0
    assert highs[0].value == 150
    assert highs[0].rank == 1


def test_single_game_low():
    conn = _make_db()
    records = compute_records(conn)
    lows = [r for r in records if r.category == SINGLE_GAME_LOW]
    assert len(lows) > 0
    assert lows[0].value == 80
    assert lows[0].rank == 1


def test_biggest_win():
    conn = _make_db()
    records = compute_records(conn)
    wins = [r for r in records if r.category == BIGGEST_WIN]
    assert len(wins) > 0
    assert wins[0].value == 70
    assert wins[0].team_id == 1


def test_top_player_game():
    conn = _make_db()
    records = compute_records(conn)
    players = [r for r in records if r.category == TOP_PLAYER_GAME]
    assert len(players) > 0
    assert players[0].player_name == "Star QB"
    assert players[0].value == 45.5


def test_best_season():
    conn = _make_db()
    records = compute_records(conn)
    seasons = [r for r in records if r.category == BEST_SEASON]
    assert len(seasons) > 0
    assert seasons[0].team_id == 1
    assert seasons[0].value == 2


def test_longest_streak():
    conn = _make_db()
    records = compute_records(conn)
    streaks = [r for r in records if r.category == LONGEST_STREAK]
    assert len(streaks) > 0
    assert streaks[0].team_id == 1
    assert streaks[0].value == 2
