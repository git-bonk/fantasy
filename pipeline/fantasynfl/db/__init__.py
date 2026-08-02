"""SQLite schema, connection helpers, and incremental season writer.

This package is the single source of truth for the database shape. The web app
mirrors these tables in `web/src/lib/types.ts` — keep them in sync.

The incremental write functions (store_teams, store_week, store_transactions)
allow the ingester to commit data week-by-week so progress is durable and
resumable after interruption.
"""

from __future__ import annotations

from .aliases import assign_owner_aliases
from .clear import clear_season, clear_season_data
from .schema import SCHEMA, connect, init_db
from .writers import (
    ensure_season,
    finalize_all_weeks,
    get_completed_weeks,
    get_max_week,
    get_season_status,
    get_unfinalized_weeks,
    set_season_status,
    store_draft,
    store_owners,
    store_scheduled_matchups,
    store_season,
    store_teams,
    store_transactions,
    store_week,
)

__all__ = [
    "SCHEMA",
    "assign_owner_aliases",
    "clear_season",
    "clear_season_data",
    "connect",
    "ensure_season",
    "finalize_all_weeks",
    "get_completed_weeks",
    "get_max_week",
    "get_season_status",
    "get_unfinalized_weeks",
    "init_db",
    "set_season_status",
    "store_draft",
    "store_owners",
    "store_scheduled_matchups",
    "store_season",
    "store_teams",
    "store_transactions",
    "store_week",
]
