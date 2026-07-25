from fantasynfl.compute.playoffs import compute_standings, playoff_odds, rank_standings
from fantasynfl.compute.types import GameResult


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
