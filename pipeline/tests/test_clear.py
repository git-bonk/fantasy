"""Regression guard for season clearing.

Computed tables have no foreign keys, so every new one must be purged explicitly
when a season is cleared (see _DERIVED_TABLES). These tests seed one row per
derived table plus draft_picks and assert both clearing paths remove them all —
the bug class that orphaned playoff_scenarios/coach_ratings/trades/waiver_impact
rows on re-ingest.
"""

from __future__ import annotations

import sqlite3

from fantasynfl.db.clear import clear_season, clear_season_data
from fantasynfl.db.schema import init_db

DERIVED = (
    "elo_ratings",
    "luck",
    "sos",
    "playoff_snapshots",
    "playoff_scenarios",
    "coach_ratings",
    "trades",
    "waiver_impact",
    "records",
    "scheduled_matchups",
)

_COLS = {
    "elo_ratings": "(season_id, team_id, week_num, rating)",
    "luck": "(season_id, team_id, week_num, actual_wins, expected_wins, luck_score)",
    "sos": "(season_id, team_id, week_num, opp_avg_points, sos_rank)",
    "playoff_snapshots": (
        "(season_id, week_num, team_id, wins, losses, ties, points_for, points_against, "
        "playoff_seed, playoff_odds)"
    ),
    "playoff_scenarios": (
        "(season_id, week_num, team_id, p_wins_out, p_lose_out, min_wins_fifty, win_dist_json)"
    ),
    "coach_ratings": (
        "(season_id, team_id, week_num, actual_points, optimal_points, bench_points, efficiency)"
    ),
    "trades": (
        "(season_id, week_num, team_a_id, team_b_id, a_players_json, b_players_json, "
        "a_points, b_points, winner_side, weeks_evaluated, finalized)"
    ),
    "waiver_impact": (
        "(season_id, team_id, espn_player_id, player_name, move_type, week_num, "
        "points_after, label)"
    ),
    "records": "(category, rank, season_id, team_id, player_name, value, detail)",
    "scheduled_matchups": "(season_id, week_num, home_team_id, away_team_id, kickoff)",
}


def _seed() -> tuple[sqlite3.Connection, int]:
    conn = sqlite3.connect(":memory:")
    conn.row_factory = sqlite3.Row
    init_db(conn)
    conn.execute(
        "INSERT INTO seasons (year, league_id, settings_json, created_at) "
        "VALUES (2020, 'x', '{}', '2020-01-01')"
    )
    season_id = conn.execute("SELECT id FROM seasons").fetchone()["id"]
    conn.execute(
        "INSERT INTO teams (season_id, espn_team_id, name, abbrev, owner_name, color) "
        "VALUES (?, 1, 'T', 'T', 'O', '#000000')",
        (season_id,),
    )
    team_id = conn.execute("SELECT id FROM teams").fetchone()["id"]
    conn.execute(
        "INSERT INTO draft_picks (season_id, espn_team_id, round_num, round_pick, "
        "player_name, position) VALUES (?, 1, 1, 1, 'Player', 'QB')",
        (season_id,),
    )
    rows = {
        "elo_ratings": (season_id, team_id, 1, 1500.0),
        "luck": (season_id, team_id, 1, 1.0, 0.5, 0.5),
        "sos": (season_id, team_id, 1, 100.0, 1),
        "playoff_snapshots": (season_id, 1, team_id, 0, 0, 0, 0.0, 0.0, None, None),
        "playoff_scenarios": (season_id, 1, team_id, 0.5, 0.1, 8, "{}"),
        "coach_ratings": (season_id, team_id, 1, 90.0, 100.0, 10.0, 0.9),
        "trades": (season_id, 2, team_id, team_id + 1, "[]", "[]", None, None, None, 0, 0),
        "waiver_impact": (season_id, team_id, 5, "Player", "ADD", 3, 12.0, "NEUTRAL"),
        "records": ("most_points", 1, season_id, team_id, None, 150.0, None),
        "scheduled_matchups": (season_id, 1, team_id, team_id + 1, None),
    }
    for table, values in rows.items():
        placeholders = ", ".join("?" * len(values))
        conn.execute(f"INSERT INTO {table} {_COLS[table]} VALUES ({placeholders})", values)
    conn.commit()
    return conn, season_id


def _assert_purged(conn: sqlite3.Connection, season_id: int) -> None:
    for table in (*DERIVED, "draft_picks"):
        count = conn.execute(
            f"SELECT COUNT(*) FROM {table} WHERE season_id = ?", (season_id,)
        ).fetchone()[0]
        assert count == 0, f"{table} still has {count} rows"


def test_clear_season_data_purges_derived_and_draft() -> None:
    conn, season_id = _seed()
    clear_season_data(conn, season_id)
    _assert_purged(conn, season_id)
    assert conn.execute("SELECT COUNT(*) FROM seasons WHERE id = ?", (season_id,)).fetchone()[0]


def test_clear_season_purges_derived_and_draft() -> None:
    conn, season_id = _seed()
    clear_season(conn, 2020)
    _assert_purged(conn, season_id)
    assert not conn.execute("SELECT COUNT(*) FROM seasons WHERE id = ?", (season_id,)).fetchone()[0]
