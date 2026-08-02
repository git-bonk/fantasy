"""Incremental and bulk season writers used by the ingester and sample generator."""

from __future__ import annotations

import json
import sqlite3
from datetime import UTC, datetime

from ..models import (
    DraftPick,
    Matchup,
    Owner,
    ScheduledMatchup,
    SeasonData,
    Team,
    Transaction,
    WeekInfo,
    WeekRoster,
)
from .aliases import assign_owner_aliases
from .clear import clear_season

# ---------------------------------------------------------------------------
# Incremental write functions — used by the resumable ESPN ingester
# ---------------------------------------------------------------------------


def ensure_season(conn: sqlite3.Connection, year: int, league_id: str, settings: dict) -> int:
    """Get or create a season row. Updates league_id if it changed. Returns season_id."""
    row = conn.execute("SELECT id FROM seasons WHERE year = ?", (year,)).fetchone()
    if row:
        # Update league_id in case it was previously sample data
        conn.execute(
            "UPDATE seasons SET league_id = ?, settings_json = ? WHERE id = ?",
            (league_id, json.dumps(settings), row["id"]),
        )
        conn.commit()
        return row["id"]
    now = datetime.now(UTC).isoformat()
    cur = conn.execute(
        "INSERT INTO seasons (year, league_id, settings_json, created_at) VALUES (?, ?, ?, ?)",
        (year, league_id, json.dumps(settings), now),
    )
    conn.commit()
    return cur.lastrowid


def store_owners(conn: sqlite3.Connection, owners: list[Owner]) -> None:
    conn.executemany(
        "INSERT INTO owners (id, display_name, first_name, last_name) "
        "VALUES (?, ?, ?, ?) "
        "ON CONFLICT(id) DO UPDATE SET "
        "display_name = excluded.display_name, "
        "first_name = excluded.first_name, "
        "last_name = excluded.last_name",
        [(o.owner_id, o.display_name, o.first_name, o.last_name) for o in owners],
    )
    assign_owner_aliases(conn)


def store_teams(conn: sqlite3.Connection, season_id: int, teams: list[Team]) -> dict[int, int]:
    """Insert or update teams for a season. Returns {espn_team_id: db_row_id}.

    Uses an upsert keyed on (season_id, espn_team_id) so incremental ingests can
    refresh standings/final_standing without disturbing the stable row ids that
    matchups and rosters reference.
    """
    for t in teams:
        conn.execute(
            "INSERT INTO teams "
            "(season_id, espn_team_id, name, abbrev, owner_name, color, logo_url, owner_id, "
            "standing, final_standing) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) "
            "ON CONFLICT(season_id, espn_team_id) DO UPDATE SET "
            "name = excluded.name, abbrev = excluded.abbrev, owner_name = excluded.owner_name, "
            "color = excluded.color, logo_url = excluded.logo_url, owner_id = excluded.owner_id, "
            "standing = excluded.standing, final_standing = excluded.final_standing",
            (
                season_id,
                t.espn_team_id,
                t.name,
                t.abbrev,
                t.owner_name,
                t.color,
                t.logo_url,
                t.owner_id,
                t.standing,
                t.final_standing,
            ),
        )
    rows = conn.execute(
        "SELECT id, espn_team_id FROM teams WHERE season_id = ?", (season_id,)
    ).fetchall()
    conn.commit()
    return {r["espn_team_id"]: r["id"] for r in rows}


def get_completed_weeks(conn: sqlite3.Connection, season_id: int) -> set[int]:
    """Return the set of week_nums already stored for a season."""
    rows = conn.execute("SELECT week_num FROM weeks WHERE season_id = ?", (season_id,)).fetchall()
    return {r["week_num"] for r in rows}


def get_season_status(conn: sqlite3.Connection, year: int) -> str | None:
    """Return the season's status ('active'/'complete'), or None if not ingested."""
    row = conn.execute("SELECT status FROM seasons WHERE year = ?", (year,)).fetchone()
    return row["status"] if row else None


def set_season_status(conn: sqlite3.Connection, season_id: int, status: str) -> None:
    conn.execute("UPDATE seasons SET status = ? WHERE id = ?", (status, season_id))
    conn.commit()


