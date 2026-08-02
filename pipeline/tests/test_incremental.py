import shutil
import sqlite3
import tempfile
from dataclasses import replace
from pathlib import Path

from fantasynfl.config import Config
from fantasynfl.db import connect, ensure_season, get_season_status, init_db, store_teams
from fantasynfl.ingest import _playoff_start_week, _season_is_over, backfill, ingest_espn
from fantasynfl.models import ScheduledMatchup, Team
from fantasynfl.sample import generate_season

SEASON = generate_season(year=2025, seed=7)
MAX_WEEK = max(w.week_num for w in SEASON.weeks)


class SampleClient:
    """Fake ESPNClient backed by the deterministic sample season."""

    def __init__(self, current_week: int, teams=None, settings=None):
        self._cw = current_week
        self._settings = settings if settings is not None else SEASON.settings
        self._teams = teams if teams is not None else SEASON.teams
        self._weeks = {
            w.week_num: (
                w,
                [m for m in SEASON.matchups if m.week_num == w.week_num],
                [r for r in SEASON.rosters if r.week_num == w.week_num],
            )
            for w in SEASON.weeks
        }
        self.fetched: list[int] = []

    def get_settings(self):
        return self._settings

    def current_week(self):
        return self._cw

    def fetch_teams(self):
        return self._teams, SEASON.owners

    def fetch_schedule(self):
        seen = set()
        rows = []
        for m in SEASON.matchups:
            if m.is_playoff:
                continue
            a, b = sorted((m.home_team_id, m.away_team_id))
            if (m.week_num, a, b) in seen:
                continue
            seen.add((m.week_num, a, b))
            rows.append(ScheduledMatchup(m.week_num, a, b))
        return rows

    def fetch_week(self, week_num):
        self.fetched.append(week_num)
        return self._weeks.get(week_num)

    def fetch_transactions(self, teams):
        return []

    def fetch_draft(self):
        return SEASON.draft_picks


def _active_teams():
    return [replace(t, standing=None, final_standing=None) for t in SEASON.teams]


def _setup(clients):
    d = tempfile.mkdtemp()
    db = Path(d) / "test.db"
    config = Config(
        league_id="test",
        espn_s2="x",
        swid="y",
        seasons=tuple(clients.keys()),
        db_path=db,
    )
    return config, db, d


def _factory_for(clients, created):
    def factory(year):
        created.append(clients[year])
        return clients[year]

    return factory


def _week_finalized(db):
    conn = connect(db, readonly=True)
    out = {
        r["week_num"]: r["finalized"] for r in conn.execute("SELECT week_num, finalized FROM weeks")
    }
    conn.close()
    return out


def _status(db):
    conn = connect(db, readonly=True)
    row = conn.execute("SELECT status FROM seasons").fetchone()
    conn.close()
    return row["status"]


def test_full_ingest_stores_up_to_current_week():
    c = SampleClient(current_week=14, teams=_active_teams())
    config, db, d = _setup({2025: c})
    try:
        ingest_espn(config, sims=3, client_factory=_factory_for({2025: c}, []))
        assert c.fetched == list(range(1, 15))
        fin = _week_finalized(db)
        assert fin[14] == 0
        assert all(fin[w] == 1 for w in range(1, 14))
        assert _status(db) == "active"
    finally:
        shutil.rmtree(d)


def test_incremental_fetches_only_latest_and_unfinalized():
    c1 = SampleClient(current_week=14, teams=_active_teams())
    config, db, d = _setup({2025: c1})
    try:
        ingest_espn(config, sims=3, client_factory=_factory_for({2025: c1}, []))
        assert c1.fetched == list(range(1, 15))
        c2 = SampleClient(current_week=15, teams=_active_teams())
        ingest_espn(config, sims=3, client_factory=_factory_for({2025: c2}, []))
        assert sorted(c2.fetched) == [14, 15]
        fin = _week_finalized(db)
        assert fin[14] == 1
        assert fin[15] == 0
        assert _status(db) == "active"
    finally:
        shutil.rmtree(d)


