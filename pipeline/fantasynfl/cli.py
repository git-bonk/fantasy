"""Command-line entry point: `python -m fantasynfl <command>`."""

from __future__ import annotations

import argparse
import os
import sqlite3
from pathlib import Path

from .config import load_config, resolve_db_path


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(prog="fantasynfl", description="Fantasy NFL data pipeline")
    parser.add_argument("--db", help="Path to SQLite DB (overrides DB_PATH)", default=None)
    parser.add_argument("--sims", type=int, default=2000, help="Monte-Carlo sims for playoff odds")
    parser.add_argument("-v", "--verbose", action="store_true", help="Debug-level logging")
    sub = parser.add_subparsers(dest="command", required=True)

    p_sample = sub.add_parser("sample", help="Generate a synthetic 12-team season")
    p_sample.add_argument("--year", type=int, default=2025)
    p_sample.add_argument("--seed", type=int, default=42)

    p_ingest = sub.add_parser(
        "ingest", help="Ingest real league data from ESPN (incremental by default)"
    )
    p_ingest.add_argument(
        "--full",
        action="store_true",
        help="Force a full re-scrape of all weeks instead of incremental",
    )
    p_ingest.add_argument(
        "--year",
        type=int,
        default=None,
        help="Only ingest this season year (default: all configured seasons)",
    )
    sub.add_parser("compute", help="Recompute stats from existing raw data")
    sub.add_parser("status", help="Show ingest progress for all seasons in the DB")
    sub.add_parser(
        "refresh-settings",
        help="Re-fetch league settings / playoff format only (no re-scrape)",
    )
    p_backfill = sub.add_parser(
        "backfill",
        help="One-time targeted backfill: refresh teams + playoff weeks only (cheap)",
    )
    p_backfill.add_argument(
        "--year",
        type=int,
        default=None,
        help="Only backfill this season year (default: all configured seasons)",
    )
    p_backfill.add_argument(
        "--delay",
        type=float,
        default=0.0,
        help="Seconds to pause between week fetches (go easy on the ESPN API)",
    )

    p_nfl_stats = sub.add_parser(
        "nfl-stats",
        help="Refresh complete NFL season stats for the stalest players (rate-limited)",
    )
    p_nfl_stats.add_argument(
        "--max-calls",
        type=int,
        default=25,
        help="Maximum ESPN athlete-API calls this run (owner policy: <= 25/hour)",
    )
    p_nfl_stats.add_argument(
        "--delay",
        type=float,
        default=144.0,
        help="Seconds between calls (default 144 = 25/hour pacing)",
    )

    p_tokens = sub.add_parser("tokens", help="Manage per-owner prediction-game tokens")
    tokens_sub = p_tokens.add_subparsers(dest="tokens_command", required=True)
    p_tokens_gen = tokens_sub.add_parser("generate", help="Generate a token for an owner")
    p_tokens_gen.add_argument("--owner", required=True, help="Owner id or alias_num")
    p_tokens_gen.add_argument("--label", default=None, help="Optional token label")
    tokens_sub.add_parser("list", help="List tokens (never shows hashes)")
    p_tokens_revoke = tokens_sub.add_parser("revoke", help="Soft-revoke a token")
    p_tokens_revoke.add_argument("--id", type=int, required=True, dest="token_id")

    args = parser.parse_args(argv)
    db_path = resolve_db_path(args.db or os.getenv("DB_PATH"))

    if args.command == "sample":
        from .ingest import ingest_sample

        ingest_sample(db_path, year=args.year, seed=args.seed, sims=args.sims, verbose=args.verbose)
    elif args.command == "ingest":
        from dataclasses import replace

        from .ingest import ingest_espn

        config = load_config(require_creds=True)
        if args.db:
            config = replace(config, db_path=db_path)
        ingest_espn(
            config, sims=args.sims, verbose=args.verbose, full=args.full, only_year=args.year
        )
    elif args.command == "compute":
        from .ingest import recompute

        recompute(db_path, sims=args.sims)
    elif args.command == "status":
        from .ingest import show_status

        show_status(db_path)
    elif args.command == "refresh-settings":
        from dataclasses import replace

        from .ingest import refresh_settings

        config = load_config(require_creds=True)
        if args.db:
            config = replace(config, db_path=db_path)
        refresh_settings(config)
    elif args.command == "backfill":
        from dataclasses import replace

        from .ingest import backfill

        config = load_config(require_creds=True)
        if args.db:
            config = replace(config, db_path=db_path)
        backfill(
            config, sims=args.sims, verbose=args.verbose, only_year=args.year, delay=args.delay
        )
    elif args.command == "nfl-stats":
        import logging
        import sys

        from .db import connect, init_db
        from .nfl_refresh import refresh_nfl_stats

        logging.basicConfig(
            level=logging.INFO,
            format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
            datefmt="%H:%M:%S",
            stream=sys.stderr,
        )
        conn = connect(db_path)
        try:
            init_db(conn)
            refresh_nfl_stats(conn, max_calls=args.max_calls, delay=args.delay)
        finally:
            conn.close()
    elif args.command == "tokens":
        _run_tokens(db_path, args)


def _resolve_owner(conn: sqlite3.Connection, ref: str) -> str:
    """Resolve an owner by owners.id or owners.alias_num (accepts either)."""
    row = conn.execute("SELECT id FROM owners WHERE id = ?", (ref,)).fetchone()
    if row:
        return row["id"]
    if ref.isdigit():
        row = conn.execute("SELECT id FROM owners WHERE alias_num = ?", (int(ref),)).fetchone()
        if row:
            return row["id"]
    raise SystemExit(f"No owner matching {ref!r} (by id or alias_num)")


def _run_tokens(db_path: Path, args: argparse.Namespace) -> None:
    from . import tokens
    from .db import connect, init_db

    conn = connect(db_path)
    try:
        init_db(conn)
        if args.tokens_command == "generate":
            owner_id = _resolve_owner(conn, args.owner)
            plaintext, _ = tokens.generate_token(conn, owner_id, args.label)
            print(f"Owner: {owner_id}")
            print(f"Token: {plaintext}")
            print("WARNING: this token is shown only once and cannot be recovered.")
        elif args.tokens_command == "list":
            rows = conn.execute(
                "SELECT t.id, t.owner_id, o.alias_num, t.label, t.created_at, t.revoked_at "
                "FROM owner_tokens t LEFT JOIN owners o ON o.id = t.owner_id ORDER BY t.id"
            ).fetchall()
            if not rows:
                print("No tokens.")
            for r in rows:
                alias = f" (alias {r['alias_num']})" if r["alias_num"] is not None else ""
                revoked = r["revoked_at"] or "-"
                print(
                    f"#{r['id']} owner={r['owner_id']}{alias} "
                    f"label={r['label'] or '-'} created={r['created_at']} revoked={revoked}"
                )
        elif args.tokens_command == "revoke":
            tokens.revoke_token(conn, args.token_id)
            print(f"Token #{args.token_id} revoked.")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
