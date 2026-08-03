"""Rate-limited refresh of complete NFL season stats (Phase 2).

Owner policy: never more than 25 ESPN athlete-API calls per hour, spread over the day.
Each run works the stalest players first (NULL ``nfl_stats_fetched_at`` first), so
repeated capped runs make monotonic progress with no coordination. DEF units are not
ESPN athletes (the endpoint returns nothing for negative ids) — they are marked fetched
without spending a call, so ``max_calls`` budgets real API calls only.
"""

from __future__ import annotations

import logging
import sqlite3
import time
from datetime import UTC, datetime

from .db.writers import store_player_nfl_seasons
from .nfl_api import fetch_athlete_season_stats

log = logging.getLogger("fantasynfl.nfl_refresh")

DEFAULT_MAX_CALLS = 25
DEFAULT_DELAY = 144.0  # seconds between calls -> 25/hour


def _stalest_players(conn: sqlite3.Connection) -> list[sqlite3.Row]:
    return conn.execute(
        "SELECT id, espn_player_id, full_name, position FROM players "
        "ORDER BY (nfl_stats_fetched_at IS NULL) DESC, nfl_stats_fetched_at ASC, id"
    ).fetchall()


def refresh_nfl_stats(
    conn: sqlite3.Connection,
    max_calls: int = DEFAULT_MAX_CALLS,
    delay: float = DEFAULT_DELAY,
) -> int:
    """Refresh stalest players until ``max_calls`` API calls are spent.

    DEF units are marked fetched for free (they are not ESPN athletes). Returns the
    number of API calls made.
    """
    calls = 0
    for player in _stalest_players(conn):
        if calls >= max_calls:
            break
        fetched_at = datetime.now(UTC).isoformat()
        if player["position"] == "DEF" or player["espn_player_id"] < 0:
            store_player_nfl_seasons(conn, player["id"], [], fetched_at)
            log.info("nfl-stats: %s is a DEF unit - marked fetched, no call", player["full_name"])
            continue
        if calls > 0 and delay > 0:
            time.sleep(delay)
        try:
            seasons = fetch_athlete_season_stats(player["espn_player_id"])
        except Exception:
            log.warning(
                "nfl-stats: %s (%d) failed - marking fetched so it doesn't block the queue",
                player["full_name"],
                player["espn_player_id"],
                exc_info=True,
            )
            seasons = []
        calls += 1
        store_player_nfl_seasons(conn, player["id"], seasons, fetched_at)
        log.info(
            "nfl-stats: %s (%d) -> %d seasons",
            player["full_name"],
            player["espn_player_id"],
            len(seasons),
        )
    log.info("nfl-stats: done (%d API calls this run)", calls)
    return calls
