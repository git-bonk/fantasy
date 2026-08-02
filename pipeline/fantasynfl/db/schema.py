"""SQLite schema, connection helper, and schema migrations.

This module is the single source of truth for the database shape. The web app
mirrors these tables in `web/src/lib/types.ts` — keep them in sync.
"""

from __future__ import annotations

import sqlite3
from pathlib import Path

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
  occurred_at TEXT NOT NULL,
  week_num INTEGER,
  source TEXT NOT NULL DEFAULT 'espn'
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

CREATE TABLE IF NOT EXISTS owner_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id TEXT NOT NULL REFERENCES owners(id),
  token_hash TEXT NOT NULL UNIQUE,
  label TEXT,
  created_at TEXT NOT NULL,
  revoked_at TEXT
);

CREATE TABLE IF NOT EXISTS predictions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id TEXT NOT NULL REFERENCES owners(id),
  season_id INTEGER NOT NULL,
  week_num INTEGER NOT NULL,
  matchup_key TEXT NOT NULL,
  picked_team_id INTEGER,
  locked_at TEXT,
  UNIQUE(owner_id, season_id, week_num, matchup_key)
);

CREATE TABLE IF NOT EXISTS scheduled_matchups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  season_id INTEGER NOT NULL,
  week_num INTEGER NOT NULL,
  home_team_id INTEGER NOT NULL,
  away_team_id INTEGER NOT NULL,
  kickoff TEXT,
  UNIQUE(season_id, week_num, home_team_id, away_team_id)
);

CREATE TABLE IF NOT EXISTS players (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  espn_player_id INTEGER NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  position TEXT NOT NULL,
  nfl_team TEXT NOT NULL,
  first_season_id INTEGER,
  last_season_id INTEGER
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
CREATE INDEX IF NOT EXISTS idx_owner_tokens_owner ON owner_tokens(owner_id);
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
    tx_cols = {r["name"] for r in conn.execute("PRAGMA table_info(transactions)").fetchall()}
    if "week_num" not in tx_cols:
        try:
            conn.execute("ALTER TABLE transactions ADD COLUMN week_num INTEGER")
        except sqlite3.OperationalError:
            pass
    if "source" not in tx_cols:
        try:
            conn.execute("ALTER TABLE transactions ADD COLUMN source TEXT NOT NULL DEFAULT 'espn'")
        except sqlite3.OperationalError:
            pass
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_transactions_season ON transactions(season_id, source)"
    )
    conn.commit()
