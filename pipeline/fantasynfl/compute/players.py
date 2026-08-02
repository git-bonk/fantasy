"""Derive the normalized ``players`` entity table from roster appearances.

Cross-season pass (like ``owner_elo``): one row per ESPN player id with the most
recently seen name/position/nfl_team and the first/last season (by year, not by
row id) the player appeared on any roster.
"""

from __future__ import annotations

import sqlite3

_SQL = """
SELECT espn_player_id, player_name, position, nfl_team, first_season_id, last_season_id
FROM (
  SELECT r.espn_player_id AS espn_player_id,
         r.player_name AS player_name,
         r.position AS position,
         r.nfl_team AS nfl_team,
         FIRST_VALUE(s.id) OVER (
           PARTITION BY r.espn_player_id ORDER BY s.year ASC
         ) AS first_season_id,
         FIRST_VALUE(s.id) OVER (
           PARTITION BY r.espn_player_id ORDER BY s.year DESC
         ) AS last_season_id,
         ROW_NUMBER() OVER (
           PARTITION BY r.espn_player_id ORDER BY s.year DESC, w.week_num DESC
         ) AS rn
  FROM rosters r
  JOIN weeks w ON w.id = r.week_id
  JOIN seasons s ON s.id = w.season_id
)
WHERE rn = 1
"""


def compute_players(conn: sqlite3.Connection) -> None:
    rows = conn.execute(_SQL).fetchall()
    conn.executemany(
        "INSERT INTO players "
        "(espn_player_id, full_name, position, nfl_team, first_season_id, last_season_id) "
        "VALUES (?, ?, ?, ?, ?, ?) "
        "ON CONFLICT(espn_player_id) DO UPDATE SET "
        "full_name = excluded.full_name, position = excluded.position, "
        "nfl_team = excluded.nfl_team, first_season_id = excluded.first_season_id, "
        "last_season_id = excluded.last_season_id",
        [
            (
                r["espn_player_id"],
                r["player_name"],
                r["position"],
                r["nfl_team"],
                r["first_season_id"],
                r["last_season_id"],
            )
            for r in rows
        ],
    )
    conn.commit()
