"""Per-owner prediction-game tokens: hashed storage, generation, listing, revocation."""

from __future__ import annotations

import hashlib
import secrets
import sqlite3
from datetime import UTC, datetime


def hash_token(plaintext: str) -> str:
    """Return the sha256 hex digest used to store/verify a token."""
    return hashlib.sha256(plaintext.encode("utf-8")).hexdigest()


def generate_token(
    conn: sqlite3.Connection, owner_id: str, label: str | None = None
) -> tuple[str, str]:
    """Create a token for an owner, store its hash, and return (plaintext, token_hash).

    The plaintext is shown to the caller exactly once and cannot be recovered later.
    """
    plaintext = secrets.token_urlsafe(24)
    token_hash = hash_token(plaintext)
    created_at = datetime.now(UTC).isoformat()
    conn.execute(
        "INSERT INTO owner_tokens (owner_id, token_hash, label, created_at, revoked_at) "
        "VALUES (?, ?, ?, ?, NULL)",
        (owner_id, token_hash, label, created_at),
    )
    conn.commit()
    return plaintext, token_hash


def list_tokens(conn: sqlite3.Connection) -> list[sqlite3.Row]:
    """Return token metadata (id, owner_id, label, created_at, revoked_at).

    Never includes token_hash: hashes are write-only.
    """
    return conn.execute(
        "SELECT id, owner_id, label, created_at, revoked_at FROM owner_tokens ORDER BY id"
    ).fetchall()


def revoke_token(conn: sqlite3.Connection, token_id: int) -> None:
    """Soft-revoke a token by stamping revoked_at (the row is kept)."""
    conn.execute(
        "UPDATE owner_tokens SET revoked_at = ? WHERE id = ?",
        (datetime.now(UTC).isoformat(), token_id),
    )
    conn.commit()
