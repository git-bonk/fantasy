import sqlite3

from fantasynfl.db import SCHEMA, store_scheduled_matchups, store_season
from fantasynfl.espn import ESPNClient
from fantasynfl.models import ScheduledMatchup
from fantasynfl.sample import generate_season, store_sample_schedule, store_sample_tokens


def _conn() -> sqlite3.Connection:
    conn = sqlite3.connect(":memory:")
    conn.row_factory = sqlite3.Row
    conn.executescript(SCHEMA)
    return conn


class _Team:
    def __init__(self, team_id: int, schedule: list["_Team"]) -> None:
        self.team_id = team_id
        self.schedule = schedule


class _Settings:
    reg_season_count = 3


class _League:
    def __init__(self, teams: list[_Team]) -> None:
        self.teams = teams
        self.settings = _Settings()


def _client(league: _League) -> ESPNClient:
    client = ESPNClient("123", 2025, "espn_s2", "swid")
    client._league = league
    return client


def test_fetch_schedule_dedups_pairings():
    t1 = _Team(1, [])
    t2 = _Team(2, [])
    t3 = _Team(3, [])
    t4 = _Team(4, [])
    t1.schedule = [t2, t3, t4]
    t2.schedule = [t1, t4, t3]
    t3.schedule = [t4, t1, t2]
    t4.schedule = [t3, t2, t1]
    rows = _client(_League([t1, t2, t3, t4])).fetch_schedule()
    keys = [(r.week_num, r.home_espn_id, r.away_espn_id) for r in rows]
    assert len(keys) == len(set(keys)) == 6
    assert (1, 1, 2) in keys
    assert (1, 3, 4) in keys


def test_fetch_schedule_skips_byes():
    t1 = _Team(1, [])
    t2 = _Team(2, [])
    t1.schedule = [t2, t1]
    t2.schedule = [t1, t2]
    rows = _client(_League([t1, t2])).fetch_schedule()
    assert [(r.week_num, r.home_espn_id, r.away_espn_id) for r in rows] == [(1, 1, 2)]


def test_store_scheduled_matchups_maps_and_ignores_dupes():
    conn = _conn()
    conn.execute(
        "INSERT INTO seasons (year, league_id, settings_json, created_at) "
        "VALUES (2025, 'x', '{}', 'now')"
    )
    season_id = conn.execute("SELECT id FROM seasons").fetchone()["id"]
    for espn_id, name in ((1, "A"), (2, "B")):
        conn.execute(
            "INSERT INTO teams (season_id, espn_team_id, name, abbrev, owner_name, color) "
            "VALUES (?, ?, ?, ?, ?, '#000')",
            (season_id, espn_id, name, name, f"owner-{name}"),
        )
    conn.commit()
    rows = [ScheduledMatchup(1, 1, 2), ScheduledMatchup(1, 1, 2)]
    store_scheduled_matchups(conn, season_id, rows)
    stored = conn.execute("SELECT * FROM scheduled_matchups").fetchall()
    assert len(stored) == 1
    assert stored[0]["kickoff"] is None
    internal = {r["id"] for r in conn.execute("SELECT id FROM teams").fetchall()}
    assert {stored[0]["home_team_id"], stored[0]["away_team_id"]} == internal


def test_sample_invariants():
    season = generate_season(year=2025, seed=42)
    conn = _conn()
    season_id = store_season(conn, season)
    store_sample_tokens(conn)
    store_sample_schedule(conn, season_id, season)
    assert conn.execute("SELECT COUNT(*) FROM owner_tokens").fetchone()[0] == 12
    count = conn.execute(
        "SELECT COUNT(*) FROM scheduled_matchups WHERE season_id = ?", (season_id,)
    ).fetchone()[0]
    assert count == 84
    weeks = conn.execute(
        "SELECT COUNT(DISTINCT week_num) FROM scheduled_matchups WHERE season_id = ?",
        (season_id,),
    ).fetchone()[0]
    assert weeks == 14
    nulls = conn.execute(
        "SELECT COUNT(*) FROM scheduled_matchups WHERE kickoff IS NULL"
    ).fetchone()[0]
    assert nulls == 0
