"""SQLite schema, connection helpers, and incremental season writer.

This module is the single source of truth for the database shape. The web app
mirrors these tables in `web/src/lib/types.ts` — keep them in sync.

The incremental write functions (store_teams, store_week, store_transactions)
allow the ingester to commit data week-by-week so progress is durable and
resumable after interruption.
"""

from __future__ import annotations

import json
import sqlite3
from datetime import UTC, datetime
from pathlib import Path

from .models import (
    Matchup,
    Owner,
    RosterPlayer,
    SeasonData,
    Team,
    Transaction,
    WeekInfo,
    WeekRoster,
)

SCHEMA = """
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS seasons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  year INTEGER NOT NULL UNIQUE,
  league_id TEXT NOT NULL,
  settings_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active'
);

CREATE TABLE IF NOT EXISTS owners (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  alias_num INTEGER UNIQUE
);

CREATE TABLE IF NOT EXISTS teams (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  season_id INTEGER NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  espn_team_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  abbrev TEXT NOT NULL,
  owner_name TEXT NOT NULL,
  color TEXT NOT NULL,
  logo_url TEXT,
  owner_id TEXT REFERENCES owners(id),
  standing INTEGER,
  final_standing INTEGER,
  UNIQUE(season_id, espn_team_id)
);

CREATE TABLE IF NOT EXISTS weeks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  season_id INTEGER NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  week_num INTEGER NOT NULL,
  label TEXT NOT NULL,
  start_date TEXT,
  end_date TEXT,
  is_playoff INTEGER NOT NULL DEFAULT 0,
  finalized INTEGER NOT NULL DEFAULT 0,
  UNIQUE(season_id, week_num)
);

CREATE TABLE IF NOT EXISTS matchups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  week_id INTEGER NOT NULL REFERENCES weeks(id) ON DELETE CASCADE,
  home_team_id INTEGER NOT NULL REFERENCES teams(id),
  away_team_id INTEGER NOT NULL REFERENCES teams(id),
  home_score REAL NOT NULL,
  away_score REAL NOT NULL,
  winner_team_id INTEGER REFERENCES teams(id),
  is_playoff INTEGER NOT NULL DEFAULT 0,
  playoff_tier TEXT NOT NULL DEFAULT 'NONE'
);

CREATE TABLE IF NOT EXISTS rosters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  week_id INTEGER NOT NULL REFERENCES weeks(id) ON DELETE CASCADE,
  team_id INTEGER NOT NULL REFERENCES teams(id),
  espn_player_id INTEGER NOT NULL,
  player_name TEXT NOT NULL,
  position TEXT NOT NULL,
  nfl_team TEXT NOT NULL,
  lineup_slot TEXT NOT NULL,
  points REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  season_id INTEGER NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  team_id INTEGER REFERENCES teams(id),
  espn_player_id INTEGER,
  player_name TEXT,
  type TEXT NOT NULL,
  bid_amount INTEGER,
  occurred_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS elo_ratings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  season_id INTEGER NOT NULL,
  team_id INTEGER NOT NULL,
  week_num INTEGER NOT NULL,
  rating REAL NOT NULL,
  UNIQUE(season_id, team_id, week_num)
);

CREATE TABLE IF NOT EXISTS owner_elo (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id TEXT NOT NULL REFERENCES owners(id),
  season_id INTEGER NOT NULL,
  week_num INTEGER NOT NULL,
  rating REAL NOT NULL,
  UNIQUE(owner_id, season_id, week_num)
);

CREATE TABLE IF NOT EXISTS luck (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  season_id INTEGER NOT NULL,
  team_id INTEGER NOT NULL,
  week_num INTEGER NOT NULL,
  actual_wins REAL NOT NULL,
  expected_wins REAL NOT NULL,
  luck_score REAL NOT NULL,
  UNIQUE(season_id, team_id, week_num)
);

CREATE TABLE IF NOT EXISTS awards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  week_id INTEGER NOT NULL,
  type TEXT NOT NULL,
  team_id INTEGER,
  player_name TEXT,
  value REAL,
  detail TEXT
);

CREATE TABLE IF NOT EXISTS sos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  season_id INTEGER NOT NULL,
  team_id INTEGER NOT NULL,
  week_num INTEGER NOT NULL,
  opp_avg_points REAL NOT NULL,
  sos_rank INTEGER,
  UNIQUE(season_id, team_id, week_num)
);

CREATE TABLE IF NOT EXISTS playoff_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  season_id INTEGER NOT NULL,
  week_num INTEGER NOT NULL,
  team_id INTEGER NOT NULL,
  wins INTEGER NOT NULL,
  losses INTEGER NOT NULL,
  ties INTEGER NOT NULL DEFAULT 0,
  points_for REAL NOT NULL,
  points_against REAL NOT NULL,
  playoff_seed INTEGER,
  playoff_odds REAL,
  UNIQUE(season_id, week_num, team_id)
);

CREATE TABLE IF NOT EXISTS records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category TEXT NOT NULL,
  rank INTEGER NOT NULL,
  season_id INTEGER,
  team_id INTEGER,
  player_name TEXT,
  value REAL,
  detail TEXT
);

CREATE INDEX IF NOT EXISTS idx_teams_season ON teams(season_id);
CREATE INDEX IF NOT EXISTS idx_weeks_season ON weeks(season_id);
CREATE INDEX IF NOT EXISTS idx_matchups_week ON matchups(week_id);
CREATE INDEX IF NOT EXISTS idx_rosters_week ON rosters(week_id);
CREATE INDEX IF NOT EXISTS idx_rosters_team ON rosters(team_id);
CREATE INDEX IF NOT EXISTS idx_awards_week ON awards(week_id);
CREATE INDEX IF NOT EXISTS idx_elo_season ON elo_ratings(season_id, team_id);
CREATE INDEX IF NOT EXISTS idx_owner_elo ON owner_elo(owner_id, season_id);
CREATE INDEX IF NOT EXISTS idx_playoff_season ON playoff_snapshots(season_id, week_num);
"""