def get_max_week(conn: sqlite3.Connection, season_id: int) -> int | None:
    """Return the highest stored week_num for a season, or None if no weeks."""
    row = conn.execute(
        "SELECT MAX(week_num) AS mw FROM weeks WHERE season_id = ?", (season_id,)
    ).fetchone()
    return row["mw"] if row and row["mw"] is not None else None


def get_unfinalized_weeks(conn: sqlite3.Connection, season_id: int) -> set[int]:
    """Return week_nums stored but not yet finalized (still in progress)."""
    rows = conn.execute(
        "SELECT week_num FROM weeks WHERE season_id = ? AND finalized = 0", (season_id,)
    ).fetchall()
    return {r["week_num"] for r in rows}


def finalize_all_weeks(conn: sqlite3.Connection, season_id: int) -> None:
    """Mark every week of a season finalized (used when the season ends)."""
    conn.execute("UPDATE weeks SET finalized = 1 WHERE season_id = ?", (season_id,))
    conn.commit()


def store_week(
    conn: sqlite3.Connection,
    season_id: int,
    team_row_id: dict[int, int],
    week_info: WeekInfo,
    matchups: list[Matchup],
    rosters: list[WeekRoster],
    finalized: bool = False,
) -> None:
    """Store one week's data and commit. Idempotent: deletes existing week first.

    ``finalized`` marks a week as frozen (its scores are final and it will not be
    re-fetched on incremental runs). Weeks at or beyond ESPN's current week stay
    unfinalized so the next run refreshes them.
    """
    # Delete existing week data if re-running
    existing = conn.execute(
        "SELECT id FROM weeks WHERE season_id = ? AND week_num = ?",
        (season_id, week_info.week_num),
    ).fetchone()
    if existing:
        week_id = existing["id"]
        conn.execute("DELETE FROM awards WHERE week_id = ?", (week_id,))
        conn.execute("DELETE FROM weeks WHERE id = ?", (week_id,))  # cascades matchups+rosters

    cur = conn.execute(
        "INSERT INTO weeks "
        "(season_id, week_num, label, start_date, end_date, is_playoff, finalized) "
        "VALUES (?, ?, ?, ?, ?, ?, ?)",
        (
            season_id,
            week_info.week_num,
            week_info.label,
            week_info.start_date,
            week_info.end_date,
            int(week_info.is_playoff),
            int(finalized),
        ),
    )
    week_id = cur.lastrowid

    for m in matchups:
        home_id = team_row_id[m.home_team_id]
        away_id = team_row_id[m.away_team_id]
        if m.home_score > m.away_score:
            winner = home_id
        elif m.away_score > m.home_score:
            winner = away_id
        else:
            winner = None
        conn.execute(
            "INSERT INTO matchups "
            "(week_id, home_team_id, away_team_id, home_score, away_score, winner_team_id, "
            "is_playoff, playoff_tier) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (
                week_id,
                home_id,
                away_id,
                m.home_score,
                m.away_score,
                winner,
                int(m.is_playoff),
                m.playoff_tier,
            ),
        )

    for r in rosters:
        tid = team_row_id[r.team_id]
        conn.executemany(
            "INSERT INTO rosters "
            "(week_id, team_id, espn_player_id, player_name, position, nfl_team, lineup_slot, "
            "points) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            [
                (
                    week_id,
                    tid,
                    p.espn_player_id,
                    p.name,
                    p.position,
                    p.nfl_team,
                    p.lineup_slot,
                    p.points,
                )
                for p in r.players
            ],
        )

    conn.commit()


def store_transactions(
    conn: sqlite3.Connection,
    season_id: int,
    team_row_id: dict[int, int],
    transactions: list[Transaction],
) -> None:
    """Store transactions for a season. Clears existing first."""
    conn.execute("DELETE FROM transactions WHERE season_id = ?", (season_id,))
    for tx in transactions:
        tid = team_row_id[tx.team_id] if tx.team_id is not None else None
        conn.execute(
            "INSERT INTO transactions "
            "(season_id, team_id, espn_player_id, player_name, type, bid_amount, occurred_at, "
            "source) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (
                season_id,
                tid,
                tx.espn_player_id,
                tx.player_name,
                tx.type,
                tx.bid_amount,
                tx.occurred_at,
                "espn",
            ),
        )
    conn.commit()