def test_complete_season_is_skipped():
    c1 = SampleClient(current_week=MAX_WEEK)
    config, db, d = _setup({2025: c1})
    try:
        created = []
        ingest_espn(config, sims=3, client_factory=_factory_for({2025: c1}, created))
        assert _status(db) == "complete"
        assert all(v == 1 for v in _week_finalized(db).values())
        c2 = SampleClient(current_week=MAX_WEEK)
        ingest_espn(config, sims=3, client_factory=_factory_for({2025: c2}, created))
        assert c2.fetched == []
        assert len(created) == 1
    finally:
        shutil.rmtree(d)


def test_full_flag_forces_rescrape_of_complete_season():
    c1 = SampleClient(current_week=MAX_WEEK)
    config, db, d = _setup({2025: c1})
    try:
        ingest_espn(config, sims=3, client_factory=_factory_for({2025: c1}, []))
        assert _status(db) == "complete"
        c2 = SampleClient(current_week=MAX_WEEK)
        ingest_espn(config, sims=3, full=True, client_factory=_factory_for({2025: c2}, []))
        assert c2.fetched == list(range(1, MAX_WEEK + 1))
    finally:
        shutil.rmtree(d)


def test_store_teams_upsert_keeps_stable_ids():
    conn = sqlite3.connect(":memory:")
    conn.row_factory = sqlite3.Row
    init_db(conn)
    season_id = ensure_season(conn, 2025, "test", {"playoff_teams": 6})
    t1 = Team(1, "A", "AAA", "Al", "#fff", final_standing=None)
    t2 = Team(2, "B", "BBB", "Bo", "#000", final_standing=None)
    ids1 = store_teams(conn, season_id, [t1, t2])
    ids2 = store_teams(
        conn, season_id, [replace(t1, name="A2", final_standing=1), replace(t2, final_standing=2)]
    )
    assert ids1 == ids2
    rows = conn.execute("SELECT name, final_standing FROM teams ORDER BY espn_team_id").fetchall()
    assert len(rows) == 2
    assert (rows[0]["name"], rows[0]["final_standing"]) == ("A2", 1)
    assert rows[1]["final_standing"] == 2
    conn.close()


OLD_SCHEMA = """
CREATE TABLE seasons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  year INTEGER NOT NULL UNIQUE,
  league_id TEXT NOT NULL,
  settings_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE weeks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  season_id INTEGER NOT NULL,
  week_num INTEGER NOT NULL,
  label TEXT NOT NULL,
  is_playoff INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE teams (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  season_id INTEGER NOT NULL,
  espn_team_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  abbrev TEXT NOT NULL,
  owner_name TEXT NOT NULL,
  color TEXT NOT NULL,
  final_standing INTEGER
);
"""


