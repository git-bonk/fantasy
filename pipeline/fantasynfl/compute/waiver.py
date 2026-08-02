"""Waiver regret index: grade free-agent ADDs and DROPs by after-the-fact points.

Derived ``ADD``/``DROP`` rows (``transactions.py``) mark every non-trade roster
move with the week it happened. Each move is graded by the points the player
produced over the next ``moves.EVAL_WEEKS`` regular-season weeks:

- ADD — points scored *on the acquiring team* (did the pickup pay off?). At least
  ``moves.GEM_THRESHOLD`` points labels the move ``GEM`` (a stolen gem).
- DROP — points scored *on any other team* (did the player thrive elsewhere?). At
  least ``moves.REGRET_THRESHOLD`` points labels the move ``REGRET`` (a regret drop).

Everything below threshold is ``NEUTRAL``. Data sources: ``transactions``
(source='derived') plus ``rosters`` + ``weeks`` via ``loaders.load_rosters``,
graded through the shared ``moves`` seam. ``store_waiver_impact`` replaces the
season's rows wholesale (DELETE then INSERT), so recomputes are idempotent.
"""

from __future__ import annotations

import sqlite3
from dataclasses import dataclass

from . import moves
from .loaders import load_rosters


@dataclass(frozen=True)
class WaiverRow:
    """One graded waiver move: points produced after the move and its label."""

    season_id: int
    team_id: int
    espn_player_id: int
    player_name: str
    move_type: str
    week_num: int
    points_after: float
    label: str


def compute_waiver_impact(conn: sqlite3.Connection, season_id: int) -> list[WaiverRow]:
    """Grade every derived ADD/DROP for a season (regular-season points only)."""
    playoff_weeks = {
        r["week_num"]
        for r in conn.execute(
            "SELECT week_num FROM weeks WHERE season_id = ? AND is_playoff = 1", (season_id,)
        ).fetchall()
    }
    rosters = moves.without_playoff_weeks(load_rosters(conn, season_id), playoff_weeks)
    by_player = moves.index_by_player(rosters)

    tx_rows = conn.execute(
        "SELECT week_num, team_id, espn_player_id, player_name, type FROM transactions "
        "WHERE season_id = ? AND source = 'derived' AND type IN ('ADD', 'DROP') "
        "ORDER BY week_num, team_id, type, espn_player_id",
        (season_id,),
    ).fetchall()

    rows: list[WaiverRow] = []
    for r in tx_rows:
        player_rows = by_player.get(r["espn_player_id"], [])
        if r["type"] == "ADD":
            # Gems: production for the acquiring team only.
            points = moves.points_after(
                player_rows, r["espn_player_id"], r["week_num"], moves.team_only(r["team_id"])
            )
            label = "GEM" if points >= moves.GEM_THRESHOLD else "NEUTRAL"
        else:
            # Regrets: production everywhere except the team that dropped the player.
            points = moves.points_after(
                player_rows, r["espn_player_id"], r["week_num"], moves.other_teams(r["team_id"])
            )
            label = "REGRET" if points >= moves.REGRET_THRESHOLD else "NEUTRAL"
        rows.append(
            WaiverRow(
                season_id,
                r["team_id"],
                r["espn_player_id"],
                r["player_name"],
                r["type"],
                r["week_num"],
                points,
                label,
            )
        )
    return rows


def store_waiver_impact(conn: sqlite3.Connection, season_id: int, rows: list[WaiverRow]) -> None:
    """Replace this season's graded waiver moves (DELETE + INSERT → idempotent)."""
    conn.execute("DELETE FROM waiver_impact WHERE season_id = ?", (season_id,))
    conn.executemany(
        "INSERT INTO waiver_impact (season_id, team_id, espn_player_id, player_name, move_type, "
        "week_num, points_after, label) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [
            (
                r.season_id,
                r.team_id,
                r.espn_player_id,
                r.player_name,
                r.move_type,
                r.week_num,
                r.points_after,
                r.label,
            )
            for r in rows
        ],
    )