def store_draft(conn: sqlite3.Connection, season_id: int, draft_picks: list[DraftPick]) -> None:
    """Store a season's draft picks, resolving team_id from the teams table.

    Idempotent: deletes the season's existing picks first, then inserts. A pick's
    ``team_id`` is looked up by ``(season_id, espn_team_id)`` and left NULL when no
    team matches, so the board still renders unmatched picks. Commits like the
    sibling writers.
    """
    mapping = {
        r["espn_team_id"]: r["id"]
        for r in conn.execute(
            "SELECT id, espn_team_id FROM teams WHERE season_id = ?", (season_id,)
        ).fetchall()
    }
    conn.execute("DELETE FROM draft_picks WHERE season_id = ?", (season_id,))
    conn.executemany(
        "INSERT INTO draft_picks "
        "(season_id, team_id, espn_team_id, round_num, round_pick, overall_pick, "
        "espn_player_id, player_name, position, nfl_team, bid_amount, keeper_status, "
        "nominating_espn_team_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
            (
                season_id,
                mapping.get(p.espn_team_id),
                p.espn_team_id,
                p.round_num,
                p.round_pick,
                p.overall_pick,
                p.espn_player_id,
                p.player_name,
                p.position,
                p.nfl_team,
                p.bid_amount,
                p.keeper_status,
                p.nominating_espn_team_id,
            )
            for p in draft_picks
        ],
    )
    conn.commit()


def store_scheduled_matchups(
    conn: sqlite3.Connection, season_id: int, rows: list[ScheduledMatchup]
) -> None:
    """Insert full-season pairings, mapping espn_team_id -> internal teams.id.

    Idempotent via INSERT OR IGNORE on the (season_id, week_num, home, away) UNIQUE.
    ``kickoff`` is left NULL here; the lock/fallback layer or real dates fill it.
    """
    mapping = {
        r["espn_team_id"]: r["id"]
        for r in conn.execute(
            "SELECT id, espn_team_id FROM teams WHERE season_id = ?", (season_id,)
        ).fetchall()
    }
    for row in rows:
        home = mapping.get(row.home_espn_id)
        away = mapping.get(row.away_espn_id)
        if home is None or away is None:
            continue
        conn.execute(
            "INSERT OR IGNORE INTO scheduled_matchups "
            "(season_id, week_num, home_team_id, away_team_id, kickoff) "
            "VALUES (?, ?, ?, ?, NULL)",
            (season_id, row.week_num, home, away),
        )
    conn.commit()


# ---------------------------------------------------------------------------
# Bulk write (used by the sample generator; built on the incremental writers)
# ---------------------------------------------------------------------------


def store_season(conn: sqlite3.Connection, season: SeasonData) -> int:
    """Write a season's raw data in one shot. Idempotent: clears existing rows.

    Built on the same incremental writers the ESPN ingester uses, so the bulk and
    incremental paths cannot drift apart.
    """
    clear_season(conn, season.year)
    now = datetime.now(UTC).isoformat()
    cur = conn.execute(
        "INSERT INTO seasons (year, league_id, settings_json, created_at) VALUES (?, ?, ?, ?)",
        (season.year, season.league_id, json.dumps(season.settings), now),
    )
    season_id = cur.lastrowid

    store_owners(conn, season.owners)
    team_row_id = store_teams(conn, season_id, season.teams)

    matchups_by_week: dict[int, list[Matchup]] = {}
    for m in season.matchups:
        matchups_by_week.setdefault(m.week_num, []).append(m)
    rosters_by_week: dict[int, list[WeekRoster]] = {}
    for r in season.rosters:
        rosters_by_week.setdefault(r.week_num, []).append(r)

    for w in season.weeks:
        store_week(
            conn,
            season_id,
            team_row_id,
            w,
            matchups_by_week.get(w.week_num, []),
            rosters_by_week.get(w.week_num, []),
        )

    store_transactions(conn, season_id, team_row_id, season.transactions)
    conn.commit()
    return season_id
