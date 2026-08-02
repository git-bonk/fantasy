"""Season clearing helpers so re-ingest is idempotent."""

from __future__ import annotations

import sqlite3

# Computed tables have no foreign keys, so they must be cleared explicitly when a
# season is deleted (CASCADE only covers the raw season/week/team/transaction rows).
_DERIVED_TABLES = (
    "elo_ratings",
    "luck",
    "sos",
    "playoff_snapshots",
    "records",
    "scheduled_matchups",
)


def _week_ids(conn: sqlite3.Connection, season_id: int) -> list[int]:
    return [
        r["id"]
        for r in conn.execute("SELECT id FROM weeks WHERE season_id = ?", (season_id,)).fetchall()
    ]


def _delete_awards(conn: sqlite3.Connection, week_ids: list[int]) -> None:
    # awards.week_id has no ON DELETE CASCADE, so remove them before their weeks.
    if week_ids:
        placeholders = ",".join("?" * len(week_ids))
        conn.execute(f"DELETE FROM awards WHERE week_id IN ({placeholders})", week_ids)


def _delete_derived(conn: sqlite3.Connection, season_id: int) -> None:
    for table in _DERIVED_TABLES:
        conn.execute(f"DELETE FROM {table} WHERE season_id = ?", (season_id,))


def clear_season(conn: sqlite3.Connection, year: int) -> None:
    """Delete a season and all dependent rows so re-ingest is idempotent."""
    row = conn.execute("SELECT id FROM seasons WHERE year = ?", (year,)).fetchone()
    if row is None:
        return
    season_id = row["id"]
    _delete_awards(conn, _week_ids(conn, season_id))
    conn.execute("DELETE FROM seasons WHERE id = ?", (season_id,))  # cascades
    _delete_derived(conn, season_id)
    conn.commit()


def clear_season_data(conn: sqlite3.Connection, season_id: int) -> None:
    """Delete all data for a season but keep the season row itself.
    Used before re-ingesting so store_teams doesn't hit FK constraints."""
    _delete_awards(conn, _week_ids(conn, season_id))
    conn.execute("DELETE FROM weeks WHERE season_id = ?", (season_id,))  # cascades matchups+rosters
    conn.execute("DELETE FROM transactions WHERE season_id = ?", (season_id,))
    conn.execute("DELETE FROM teams WHERE season_id = ?", (season_id,))
    _delete_derived(conn, season_id)
    conn.commit()