def connect(db_path: Path, readonly: bool = False) -> sqlite3.Connection:
    db_path.parent.mkdir(parents=True, exist_ok=True)
    if readonly:
        uri = f"file:{db_path}?mode=ro"
        conn = sqlite3.connect(uri, uri=True)
    else:
        conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db(conn: sqlite3.Connection) -> None:
    conn.executescript(SCHEMA)
    team_cols = {r["name"] for r in conn.execute("PRAGMA table_info(teams)").fetchall()}
    if "owner_id" not in team_cols:
        try:
            conn.execute("ALTER TABLE teams ADD COLUMN owner_id TEXT REFERENCES owners(id)")
        except sqlite3.OperationalError:
            pass
    if "standing" not in team_cols:
        try:
            conn.execute("ALTER TABLE teams ADD COLUMN standing INTEGER")
        except sqlite3.OperationalError:
            pass
    if "final_standing" not in team_cols:
        try:
            conn.execute("ALTER TABLE teams ADD COLUMN final_standing INTEGER")
        except sqlite3.OperationalError:
            pass
    matchup_cols = {r["name"] for r in conn.execute("PRAGMA table_info(matchups)").fetchall()}
    if "playoff_tier" not in matchup_cols:
        try:
            conn.execute(
                "ALTER TABLE matchups ADD COLUMN playoff_tier TEXT NOT NULL DEFAULT 'NONE'"
            )
        except sqlite3.OperationalError:
            pass
    owner_cols = {r["name"] for r in conn.execute("PRAGMA table_info(owners)").fetchall()}
    if "alias_num" not in owner_cols:
        try:
            conn.execute("ALTER TABLE owners ADD COLUMN alias_num INTEGER")
        except sqlite3.OperationalError:
            pass
    if "last_seen_season_id" in owner_cols:
        try:
            conn.execute("ALTER TABLE owners DROP COLUMN last_seen_season_id")
        except sqlite3.OperationalError:
            pass
    week_cols = {r["name"] for r in conn.execute("PRAGMA table_info(weeks)").fetchall()}
    if "finalized" not in week_cols:
        try:
            conn.execute("ALTER TABLE weeks ADD COLUMN finalized INTEGER NOT NULL DEFAULT 0")
            conn.execute(
                "UPDATE weeks SET finalized = 1 WHERE week_num < "
                "(SELECT MAX(w2.week_num) FROM weeks w2 WHERE w2.season_id = weeks.season_id)"
            )
        except sqlite3.OperationalError:
            pass
    season_cols = {r["name"] for r in conn.execute("PRAGMA table_info(seasons)").fetchall()}
    if "status" not in season_cols:
        try:
            conn.execute("ALTER TABLE seasons ADD COLUMN status TEXT NOT NULL DEFAULT 'active'")
            conn.execute(
                "UPDATE seasons SET status = 'complete' WHERE id IN "
                "(SELECT season_id FROM teams WHERE final_standing IS NOT NULL "
                "AND final_standing > 0)"
            )
        except sqlite3.OperationalError:
            pass
    conn.commit()


