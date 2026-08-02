"""Owner alias assignment."""

from __future__ import annotations

import sqlite3


def assign_owner_aliases(conn: sqlite3.Connection) -> None:
    max_num = conn.execute("SELECT COALESCE(MAX(alias_num), 0) FROM owners").fetchone()[0]
    unnumbered = conn.execute(
        "SELECT id FROM owners WHERE alias_num IS NULL ORDER BY id"
    ).fetchall()
    for offset, row in enumerate(unnumbered, start=1):
        conn.execute("UPDATE owners SET alias_num = ? WHERE id = ?", (max_num + offset, row[0]))
    conn.commit()
