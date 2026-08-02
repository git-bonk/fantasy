"""Derive a complete week-by-week transaction history from roster diffs.

ESPN's recent-activity feed only returns the latest moves, so past seasons have
gaps. Because every team's roster is stored for each regular-season week, we can
reconstruct the full history by diffing consecutive weeks: a player appearing on a
roster is an ADD, disappearing is a DROP, and moving between teams in the same
week is a TRADE. Rows are tagged source='derived' so the official ESPN rows are
never disturbed.
"""

from __future__ import annotations

import sqlite3

Move = tuple[int, int, int, str, str, int]


def compute_transactions(conn: sqlite3.Connection, season_id: int) -> list[Move]:
    """Return derived (season_id, team_id, player_id, name, type, week_num) moves.

    Only regular-season weeks are diffed: playoff weeks roster fewer teams, which
    would otherwise read as mass drops. Week 1 has no prior week, so initial
    rosters produce no moves (tenure is recovered from the rosters table itself).
    """
    rows = conn.execute(
        "SELECT w.week_num AS week_num, r.team_id AS team_id, "
        "r.espn_player_id AS pid, r.player_name AS name "
        "FROM rosters r JOIN weeks w ON w.id = r.week_id "
        "WHERE w.season_id = ? AND w.is_playoff = 0 "
        "ORDER BY w.week_num",
        (season_id,),
    ).fetchall()

    rosters_by_week: dict[int, dict[int, set[int]]] = {}
    names: dict[int, str] = {}
    for r in rows:
        week = rosters_by_week.setdefault(r["week_num"], {})
        week.setdefault(r["team_id"], set()).add(r["pid"])
        names[r["pid"]] = r["name"]

    moves: list[Move] = []
    weeks = sorted(rosters_by_week)
    for prev_wn, cur_wn in zip(weeks, weeks[1:], strict=False):
        prev = rosters_by_week[prev_wn]
        cur = rosters_by_week[cur_wn]

        gained: dict[int, list[int]] = {}
        lost: dict[int, list[int]] = {}
        for team_id, players in cur.items():
            for pid in players - prev.get(team_id, set()):
                gained.setdefault(pid, []).append(team_id)
        for team_id, players in prev.items():
            for pid in players - cur.get(team_id, set()):
                lost.setdefault(pid, []).append(team_id)

        for pid in sorted(set(gained) | set(lost)):
            gainers = gained.get(pid, [])
            losers = lost.get(pid, [])
            name = names[pid]
            paired = min(len(gainers), len(losers))
            for j in range(paired):
                moves.append((season_id, gainers[j], pid, name, "TRADE_IN", cur_wn))
                moves.append((season_id, losers[j], pid, name, "TRADE_OUT", cur_wn))
            for team_id in gainers[paired:]:
                moves.append((season_id, team_id, pid, name, "ADD", cur_wn))
            for team_id in losers[paired:]:
                moves.append((season_id, team_id, pid, name, "DROP", cur_wn))

    return moves


def store_derived_transactions(conn: sqlite3.Connection, season_id: int) -> None:
    """Replace this season's derived moves. Official ESPN rows are left untouched,
    so re-running is idempotent and never clobbers ingested data."""
    conn.execute(
        "DELETE FROM transactions WHERE season_id = ? AND source = 'derived'",
        (season_id,),
    )
    conn.executemany(
        "INSERT INTO transactions "
        "(season_id, team_id, espn_player_id, player_name, type, bid_amount, occurred_at, "
        "week_num, source) VALUES (?, ?, ?, ?, ?, NULL, '', ?, 'derived')",
        compute_transactions(conn, season_id),
    )
