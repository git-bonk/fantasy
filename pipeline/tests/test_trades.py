import json
import sqlite3

from fantasynfl.compute.trades import TradeRow, compute_trades, store_trades
from fantasynfl.compute.transactions import store_derived_transactions
from fantasynfl.db import SCHEMA

SEASON_ID = 1

PLAYERS = {
    101: ("P One", "QB"),
    102: ("P Two", "RB"),
    103: ("P Three", "WR"),
    104: ("P Four", "TE"),
    105: ("P Five", "RB"),
    106: ("P Six", "WR"),
    107: ("P Seven", "QB"),
}

# Weeks 1-6 regular season, week 7 playoffs.
LAYOUTS: dict[int, dict[int, list[int]]] = {
    1: {1: [101, 102], 2: [103, 104, 105], 3: [106, 107]},
    # Week 2: 102 <-> 103 swapped, 105 sent 2->1 and 106 sent 3->1 with nothing back.
    2: {1: [101, 103, 105, 106], 2: [102, 104], 3: [107]},
    3: {1: [101, 103, 105, 106], 2: [102, 104], 3: [107]},
    # Week 4: 102 <-> 107 swapped between teams 2 and 3 (too late for a full window).
    4: {1: [101, 103, 105, 106], 2: [104, 107], 3: [102]},
    5: {1: [101, 103, 105, 106], 2: [104, 107], 3: [102]},
    6: {1: [101, 103, 105, 106], 2: [104, 107], 3: [102]},
    7: {1: [101, 103, 105, 106], 2: [104, 107], 3: [102]},
}

POINTS: dict[tuple[int, int], float] = {
    (1, 102): 99.0,
    (2, 102): 99.0,
    (3, 102): 32.0,
    (5, 102): 10.0,
    (6, 102): 10.0,
    (7, 102): 50.0,
    (1, 103): 99.0,
    (2, 103): 99.0,
    (3, 103): 10.0,
    (4, 103): 10.0,
    (5, 103): 10.0,
    (6, 103): 10.0,
    (7, 103): 99.0,
    (1, 105): 99.0,
    (2, 105): 1.0,
    (3, 105): 5.0,
    (4, 105): 5.0,
    (5, 105): 5.0,
    (6, 105): 5.0,
    (7, 105): 50.0,
    (1, 106): 99.0,
    (2, 106): 1.0,
    (3, 106): 15.0,
    (4, 106): 15.0,
    (5, 106): 15.0,
    (6, 106): 15.0,
    (7, 106): 99.0,
    (5, 107): 2.0,
    (6, 107): 2.0,
    (7, 107): 70.0,
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
    for week_num in range(1, 8):
        conn.execute(
            "INSERT INTO weeks (id, season_id, week_num, label, is_playoff) VALUES (?, 1, ?, ?, ?)",
            (week_num, week_num, f"Week {week_num}", int(week_num == 7)),
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


def _by_pair(rows: list[TradeRow]) -> dict[tuple[int, int, int], TradeRow]:
    return {(r.week_num, r.team_a_id, r.team_b_id): r for r in rows}


def test_single_player_trade_pairs_with_correct_winner():
    trade = _by_pair(compute_trades(_make_db(), SEASON_ID))[(2, 1, 3)]
    assert json.loads(trade.a_players_json) == [{"pid": 106, "name": "P Six", "position": "WR"}]
    assert json.loads(trade.b_players_json) == []
    assert trade.a_points == 60.0
    assert trade.b_points == 0.0
    assert trade.weeks_evaluated == 4
    assert trade.finalized is True
    assert trade.winner_side == "A"


def test_multi_player_trade_sums_both_sides_into_one_row():
    by_pair = _by_pair(compute_trades(_make_db(), SEASON_ID))
    assert len(by_pair) == 3
    trade = by_pair[(2, 1, 2)]
    assert {p["pid"] for p in json.loads(trade.a_players_json)} == {103, 105}
    assert {p["pid"] for p in json.loads(trade.b_players_json)} == {102}
    # Exact sums prove pre-trade (weeks <= 2) and playoff (week 7) points never leak in.
    assert trade.a_points == 60.0  # 103: 4x10 on team 1 + 105: 4x5 on team 1
    assert trade.b_points == 32.0  # 102: week 3 only on team 2 (traded on again in week 4)
    assert trade.finalized is True
    assert trade.winner_side == "A"


def test_too_early_trade_is_not_finalized_and_has_no_winner():
    trade = _by_pair(compute_trades(_make_db(), SEASON_ID))[(4, 2, 3)]
    assert trade.weeks_evaluated == 2  # weeks 5-6 exist; 7 is playoff, 8 absent
    assert trade.finalized is False
    assert trade.winner_side is None  # side B outscored A (20 vs 4) but the window is incomplete
    assert trade.a_points == 4.0
    assert trade.b_points == 20.0


def test_store_is_idempotent():
    conn = _make_db()
    rows = compute_trades(conn, SEASON_ID)
    store_trades(conn, SEASON_ID, rows)
    store_trades(conn, SEASON_ID, rows)
    conn.commit()

    stored = conn.execute("SELECT * FROM trades ORDER BY week_num, team_a_id, team_b_id").fetchall()
    assert len(stored) == 3
    assert stored[0]["week_num"] == 2
    assert stored[0]["winner_side"] == "A"
    assert stored[0]["finalized"] == 1
    assert stored[2]["week_num"] == 4
    assert stored[2]["winner_side"] is None
    assert stored[2]["finalized"] == 0
