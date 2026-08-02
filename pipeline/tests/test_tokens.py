import sqlite3

from fantasynfl.db import SCHEMA
from fantasynfl.tokens import generate_token, hash_token, list_tokens, revoke_token


def _conn() -> sqlite3.Connection:
    conn = sqlite3.connect(":memory:")
    conn.row_factory = sqlite3.Row
    conn.executescript(SCHEMA)
    conn.execute("INSERT INTO owners (id, display_name, alias_num) VALUES ('o1', 'Owner One', 1)")
    conn.commit()
    return conn


def test_hash_verify_roundtrip():
    conn = _conn()
    plaintext, token_hash = generate_token(conn, "o1", label="phone")
    assert hash_token(plaintext) == token_hash
    stored = conn.execute("SELECT token_hash FROM owner_tokens WHERE owner_id = 'o1'").fetchone()
    assert stored["token_hash"] == token_hash == hash_token(plaintext)


def test_generated_tokens_are_unique():
    conn = _conn()
    p1, h1 = generate_token(conn, "o1")
    p2, h2 = generate_token(conn, "o1")
    assert p1 != p2
    assert h1 != h2


def test_soft_revoke_sets_revoked_at():
    conn = _conn()
    generate_token(conn, "o1")
    token_id = conn.execute("SELECT id FROM owner_tokens").fetchone()["id"]
    assert conn.execute("SELECT revoked_at FROM owner_tokens").fetchone()["revoked_at"] is None
    revoke_token(conn, token_id)
    row = conn.execute("SELECT revoked_at, token_hash FROM owner_tokens").fetchone()
    assert row["revoked_at"] is not None
    assert row["token_hash"] is not None


def test_list_tokens_excludes_hash():
    conn = _conn()
    generate_token(conn, "o1", label="phone")
    rows = list_tokens(conn)
    assert len(rows) == 1
    assert set(rows[0].keys()) == {"id", "owner_id", "label", "created_at", "revoked_at"}
    assert "token_hash" not in set(rows[0].keys())