def clear_season(conn: sqlite3.Connection, year: int) -> None:
    """Delete a season and all dependent rows so re-ingest is idempotent."""
    row = conn.execute("SELECT id FROM seasons WHERE year = ?", (year,)).fetchone()
    if row is None:
        return
    season_id = row["id"]
    week_ids = [
        r["id"]
        for r in conn.execute("SELECT id FROM weeks WHERE season_id = ?", (season_id,)).fetchall()
    ]
    if week_ids:
        placeholders = ",".join("?" * len(week_ids))
        conn.execute(f"DELETE FROM awards WHERE week_id IN ({placeholders})", week_ids)
    conn.execute("DELETE FROM seasons WHERE id = ?", (season_id,))  # cascades
    for table in ("elo_ratings", "luck", "sos", "playoff_snapshots", "records"):
        conn.execute(f"DELETE FROM {table} WHERE season_id = ?", (season_id,))
    conn.commit()


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


def clear_season_data(conn: sqlite3.Connection, season_id: int) -> None:
    """Delete all data for a season but keep the season row itself.
    Used before re-ingesting so store_teams doesn't hit FK constraints."""
    week_ids = [
        r["id"]
        for r in conn.execute("SELECT id FROM weeks WHERE season_id = ?", (season_id,)).fetchall()
    ]
    if week_ids:
        placeholders = ",".join("?" * len(week_ids))
        conn.execute(f"DELETE FROM awards WHERE week_id IN ({placeholders})", week_ids)
    conn.execute("DELETE FROM weeks WHERE season_id = ?", (season_id,))  # cascades matchups+rosters
    conn.execute("DELETE FROM transactions WHERE season_id = ?", (season_id,))
    conn.execute("DELETE FROM teams WHERE season_id = ?", (season_id,))
    for table in ("elo_ratings", "luck", "sos", "playoff_snapshots", "records"):
        conn.execute(f"DELETE FROM {table} WHERE season_id = ?", (season_id,))
    conn.commit()


def assign_owner_aliases(conn: sqlite3.Connection) -> None:
    max_num = conn.execute("SELECT COALESCE(MAX(alias_num), 0) FROM owners").fetchone()[0]
    unnumbered = conn.execute(
        "SELECT id FROM owners WHERE alias_num IS NULL ORDER BY id"
    ).fetchall()
    for offset, row in enumerate(unnumbered, start=1):
        conn.execute(
            "UPDATE owners SET alias_num = ? WHERE id = ?", (max_num + offset, row[0])
        )
    conn.commit()


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
            (season_id, t.espn_team_id, t.name, t.abbrev, t.owner_name, t.color, t.logo_url,
             t.owner_id, t.standing, t.final_standing),
        )
    rows = conn.execute(
        "SELECT id, espn_team_id FROM teams WHERE season_id = ?", (season_id,)
    ).fetchall()
    conn.commit()
    return {r["espn_team_id"]: r["id"] for r in rows}


