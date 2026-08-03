import sqlite3

from fantasynfl.db import SCHEMA, store_draft, store_season
from fantasynfl.espn import ESPNClient
from fantasynfl.models import DraftPick
from fantasynfl.sample import generate_season


def _conn() -> sqlite3.Connection:
    conn = sqlite3.connect(":memory:")
    conn.row_factory = sqlite3.Row
    conn.executescript(SCHEMA)
    return conn


def test_sample_draft_is_snake():
    season = generate_season(year=2025, seed=42)
    picks = season.draft_picks
    assert picks, "sample season should include draft picks"
    team_ids = [t.espn_team_id for t in season.teams]
    by_round: dict[int, list[DraftPick]] = {}
    for p in picks:
        by_round.setdefault(p.round_num, []).append(p)
    r1 = [p.espn_team_id for p in sorted(by_round[1], key=lambda p: p.round_pick)]
    r2 = [p.espn_team_id for p in sorted(by_round[2], key=lambda p: p.round_pick)]
    r3 = [p.espn_team_id for p in sorted(by_round[3], key=lambda p: p.round_pick)]
    assert r1 == team_ids
    assert r2 == list(reversed(team_ids))
    assert r3 == team_ids
    assert [p.round_pick for p in sorted(by_round[1], key=lambda p: p.round_pick)] == list(
        range(1, len(team_ids) + 1)
    )


def test_sample_draft_overall_pick_is_sequential():
    season = generate_season(year=2025, seed=42)
    overall = [
        p.overall_pick
        for p in sorted(season.draft_picks, key=lambda p: (p.round_num, p.round_pick))
    ]
    assert overall == list(range(1, len(season.draft_picks) + 1))


def test_sample_draft_players_appear_on_rosters():
    season = generate_season(year=2025, seed=42)
    conn = _conn()
    season_id = store_season(conn, season)
    store_draft(conn, season_id, season.draft_picks)
    drafted = conn.execute(
        "SELECT d.espn_player_id, t.espn_team_id "
        "FROM draft_picks d JOIN teams t ON t.id = d.team_id "
        "WHERE d.season_id = ?",
        (season_id,),
    ).fetchall()
    assert drafted
    rostered = {
        (r["espn_player_id"], r["espn_team_id"])
        for r in conn.execute(
            "SELECT DISTINCT rosters.espn_player_id, teams.espn_team_id "
            "FROM rosters JOIN weeks ON weeks.id = rosters.week_id "
            "JOIN teams ON teams.id = rosters.team_id "
            "WHERE weeks.season_id = ?",
            (season_id,),
        ).fetchall()
    }
    for r in drafted:
        assert (r["espn_player_id"], r["espn_team_id"]) in rostered
    conn.close()


def test_store_draft_is_idempotent():
    conn = _conn()
    conn.execute(
        "INSERT INTO seasons (year, league_id, settings_json, created_at) "
        "VALUES (2025, 'x', '{}', 'now')"
    )
    season_id = conn.execute("SELECT id FROM seasons").fetchone()["id"]
    conn.execute(
        "INSERT INTO teams (season_id, espn_team_id, name, abbrev, owner_name, color) "
        "VALUES (?, 1, 'A', 'A', 'O', '#000')",
        (season_id,),
    )
    conn.commit()
    picks = [DraftPick(espn_team_id=1, round_num=1, round_pick=1, player_name="P", position="QB")]
    store_draft(conn, season_id, picks)
    store_draft(conn, season_id, picks)
    count = conn.execute(
        "SELECT COUNT(*) FROM draft_picks WHERE season_id = ?", (season_id,)
    ).fetchone()[0]
    assert count == 1
    conn.close()


def test_store_draft_resolves_team_id_and_nulls_unmatched():
    conn = _conn()
    conn.execute(
        "INSERT INTO seasons (year, league_id, settings_json, created_at) "
        "VALUES (2025, 'x', '{}', 'now')"
    )
    season_id = conn.execute("SELECT id FROM seasons").fetchone()["id"]
    conn.execute(
        "INSERT INTO teams (season_id, espn_team_id, name, abbrev, owner_name, color) "
        "VALUES (?, 7, 'G', 'G', 'O', '#000')",
        (season_id,),
    )
    conn.commit()
    picks = [
        DraftPick(espn_team_id=7, round_num=1, round_pick=1, player_name="Matched", position="RB"),
        DraftPick(espn_team_id=99, round_num=1, round_pick=2, player_name="Ghost", position="WR"),
    ]
    store_draft(conn, season_id, picks)
    rows = conn.execute(
        "SELECT player_name, team_id FROM draft_picks WHERE season_id = ? ORDER BY round_pick",
        (season_id,),
    ).fetchall()
    by_name = {r["player_name"]: r["team_id"] for r in rows}
    assert by_name["Matched"] is not None
    assert by_name["Ghost"] is None
    conn.close()


class _Team:
    def __init__(self, team_id: int) -> None:
        self.team_id = team_id


class _Pick:
    def __init__(
        self,
        team_id: int,
        round_num: int,
        round_pick: int,
        player_id: int,
        name: str,
        pos: str,
        overall: int | None = None,
        keeper: int = 0,
        nominating_id: int | None = None,
    ) -> None:
        self.team = _Team(team_id)
        self.round_num = round_num
        self.round_pick = round_pick
        self.playerId = player_id
        self.playerName = name
        self.position = pos
        self.overall_pick = overall
        self.keeper_status = keeper
        self.nominatingTeam = _Team(nominating_id) if nominating_id else None


class _League:
    def __init__(self, draft) -> None:
        self.draft = draft


def _client(league: _League) -> ESPNClient:
    client = ESPNClient("123", 2025, "s2", "swid")
    client._league = league
    return client


def test_fetch_draft_maps_picks_and_normalizes_position():
    picks = [
        _Pick(1, 1, 1, 100, "Player A", "D/ST", overall=1, keeper=1, nominating_id=2),
        _Pick(2, 1, 2, 200, "Player B", "RB", overall=2),
    ]
    rows = _client(_League(picks)).fetch_draft()
    assert len(rows) == 2
    assert rows[0].position == "DEF"
    assert rows[0].espn_team_id == 1
    assert rows[0].espn_player_id == 100
    assert rows[0].keeper_status == 1
    assert rows[0].nominating_espn_team_id == 2
    assert rows[1].position == "RB"


def test_fetch_draft_empty_when_no_draft():
    assert _client(_League([])).fetch_draft() == []
    assert _client(_League(None)).fetch_draft() == []
