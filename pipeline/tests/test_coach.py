import sqlite3

from fantasynfl.compute.coach import compute_coach_ratings, store_coach_ratings
from fantasynfl.compute.loaders import load_rosters
from fantasynfl.compute.types import RosterRow
from fantasynfl.db import SCHEMA

SEASON_ID = 1
TEAM_ID = 1
WEEK = 1


def _row(pid: int, pos: str, slot: str, points: float) -> RosterRow:
    return RosterRow(WEEK, TEAM_ID, pid, f"P{pid}", pos, slot, points)


def _starter_roster() -> list[RosterRow]:
    return [
        _row(1, "QB", "QB", 20.0),
        _row(2, "RB", "RB", 15.0),
        _row(3, "RB", "RB", 14.0),
        _row(4, "RB", "BN", 18.0),
        _row(5, "WR", "WR", 12.0),
        _row(6, "WR", "WR", 11.0),
        _row(7, "WR", "FLEX", 5.0),
        _row(8, "TE", "TE", 8.0),
        _row(9, "K", "K", 7.0),
        _row(10, "DEF", "DEF", 6.0),
    ]


def test_flex_picks_best_remaining_skill_player():
    (row,) = compute_coach_ratings(_starter_roster())
    # Optimal: QB 20, RB 18+15, WR 12+11, TE 8, K 7, DEF 6, FLEX = remaining RB 14
    assert row.actual_points == 98.0
    assert row.optimal_points == 111.0
    assert row.bench_points == 13.0


def test_ir_slot_players_excluded_from_optimal_pool():
    rosters = [
        _row(1, "QB", "QB", 20.0),
        _row(2, "RB", "RB", 15.0),
        _row(3, "RB", "RB", 14.0),
        _row(4, "RB", "FLEX", 10.0),
        _row(5, "WR", "WR", 12.0),
        _row(6, "WR", "WR", 11.0),
        _row(7, "TE", "TE", 8.0),
        _row(8, "K", "K", 7.0),
        _row(9, "DEF", "DEF", 6.0),
        _row(10, "RB", "IR", 30.0),
    ]
    (row,) = compute_coach_ratings(rosters)
    # The 30-point IR RB must not inflate the optimal lineup
    assert row.actual_points == 103.0
    assert row.optimal_points == 103.0
    assert row.efficiency == 1.0


def test_bye_week_unfilled_slots_contribute_zero():
    rosters = [
        _row(1, "QB", "QB", 20.0),
        _row(2, "RB", "RB", 15.0),
        _row(3, "RB", "RB", 14.0),
        _row(4, "RB", "FLEX", 10.0),
        _row(5, "WR", "WR", 12.0),
        _row(6, "WR", "WR", 11.0),
        _row(7, "TE", "TE", 8.0),
        # K and DEF on bye: absent from the roster entirely
    ]
    (row,) = compute_coach_ratings(rosters)
    assert row.actual_points == 90.0
    assert row.optimal_points == 90.0
    assert row.bench_points == 0.0
    assert row.efficiency == 1.0


def test_efficiency_is_actual_over_optimal():
    (row,) = compute_coach_ratings(_starter_roster())
    assert row.optimal_points >= row.actual_points
    assert row.efficiency == 98.0 / 111.0
    assert row.bench_points == row.optimal_points - row.actual_points


def test_zero_optimal_defaults_to_perfect_efficiency():
    (row,) = compute_coach_ratings([_row(1, "QB", "BN", 0.0)])
    assert row.actual_points == 0.0
    assert row.optimal_points == 0.0
    assert row.efficiency == 1.0


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
        "INSERT INTO weeks (id, season_id, week_num, label, is_playoff) "
        "VALUES (1, 1, 1, 'Week 1', 0)"
    )

    def roster(pid: int, pos: str, slot: str, points: float) -> None:
        conn.execute(
            "INSERT INTO rosters (week_id, team_id, espn_player_id, player_name, position, "
            "nfl_team, lineup_slot, points) VALUES (1, 1, ?, ?, ?, 'KC', ?, ?)",
            (pid, f"P{pid}", pos, slot, points),
        )

    roster(1, "QB", "QB", 20.0)
    roster(2, "RB", "RB", 15.0)
    roster(3, "RB", "RB", 14.0)
    roster(4, "RB", "FLEX", 10.0)
    roster(5, "WR", "WR", 12.0)
    roster(6, "WR", "WR", 11.0)
    roster(7, "TE", "TE", 8.0)
    roster(8, "K", "K", 7.0)
    roster(9, "DEF", "DEF", 6.0)
    conn.commit()
    return conn


def test_store_is_idempotent():
    conn = _make_db()
    rows = compute_coach_ratings(load_rosters(conn, SEASON_ID))

    # id excluded: INSERT OR REPLACE reassigns the autoincrement surrogate key
    select = (
        "SELECT season_id, team_id, week_num, actual_points, optimal_points, bench_points, "
        "efficiency FROM coach_ratings ORDER BY team_id, week_num"
    )
    store_coach_ratings(conn, SEASON_ID, rows)
    first = conn.execute(select).fetchall()
    store_coach_ratings(conn, SEASON_ID, rows)
    conn.commit()
    second = conn.execute(select).fetchall()

    assert len(first) == len(second) == len(rows)
    assert [tuple(r) for r in first] == [tuple(r) for r in second]
    stored = second[0]
    assert stored["actual_points"] == rows[0].actual_points
    assert stored["optimal_points"] == rows[0].optimal_points
    assert stored["bench_points"] == rows[0].bench_points
    assert stored["efficiency"] == rows[0].efficiency
