from fantasynfl.compute.luck import compute_luck, outscored_fraction
from fantasynfl.compute.types import GameResult


def game(week, home, away, hs, as_):
    return GameResult(week, home, away, hs, as_, False)


def test_outscored_fraction_bounds():
    assert outscored_fraction(100, [90, 80, 70]) == 1.0
    assert outscored_fraction(50, [90, 80, 70]) == 0.0
    assert outscored_fraction(100, []) == 0.5


def test_dominant_team_not_lucky():
    # team 1 wins every week with the top score -> expected ~ actual -> luck ~ 0
    games = [game(1, 1, 2, 130, 80), game(1, 3, 4, 90, 85)]
    rows = compute_luck(games, [1, 2, 3, 4])
    team1 = [r for r in rows if r.team_id == 1 and r.week_num == 1][0]
    assert team1.actual_wins == 1.0
    assert team1.luck_score < 0.5  # winning while scoring highest isn't "lucky"


def test_scrappy_winner_is_lucky():
    # team 1 wins with a low score while the rest of the league scores higher
    games = [game(1, 1, 2, 70, 65), game(1, 3, 4, 130, 120)]
    rows = compute_luck(games, [1, 2, 3, 4])
    team1 = [r for r in rows if r.team_id == 1 and r.week_num == 1][0]
    assert team1.actual_wins == 1.0
    assert team1.luck_score > 0  # won despite being outscored by most of the field


def test_cumulative():
    games = [game(1, 1, 2, 100, 90), game(2, 1, 2, 100, 90)]
    rows = compute_luck(games, [1, 2])
    team1_w2 = [r for r in rows if r.team_id == 1 and r.week_num == 2][0]
    assert team1_w2.actual_wins == 2.0
