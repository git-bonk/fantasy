import sqlite3

from fantasynfl.compute.transactions import store_derived_transactions
from fantasynfl.compute.waiver import WaiverRow, compute_waiver_impact, store_waiver_impact
from fantasynfl.db import SCHEMA

SEASON_ID = 1

PLAYERS = {
    201: ("Gem One", "RB"),
    202: ("Regret Two", "WR"),
    203: ("Steady Three", "QB"),
    204: ("Capped Four", "TE"),
    301: ("Filler A", "K"),
    302: ("Filler B", "DEF"),
    303: ("Filler C", "QB"),
}

# Weeks 1-7 regular season, week 8 playoffs.
LAYOUTS: dict[int, dict[int, list[int]]] = {
    1: {1: [301], 2: [202, 302], 3: [303]},
    # Week 2: team 1 adds 201 and 204 off waivers.
    2: {1: [201, 204, 301], 2: [202, 302], 3: [303]},
    # Week 3: team 1 adds 203.
    3: {1: [201, 203, 204, 301], 2: [202, 302], 3: [303]},
    # Week 4: team 1 drops 201, team 2 drops 202.
    4: {1: [203, 204, 301], 2: [302], 3: [303]},
    # Week 5: team 2 picks up 201, team 3 picks up 202.
    5: {1: [203, 204, 301], 2: [201, 302], 3: [202, 303]},
    # Week 6: 202 moves team 3 -> team 2 (derived TRADE, not a waiver move).
    6: {1: [203, 204, 301], 2: [201, 202, 302], 3: [303]},
    7: {1: [203, 204, 301], 2: [201, 202, 302], 3: [303]},
    8: {1: [203, 204, 301], 2: [201, 202, 302], 3: [303]},
}

POINTS: dict[tuple[int, int], float] = {
    (2, 201): 5.0,
    (3, 201): 10.0,
    (5, 201): 100.0,
    (6, 201): 100.0,
    (7, 201): 100.0,
    (8, 201): 100.0,
    (5, 202): 30.0,
    (6, 202): 25.0,
    (7, 202): 25.0,
    (8, 202): 25.0,
    (3, 203): 1.0,
    (4, 203): 20.0,
    (5, 203): 20.0,
    (6, 203): 20.0,
    (7, 203): 20.0,
    (8, 203): 20.0,
    (2, 204): 1.0,
    (3, 204): 10.0,
    (4, 204): 10.0,
    (5, 204): 10.0,
    (6, 204): 10.0,
    (7, 204): 10.0,
    (8, 204): 10.0,
}


def _make_db() -> sqlite3.Connection:
    conn = sqlite3.connect(":memory:")
    conn.row_factory = sqlite3.Row
    conn.executescript(SCHEMA)
    conn.execute(
        "INSERT INTO seasons (id, year, league_id, settings_json, created_at) "
        "VALUES (1, 2025, 'test', '{}', '2025-01-01')"
    )
    for team_id, name, abbrev in [(1, "Alpha", "ALP"), (2, "Bravo", "BRV"), (3, "Charlie", "CHA")]:
        conn.execute(
            "INSERT INTO teams (id, season_id, espn_team_id, name, abbrev, owner_name, color) "
            "VALUES (?, 1, ?, ?, ?, 'Owner', '#fff')",
            (team_id, team_id, name, abbrev),
        )
    for week_num in range(1, 9):
        conn.execute(
            "INSERT INTO weeks (id, season_id, week_num, label, is_playoff) VALUES (?, 1, ?, ?, ?)",
            (week_num, week_num, f"Week {week_num}", int(week_num == 8)),
        )
    for week_num, layout in LAYOUTS.items():
        for team_id, pids in layout.items():
            for pid in pids:
                name, pos = PLAYERS[pid]
                conn.execute(
                    "INSERT INTO rosters (week_id, team_id, espn_player_id, player_name, "
                    "position, nfl_team, lineup_slot, points) "
                    "VALUES (?, ?, ?, ?, ?, 'KC', 'QB', ?)",
                    (week_num, team_id, pid, name, pos, POINTS.get((week_num, pid), 1.0)),
                )
    conn.commit()
    store_derived_transactions(conn, SEASON_ID)
    conn.commit()
    return conn


MoveKey = tuple[int, int, str, int]  # (team_id, espn_player_id, move_type, week_num)


def _rows(conn: sqlite3.Connection) -> dict[MoveKey, WaiverRow]:
    return {
        (r.team_id, r.espn_player_id, r.move_type, r.week_num): r
        for r in compute_waiver_impact(conn, SEASON_ID)
    }


def test_add_gem_counts_acquiring_team_only():
    rows = _rows(_make_db())
    gem = rows[(1, 203, "ADD", 3)]
    assert gem.label == "GEM"
    assert gem.points_after == 80.0  # 4x20 on team 1, weeks 4-7

    # 201 scored 100/wk on team 2 after week 5, but only its team-1 points grade
    # team 1's ADD: 10 pts -> NEUTRAL, not the 210 a leaky filter would see.
    neutral = rows[(1, 201, "ADD", 2)]
    assert neutral.label == "NEUTRAL"
    assert neutral.points_after == 10.0


def test_drop_regret_counts_other_teams_only():
    rows = _rows(_make_db())
    regret = rows[(1, 201, "DROP", 4)]
    assert regret.label == "REGRET"
    assert regret.points_after == 300.0  # 3x100 on team 2, weeks 5-7 (week 8 is playoffs)

    # 202 returned to team 2 (the dropper) for 25 pts/wk; those points must not count,
    # leaving only the 30 it scored on team 3 -> NEUTRAL, not the 80 a leak would see.
    neutral = rows[(2, 202, "DROP", 4)]
    assert neutral.label == "NEUTRAL"
    assert neutral.points_after == 30.0


def test_neutral_below_threshold():
    rows = _rows(_make_db())
    pickup = rows[(3, 202, "ADD", 5)]
    assert pickup.label == "NEUTRAL"
    assert pickup.points_after == 0.0  # 202 left team 3 the week after being picked up


def test_window_respects_eval_weeks_and_excludes_playoffs():
    rows = _rows(_make_db())
    # 204 scored 10 pts every week 3-7 on team 1; week 7 is regular season but outside
    # the 4-week window, so only weeks 3-6 count (40, not 50).
    capped = rows[(1, 204, "ADD", 2)]
    assert capped.label == "NEUTRAL"
    assert capped.points_after == 40.0

    # 201's week-8 points sit inside team 2's window but week 8 is a playoff week
    # (200, not 300).
    gem = rows[(2, 201, "ADD", 5)]
    assert gem.label == "GEM"
    assert gem.points_after == 200.0


def test_store_is_idempotent():
    conn = _make_db()
    rows = compute_waiver_impact(conn, SEASON_ID)
    assert len(rows) == 7
    store_waiver_impact(conn, SEASON_ID, rows)
    store_waiver_impact(conn, SEASON_ID, rows)
    conn.commit()

    assert conn.execute("SELECT COUNT(*) AS n FROM waiver_impact").fetchone()["n"] == 7
    assert (
        conn.execute("SELECT COUNT(*) AS n FROM waiver_impact WHERE label = 'GEM'").fetchone()["n"]
        == 2
    )
    assert (
        conn.execute("SELECT COUNT(*) AS n FROM waiver_impact WHERE label = 'REGRET'").fetchone()[
            "n"
        ]
        == 1
    )
