import sqlite3

from fantasynfl.db import SCHEMA, assign_owner_aliases, store_owners, store_season
from fantasynfl.models import Owner
from fantasynfl.sample import generate_season


def _conn() -> sqlite3.Connection:
    conn = sqlite3.connect(":memory:")
    conn.row_factory = sqlite3.Row
    conn.executescript(SCHEMA)
    return conn


def _insert_owner(conn: sqlite3.Connection, oid: str, alias_num: int | None = None) -> None:
    conn.execute(
        "INSERT INTO owners (id, display_name, alias_num) VALUES (?, ?, ?)",
        (oid, oid, alias_num),
    )
    conn.commit()


def _alias(conn: sqlite3.Connection, oid: str) -> int:
    return conn.execute("SELECT alias_num FROM owners WHERE id = ?", (oid,)).fetchone()[0]


def test_assigns_in_sorted_id_order():
    conn = _conn()
    for oid in ("c", "a", "b"):
        _insert_owner(conn, oid)
    assign_owner_aliases(conn)
    assert (_alias(conn, "a"), _alias(conn, "b"), _alias(conn, "c")) == (1, 2, 3)


def test_continues_from_max():
    conn = _conn()
    _insert_owner(conn, "a", alias_num=5)
    _insert_owner(conn, "b")
    assign_owner_aliases(conn)
    assert _alias(conn, "a") == 5
    assert _alias(conn, "b") == 6


def test_idempotent():
    conn = _conn()
    for oid in ("a", "b"):
        _insert_owner(conn, oid)
    assign_owner_aliases(conn)
    assign_owner_aliases(conn)
    assert (_alias(conn, "a"), _alias(conn, "b")) == (1, 2)


def test_new_owner_gets_next_number():
    conn = _conn()
    _insert_owner(conn, "a")
    _insert_owner(conn, "b")
    assign_owner_aliases(conn)
    _insert_owner(conn, "c")
    assign_owner_aliases(conn)
    assert (_alias(conn, "a"), _alias(conn, "b"), _alias(conn, "c")) == (1, 2, 3)


def test_store_owners_assigns_aliases():
    conn = _conn()
    store_owners(conn, [Owner("z", "Zed"), Owner("m", "Em")])
    assert _alias(conn, "m") == 1
    assert _alias(conn, "z") == 2


def test_sample_owners_numbered_and_linked():
    season = generate_season(year=2025, seed=42)
    assert len(season.owners) == 12
    conn = _conn()
    season_id = store_season(conn, season)
    nums = sorted(r[0] for r in conn.execute("SELECT alias_num FROM owners").fetchall())
    assert nums == list(range(1, 13))
    linked = conn.execute(
        "SELECT COUNT(*) FROM teams WHERE season_id = ? AND owner_id IS NOT NULL",
        (season_id,),
    ).fetchone()[0]
    assert linked == 12
    orphans = conn.execute(
        "SELECT COUNT(*) FROM teams t WHERE t.owner_id IS NOT NULL "
        "AND t.owner_id NOT IN (SELECT id FROM owners)"
    ).fetchone()[0]
    assert orphans == 0