def get_completed_weeks(conn: sqlite3.Connection, season_id: int) -> set[int]:
    """Return the set of week_nums already stored for a season."""
    rows = conn.execute(
        "SELECT week_num FROM weeks WHERE season_id = ?", (season_id,)
    ).fetchall()
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
        (season_id, week_info.week_num, week_info.label, week_info.start_date,
         week_info.end_date, int(week_info.is_playoff), int(finalized)),
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
            (week_id, home_id, away_id, m.home_score, m.away_score, winner, int(m.is_playoff),
             m.playoff_tier),
        )

    for r in rosters:
        tid = team_row_id[r.team_id]
        conn.executemany(
            "INSERT INTO rosters "
            "(week_id, team_id, espn_player_id, player_name, position, nfl_team, lineup_slot, "
            "points) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            [
                (week_id, tid, p.espn_player_id, p.name, p.position, p.nfl_team,
                 p.lineup_slot, p.points)
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
            "(season_id, team_id, espn_player_id, player_name, type, bid_amount, occurred_at) "
            "VALUES (?, ?, ?, ?, ?, ?, ?)",
            (season_id, tid, tx.espn_player_id, tx.player_name, tx.type,
             tx.bid_amount, tx.occurred_at),
        )
    conn.commit()


# ---------------------------------------------------------------------------
# Bulk write (used by sample generator — unchanged from original)
# ---------------------------------------------------------------------------

def store_season(conn: sqlite3.Connection, season: SeasonData) -> int:
    """Write a season's raw data in one shot. Idempotent: clears existing rows."""
    clear_season(conn, season.year)
    now = datetime.now(UTC).isoformat()

    cur = conn.execute(
        "INSERT INTO seasons (year, league_id, settings_json, created_at) VALUES (?, ?, ?, ?)",
        (season.year, season.league_id, json.dumps(season.settings), now),
    )
    season_id = cur.lastrowid

    store_owners(conn, season.owners)

    team_row_id: dict[int, int] = {}
    for t in season.teams:
        cur = conn.execute(
            "INSERT INTO teams "
            "(season_id, espn_team_id, name, abbrev, owner_name, color, logo_url, owner_id, "
            "standing, final_standing) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (season_id, t.espn_team_id, t.name, t.abbrev, t.owner_name, t.color, t.logo_url,
             t.owner_id, t.standing, t.final_standing),
        )
        team_row_id[t.espn_team_id] = cur.lastrowid

    week_row_id: dict[int, int] = {}
    for w in season.weeks:
        cur = conn.execute(
            "INSERT INTO weeks (season_id, week_num, label, start_date, end_date, is_playoff) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (season_id, w.week_num, w.label, w.start_date, w.end_date, int(w.is_playoff)),
        )
        week_row_id[w.week_num] = cur.lastrowid

    for m in season.matchups:
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
                week_row_id[m.week_num],
                home_id,
                away_id,
                m.home_score,
                m.away_score,
                winner,
                int(m.is_playoff),
                m.playoff_tier,
            ),
        )

    for r in season.rosters:
        wid = week_row_id[r.week_num]
        tid = team_row_id[r.team_id]
        conn.executemany(
            "INSERT INTO rosters "
            "(week_id, team_id, espn_player_id, player_name, position, nfl_team, lineup_slot, "
            "points) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            [
                (
                    wid,
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

    for tx in season.transactions:
        tid = team_row_id[tx.team_id] if tx.team_id is not None else None
        conn.execute(
            "INSERT INTO transactions "
            "(season_id, team_id, espn_player_id, player_name, type, bid_amount, occurred_at) "
            "VALUES (?, ?, ?, ?, ?, ?, ?)",
            (
                season_id,
                tid,
                tx.espn_player_id,
                tx.player_name,
                tx.type,
                tx.bid_amount,
                tx.occurred_at,
            ),
        )

    conn.commit()
    return season_id
