import json
import sqlite3

from fantasynfl.compute.playoffs import (
    compute_standings,
    playoff_odds,
    playoff_scenarios,
    rank_standings,
    store_playoff_scenarios,
)
from fantasynfl.compute.types import GameResult
from fantasynfl.db import SCHEMA


def game(week, home, away, hs, as_, playoff=False):
    return GameResult(week, home, away, hs, as_, playoff)


def test_standings_wins_and_points():
    games = [game(1, 1, 2, 100, 90), game(1, 3, 4, 80, 110)]
    s = compute_standings(games, [1, 2, 3, 4])
    assert s[1].wins == 1 and s[2].losses == 1
    assert s[1].points_for == 100 and s[1].points_against == 90
    assert s[4].wins == 1


def test_rank_order_by_wins_then_points():
    games = [game(1, 1, 2, 100, 90), game(1, 3, 4, 120, 80)]
    s = compute_standings(games, [1, 2, 3, 4])
    order = rank_standings(s)
    # both 1 and 3 have 1 win; 3 scored more -> first
    assert order[0] == 3
    assert set(order[:2]) == {1, 3}


def test_odds_bounds_and_clinched():
    # 6 teams, week 1 done; team 1 has clinched nothing yet but odds must be in [0,1]
    games = [game(1, 1, 2, 100, 90), game(1, 3, 4, 110, 80), game(1, 5, 6, 95, 99)]
    games += [game(2, 1, 3, 100, 90), game(2, 2, 4, 110, 80), game(2, 5, 6, 95, 99)]
    ratings = {t: 1500.0 for t in range(1, 7)}
    odds = playoff_odds(
        games, list(range(1, 7)), ratings, through_week=1, n_playoff=4, sims=300, seed=1
    )
    assert all(0.0 <= o <= 1.0 for o in odds.values())
    assert len(odds) == 6


def _scenario_games() -> list[GameResult]:
    games = [game(1, 1, 2, 100, 90), game(1, 3, 4, 110, 80), game(1, 5, 6, 95, 99)]
    games += [game(2, 1, 3, 100, 90), game(2, 2, 4, 110, 80), game(2, 5, 6, 95, 99)]
    games += [game(3, 1, 5, 100, 90), game(3, 2, 6, 110, 80), game(3, 3, 4, 95, 99)]
    return games


def test_scenarios_seeded_determinism():
    games = _scenario_games()
    ratings = {t: 1500.0 for t in range(1, 7)}
    rows_a = playoff_scenarios(games, list(range(1, 7)), ratings, through_week=1, sims=200, seed=42)
    rows_b = playoff_scenarios(games, list(range(1, 7)), ratings, through_week=1, sims=200, seed=42)
    assert len(rows_a) == len(rows_b)
    for a, b in zip(rows_a, rows_b, strict=True):
        assert a.team_id == b.team_id
        assert a.p_wins_out == b.p_wins_out
        assert a.p_lose_out == b.p_lose_out
        assert a.min_wins_fifty == b.min_wins_fifty
        assert a.win_dist_json == b.win_dist_json


def test_scenarios_wins_out_ge_lose_out():
    games = _scenario_games()
    ratings = {t: 1500.0 for t in range(1, 7)}
    rows = playoff_scenarios(games, list(range(1, 7)), ratings, through_week=1, sims=400, seed=7)
    for r in rows:
        assert r.p_wins_out >= r.p_lose_out, f"team {r.team_id}: {r.p_wins_out} < {r.p_lose_out}"


def test_scenarios_min_wins_fifty_consistency():
    games = _scenario_games()
    ratings = {t: 1500.0 for t in range(1, 7)}
    rows = playoff_scenarios(games, list(range(1, 7)), ratings, through_week=1, sims=500, seed=99)
    for r in rows:
        dist = json.loads(r.win_dist_json)
        if r.min_wins_fifty is None:
            continue
        k = r.min_wins_fifty
        all_keys = sorted(int(x) for x in dist)
        ge_total = sum(dist[str(j)][1] for j in all_keys if j >= k)
        ge_made_weighted = sum(dist[str(j)][0] * dist[str(j)][1] for j in all_keys if j >= k)
        if ge_total > 0:
            assert ge_made_weighted / ge_total >= 0.5


def test_scenarios_win_dist_valid():
    games = _scenario_games()
    ratings = {t: 1500.0 for t in range(1, 7)}
    rows = playoff_scenarios(games, list(range(1, 7)), ratings, through_week=1, sims=300, seed=5)
    for r in rows:
        dist = json.loads(r.win_dist_json)
        assert isinstance(dist, dict)
        assert len(dist) > 0
        for key, (p_make, p_reach) in dist.items():
            int(key)
            assert 0.0 <= p_make <= 1.0
            assert 0.0 <= p_reach <= 1.0


def test_scenarios_no_remaining_games():
    games = [game(1, 1, 2, 100, 90), game(1, 3, 4, 110, 80)]
    ratings = {t: 1500.0 for t in range(1, 5)}
    rows = playoff_scenarios(games, list(range(1, 5)), ratings, through_week=1, sims=100, seed=1)
    assert rows == []


def test_store_playoff_scenarios_idempotent():
    conn = sqlite3.connect(":memory:")
    conn.executescript(SCHEMA)
    conn.execute(
        "INSERT INTO seasons (id, year, league_id, settings_json, created_at) "
        "VALUES (1, 2025, 'test', '{}', '2025-01-01')"
    )
    games = _scenario_games()
    ratings = {t: 1500.0 for t in range(1, 7)}
    rows = playoff_scenarios(games, list(range(1, 7)), ratings, through_week=1, sims=100, seed=3)

    store_playoff_scenarios(conn, 1, rows)
    store_playoff_scenarios(conn, 1, rows)

    count = conn.execute("SELECT COUNT(*) FROM playoff_scenarios").fetchone()[0]
    assert count == len(rows)

    stored = conn.execute(
        "SELECT team_id, p_wins_out, p_lose_out, min_wins_fifty, win_dist_json "
        "FROM playoff_scenarios WHERE season_id = 1 ORDER BY team_id"
    ).fetchall()
    for row, orig in zip(stored, sorted(rows, key=lambda r: r.team_id), strict=True):
        assert row[0] == orig.team_id
        assert abs(row[1] - orig.p_wins_out) < 1e-9
        assert abs(row[2] - orig.p_lose_out) < 1e-9
        assert row[3] == orig.min_wins_fifty
        assert json.loads(row[4]) == json.loads(orig.win_dist_json)
