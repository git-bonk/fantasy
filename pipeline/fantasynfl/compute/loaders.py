"""Database loaders that hydrate compute inputs (team ids and GameResult lists).

Kept separate from the pure stat modules so they can import these without a
circular dependency on the orchestrator in ``__init__``.
"""

from __future__ import annotations

import sqlite3

from .types import GameResult


def load_team_ids(conn: sqlite3.Connection, season_id: int) -> list[int]:
    rows = conn.execute("SELECT id FROM teams WHERE season_id = ?", (season_id,)).fetchall()
    return [r["id"] for r in rows]


def load_games(conn: sqlite3.Connection, season_id: int) -> list[GameResult]:
    sql = """
    SELECT w.week_num AS week_num, m.home_team_id AS home_id, m.away_team_id AS away_id,
           m.home_score AS home_score, m.away_score AS away_score, m.is_playoff AS is_playoff
    FROM matchups m
    JOIN weeks w ON w.id = m.week_id
    WHERE w.season_id = ?
    ORDER BY w.week_num
    """
    return [
        GameResult(
            r["week_num"],
            r["home_id"],
            r["away_id"],
            r["home_score"],
            r["away_score"],
            bool(r["is_playoff"]),
        )
        for r in conn.execute(sql, (season_id,)).fetchall()
    ]
