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
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS owners (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  last_seen_season_id INTEGER,
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
  is_playoff INTEGER NOT NULL DEFAULT 0
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
    owner_cols = {r["name"] for r in conn.execute("PRAGMA table_info(owners)").fetchall()}
    if "alias_num" not in owner_cols:
        try:
            conn.execute("ALTER TABLE owners ADD COLUMN alias_num INTEGER")
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


def store_owners(
    conn: sqlite3.Connection, owners: list[Owner], season_id: int | None = None
) -> None:
    conn.executemany(
        "INSERT INTO owners (id, display_name, first_name, last_name, last_seen_season_id) "
        "VALUES (?, ?, ?, ?, ?) "
        "ON CONFLICT(id) DO UPDATE SET "
        "display_name = excluded.display_name, "
        "first_name = excluded.first_name, "
        "last_name = excluded.last_name, "
        "last_seen_season_id = excluded.last_seen_season_id",
        [(o.owner_id, o.display_name, o.first_name, o.last_name, season_id) for o in owners],
    )
    assign_owner_aliases(conn)


def store_teams(conn: sqlite3.Connection, season_id: int, teams: list[Team]) -> dict[int, int]:
    """Insert teams for a season. Returns {espn_team_id: db_row_id}."""
    team_row_id: dict[int, int] = {}
    for t in teams:
        cur = conn.execute(
            "INSERT INTO teams "
            "(season_id, espn_team_id, name, abbrev, owner_name, color, logo_url, owner_id) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (season_id, t.espn_team_id, t.name, t.abbrev, t.owner_name, t.color, t.logo_url,
             t.owner_id),
        )
        team_row_id[t.espn_team_id] = cur.lastrowid
    conn.commit()
    return team_row_id


def get_completed_weeks(conn: sqlite3.Connection, season_id: int) -> set[int]:
    """Return the set of week_nums already stored for a season."""
    rows = conn.execute(
        "SELECT week_num FROM weeks WHERE season_id = ?", (season_id,)
    ).fetchall()
    return {r["week_num"] for r in rows}


def store_week(
    conn: sqlite3.Connection,
    season_id: int,
    team_row_id: dict[int, int],
    week_info: WeekInfo,
    matchups: list[Matchup],
    rosters: list[WeekRoster],
) -> None:
    """Store one week's data and commit. Idempotent: deletes existing week first."""
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
        "INSERT INTO weeks (season_id, week_num, label, start_date, end_date, is_playoff) "
        "VALUES (?, ?, ?, ?, ?, ?)",
        (season_id, week_info.week_num, week_info.label, week_info.start_date,
         week_info.end_date, int(week_info.is_playoff)),
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
            "is_playoff) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (week_id, home_id, away_id, m.home_score, m.away_score, winner, int(m.is_playoff)),
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

    store_owners(conn, season.owners, season_id)

    team_row_id: dict[int, int] = {}
    for t in season.teams:
        cur = conn.execute(
            "INSERT INTO teams "
            "(season_id, espn_team_id, name, abbrev, owner_name, color, logo_url, owner_id) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (season_id, t.espn_team_id, t.name, t.abbrev, t.owner_name, t.color, t.logo_url,
             t.owner_id),
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
            "is_playoff) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (
                week_row_id[m.week_num],
                home_id,
                away_id,
                m.home_score,
                m.away_score,
                winner,
                int(m.is_playoff),
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
