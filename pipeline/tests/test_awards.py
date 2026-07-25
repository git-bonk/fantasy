from fantasynfl.compute.awards import (
    BIGGEST_BUST,
    CLOSEST_FINISH,
    TOP_SCORE,
    compute_awards,
)
from fantasynfl.compute.types import GameResult

NAMES = {1: "Alpha", 2: "Bravo", 3: "Charlie", 4: "Delta"}


def game(week, home, away, hs, as_):
    return GameResult(week, home, away, hs, as_, False)


def test_top_score_and_bust():
    games = [game(1, 1, 2, 140, 90), game(1, 3, 4, 100, 95)]
    awards = compute_awards(games, NAMES, elo_before={}, top_players={})
    top = [a for a in awards if a.type == TOP_SCORE][0]
    bust = [a for a in awards if a.type == BIGGEST_BUST][0]
    assert top.team_id == 1 and top.value == 140
    assert bust.team_id == 2 and bust.value == 90


def test_closest_finish():
    games = [game(1, 1, 2, 140, 90), game(1, 3, 4, 100, 99)]
    awards = compute_awards(games, NAMES, elo_before={}, top_players={})
    closest = [a for a in awards if a.type == CLOSEST_FINISH][0]
    assert closest.value == 1.0
    assert closest.team_id == 3  # winner of the close game


def test_top_player_award():
    games = [game(1, 1, 2, 100, 90)]
    awards = compute_awards(games, NAMES, elo_before={}, top_players={1: ("Star Player", 1, 42.0)})
    tp = [a for a in awards if a.type == "TOP_PLAYER"][0]
    assert tp.player_name == "Star Player" and tp.value == 42.0
