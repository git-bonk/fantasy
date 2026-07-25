from fantasynfl.compute.awards import (
    BIGGEST_UPSET,
    LUCKIEST,
    compute_awards,
)
from fantasynfl.compute.types import GameResult

NAMES = {1: "Alpha", 2: "Bravo", 3: "Charlie", 4: "Delta"}


def game(week, home, away, hs, as_):
    return GameResult(week, home, away, hs, as_, False)


def test_biggest_upset():
    games = [game(1, 1, 2, 100, 90), game(1, 3, 4, 95, 92)]
    elo_before = {
        (1, 1): 1600,
        (2, 1): 1400,
        (3, 1): 1300,
        (4, 1): 1700,
    }
    awards = compute_awards(games, NAMES, elo_before=elo_before, top_players={})
    upsets = [a for a in awards if a.type == BIGGEST_UPSET]
    assert len(upsets) == 1
    assert upsets[0].team_id == 3
    assert upsets[0].value == 400


def test_no_upset_when_favorite_wins():
    games = [game(1, 1, 2, 100, 90)]
    elo_before = {(1, 1): 1600, (2, 1): 1400}
    awards = compute_awards(games, NAMES, elo_before=elo_before, top_players={})
    upsets = [a for a in awards if a.type == BIGGEST_UPSET]
    assert len(upsets) == 0


def test_luckiest():
    games = [game(1, 1, 2, 100, 90), game(1, 3, 4, 80, 70)]
    awards = compute_awards(games, NAMES, elo_before={}, top_players={})
    luckiest = [a for a in awards if a.type == LUCKIEST]
    assert len(luckiest) == 1
    assert luckiest[0].team_id in (1, 3)
    assert 0 <= luckiest[0].value <= 1
