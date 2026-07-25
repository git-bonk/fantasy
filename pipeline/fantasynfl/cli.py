"""Command-line entry point: `python -m fantasynfl <command>`."""

from __future__ import annotations

import argparse

from .config import load_config, resolve_db_path


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(prog="fantasynfl", description="Fantasy NFL data pipeline")
    parser.add_argument("--db", help="Path to SQLite DB (overrides DB_PATH)", default=None)
    parser.add_argument("--sims", type=int, default=2000, help="Monte-Carlo sims for playoff odds")
    sub = parser.add_subparsers(dest="command", required=True)

    p_sample = sub.add_parser("sample", help="Generate a synthetic 12-team season")
    p_sample.add_argument("--year", type=int, default=2025)
    p_sample.add_argument("--seed", type=int, default=42)

    sub.add_parser("ingest", help="Ingest real league data from ESPN (needs .env creds)")
    sub.add_parser("compute", help="Recompute stats from existing raw data")

    args = parser.parse_args(argv)
    db_path = resolve_db_path(args.db)

    if args.command == "sample":
        from .ingest import ingest_sample

        ingest_sample(db_path, year=args.year, seed=args.seed, sims=args.sims)
    elif args.command == "ingest":
        from dataclasses import replace

        from .ingest import ingest_espn

        config = load_config(require_creds=True)
        if args.db:
            config = replace(config, db_path=db_path)
        ingest_espn(config, sims=args.sims)
    elif args.command == "compute":
        from .ingest import recompute

        recompute(db_path, sims=args.sims)


if __name__ == "__main__":
    main()