def test_migration_backfills_finalized_and_status():
    conn = sqlite3.connect(":memory:")
    conn.row_factory = sqlite3.Row
    conn.executescript(OLD_SCHEMA)
    conn.execute(
        "INSERT INTO seasons (year, league_id, settings_json, created_at) "
        "VALUES (2024, 'x', '{}', '2024')"
    )
    done_id = conn.execute("SELECT id FROM seasons WHERE year = 2024").fetchone()[0]
    for i in range(1, 4):
        conn.execute(
            "INSERT INTO teams (season_id, espn_team_id, name, abbrev, owner_name, color, "
            "final_standing) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (done_id, i, f"T{i}", f"T{i}", "O", "#000", i),
        )
    for wk in range(1, 6):
        conn.execute(
            "INSERT INTO weeks (season_id, week_num, label) VALUES (?, ?, ?)",
            (done_id, wk, f"W{wk}"),
        )
    conn.execute(
        "INSERT INTO seasons (year, league_id, settings_json, created_at) "
        "VALUES (2025, 'x', '{}', '2025')"
    )
    active_id = conn.execute("SELECT id FROM seasons WHERE year = 2025").fetchone()[0]
    conn.execute(
        "INSERT INTO teams (season_id, espn_team_id, name, abbrev, owner_name, color, "
        "final_standing) VALUES (?, ?, ?, ?, ?, ?, ?)",
        (active_id, 1, "T", "T", "O", "#000", None),
    )
    for wk in range(1, 4):
        conn.execute(
            "INSERT INTO weeks (season_id, week_num, label) VALUES (?, ?, ?)",
            (active_id, wk, f"W{wk}"),
        )
    conn.commit()

    init_db(conn)

    done = {
        r["week_num"]: r["finalized"]
        for r in conn.execute(
            "SELECT week_num, finalized FROM weeks WHERE season_id = ?", (done_id,)
        )
    }
    assert done == {1: 1, 2: 1, 3: 1, 4: 1, 5: 0}
    active = {
        r["week_num"]: r["finalized"]
        for r in conn.execute(
            "SELECT week_num, finalized FROM weeks WHERE season_id = ?", (active_id,)
        )
    }
    assert active == {1: 1, 2: 1, 3: 0}
    assert get_season_status(conn, 2024) == "complete"
    assert get_season_status(conn, 2025) == "active"
    conn.close()


def test_season_is_over_requires_final_standing_and_post_regular_season():
    settings = {"playoff_teams": 6, "playoff": {"regular_season_weeks": 14}}
    done = [
        Team(1, "A", "A", "O", "#fff", final_standing=1),
        Team(2, "B", "B", "O", "#fff", final_standing=2),
    ]
    ongoing = [replace(t, final_standing=None) for t in done]
    assert _season_is_over(done, 17, settings) is True
    assert _season_is_over(done, 10, settings) is False
    assert _season_is_over(ongoing, 17, settings) is False
    assert _season_is_over(done, 14, settings) is True


def test_playoff_start_week():
    assert _playoff_start_week({"playoff": {"start_week": 15}}) == 15
    assert _playoff_start_week({"playoff": {"regular_season_weeks": 14}}) == 15
    assert _playoff_start_week({"playoff": {}}) is None
    assert _playoff_start_week({}) is None


def test_backfill_fetches_only_playoff_weeks_and_completes():
    c1 = SampleClient(current_week=MAX_WEEK, teams=_active_teams())
    config, db, d = _setup({2025: c1})
    try:
        ingest_espn(config, sims=3, client_factory=_factory_for({2025: c1}, []))
        assert _status(db) == "active"
        # Simulate the legacy DB: playoff flags/tiers and final standings never captured
        rw = connect(db)
        rw.execute("UPDATE matchups SET playoff_tier = 'NONE', is_playoff = 0")
        rw.execute("UPDATE teams SET final_standing = NULL")
        rw.commit()
        rw.close()
        # Backfill with a client that exposes final standings + playoff tiers
        c2 = SampleClient(current_week=MAX_WEEK)
        backfill(config, sims=3, client_factory=_factory_for({2025: c2}, []))
        assert sorted(c2.fetched) == [15, 16, 17]
        conn = connect(db, readonly=True)
        fs = conn.execute("SELECT COUNT(*) FROM teams WHERE final_standing > 0").fetchone()[0]
        assert fs == 12
        playoff = conn.execute(
            "SELECT COUNT(*) FROM matchups m JOIN weeks w ON w.id = m.week_id "
            "WHERE w.week_num >= 15 AND m.is_playoff = 1 AND m.playoff_tier != 'NONE'"
        ).fetchone()[0]
        assert playoff == 6
        reg = conn.execute(
            "SELECT COUNT(*) FROM matchups m JOIN weeks w ON w.id = m.week_id "
            "WHERE w.week_num < 15 AND (m.is_playoff = 1 OR m.playoff_tier != 'NONE')"
        ).fetchone()[0]
        assert reg == 0
        conn.close()
        assert _status(db) == "complete"
    finally:
        shutil.rmtree(d)
