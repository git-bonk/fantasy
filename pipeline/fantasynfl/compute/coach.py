"""Coach ratings: how efficiently each manager set their lineup each week.

For every (team, week) we compare the points actually started with the best
lineup that could have been set from the same roster, reusing the greedy from
``sample.py``: take the top QB, two RBs, two WRs, TE, K and DEF by points,
then fill FLEX with the best remaining RB/WR/TE. Players parked in an IR slot
cannot start and are excluded from the optimal pool; unfilled slots (bye
weeks) simply contribute 0. Efficiency is actual / optimal (1.0 when the
optimal is 0) and bench_points is the hindsight gap left on the table, so
optimal >= actual always holds. Inputs come from ``loaders.load_rosters``.
"""

from __future__ import annotations

import sqlite3
from collections import defaultdict
from dataclasses import dataclass

from .types import RosterRow

FLEX_ELIGIBLE = ("RB", "WR", "TE")
SLOT_COUNTS = (("QB", 1), ("RB", 2), ("WR", 2), ("TE", 1), ("K", 1), ("DEF", 1))


@dataclass(frozen=True)
class CoachRow:
    team_id: int
    week_num: int
    actual_points: float
    optimal_points: float
    bench_points: float
    efficiency: float


def _optimal_points(pool: list[RosterRow]) -> float:
    """Greedy best lineup over a week's roster pool (IR players already removed)."""
    by_pos: dict[str, list[RosterRow]] = defaultdict(list)
    for row in pool:
        by_pos[row.position].append(row)
    for rows in by_pos.values():
        rows.sort(key=lambda r: -r.points)

    used: set[int] = set()
    total = 0.0

    def take_best(pos: str, n: int) -> None:
        nonlocal total
        taken = 0
        for row in by_pos.get(pos, []):
            if taken == n:
                break
            if row.espn_player_id not in used:
                used.add(row.espn_player_id)
                total += row.points
                taken += 1

    for pos, n in SLOT_COUNTS:
        take_best(pos, n)

    # FLEX: best remaining RB/WR/TE, even over players started at a natural slot
    flex_pool = [
        row
        for pos in FLEX_ELIGIBLE
        for row in by_pos.get(pos, [])
        if row.espn_player_id not in used
    ]
    if flex_pool:
        flex_pool.sort(key=lambda r: -r.points)
        total += flex_pool[0].points
    return total


def compute_coach_ratings(rosters: list[RosterRow]) -> list[CoachRow]:
    """One CoachRow per (team, week) present in the roster data."""
    by_team_week: dict[tuple[int, int], list[RosterRow]] = defaultdict(list)
    for row in rosters:
        by_team_week[(row.team_id, row.week_num)].append(row)

    rows: list[CoachRow] = []
    for team_id, week_num in sorted(by_team_week):
        week_rows = by_team_week[(team_id, week_num)]
        actual = sum(r.points for r in week_rows if r.is_starter)
        optimal = _optimal_points([r for r in week_rows if r.lineup_slot != "IR"])
        bench = max(0.0, optimal - actual)
        efficiency = actual / optimal if optimal > 0 else 1.0
        rows.append(
            CoachRow(
                team_id=team_id,
                week_num=week_num,
                actual_points=round(actual, 1),
                optimal_points=round(optimal, 1),
                bench_points=round(bench, 1),
                efficiency=efficiency,
            )
        )
    return rows


def store_coach_ratings(conn: sqlite3.Connection, season_id: int, rows: list[CoachRow]) -> None:
    """Persist coach ratings; re-running is idempotent via the
    UNIQUE(season_id, team_id, week_num) constraint."""
    conn.executemany(
        "INSERT OR REPLACE INTO coach_ratings "
        "(season_id, team_id, week_num, actual_points, optimal_points, bench_points, efficiency) "
        "VALUES (?, ?, ?, ?, ?, ?, ?)",
        [
            (
                season_id,
                r.team_id,
                r.week_num,
                r.actual_points,
                r.optimal_points,
                r.bench_points,
                r.efficiency,
            )
            for r in rows
        ],
    )
