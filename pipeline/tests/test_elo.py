from fantasynfl.compute.elo import compute_elo, expected_score, win_probability
from fantasynfl.compute.types import GameResult

TEAMS = [1, 2, 3, 4]


def game(week, home, away, hs, as_):
    return GameResult(week, home, away, hs, as_, False)


def test_expected_score_symmetry():
    assert expected_score(1500, 1500) == 0.5
    assert abs(expected_score(1600, 1500) + expected_score(1500, 1600) - 1.0) < 1e-9


def test_win_probability_bounds():
    p = win_probability(1800, 1200)
    assert 0.5 < p < 1.0


def test_winner_gains_loser_drops():
    games = [game(1, 1, 2, 120, 80)]
    final, snap = compute_elo(games, [1, 2])
    assert final[1] > 1500
    assert final[2] < 1500
    assert snap[(1, 1)] == final[1]


def test_bigger_margin_bigger_move():
    close = compute_elo([game(1, 1, 2, 100, 95)], [1, 2])[0]
    blowout = compute_elo([game(1, 1, 2, 130, 70)], [1, 2])[0]
    assert blowout[1] > close[1]


def test_ratings_converge_to_strength():
    # team 1 beats everyone for several weeks -> ends highest
    games = []
    for w in range(1, 6):
        games.append(game(w, 1, 2, 120, 90))
        games.append(game(w, 1, 3, 120, 90))
        games.append(game(w, 1, 4, 120, 90))
    final, _ = compute_elo(games, TEAMS)
    assert final[1] == max(final.values())
