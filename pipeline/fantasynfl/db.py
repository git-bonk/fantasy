"""SQLite schema, connection helpers, and the season writer.

This module is the single source of truth for the database shape. The web app
mirrors these tables in `web/src/lib/types.ts` — keep them in sync.
"""

from __future__ import annotations

import json
import sqlite3
from datetime import UTC, datetime
from pathlib import Path

from .models import SeasonData

SCHEMA = """
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS seasons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  year INTEGER NOT NULL UNIQUE,
  league_id TEXT NOT NULL,
  settings_json TEXT NOT NULL,
  created_at TEXT NOT NULL
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


def store_season(conn: sqlite3.Connection, season: SeasonData) -> int:
    """Write a season's raw data. Idempotent: clears any existing rows for the year."""
    clear_season(conn, season.year)
    now = datetime.now(UTC).isoformat()

    cur = conn.execute(
        "INSERT INTO seasons (year, league_id, settings_json, created_at) VALUES (?, ?, ?, ?)",
        (season.year, season.league_id, json.dumps(season.settings), now),
    )
    season_id = cur.lastrowid

    team_row_id: dict[int, int] = {}
    for t in season.teams:
        cur = conn.execute(
            "INSERT INTO teams "
            "(season_id, espn_team_id, name, abbrev, owner_name, color, logo_url) "
            "VALUES (?, ?, ?, ?, ?, ?, ?)",
            (season_id, t.espn_team_id, t.name, t.abbrev, t.owner_name, t.color, t.logo_url),
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
