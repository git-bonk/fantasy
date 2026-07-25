from fantasynfl.compute.sos import compute_sos
from fantasynfl.compute.types import GameResult


def game(week, home, away, hs, as_):
    return GameResult(week, home, away, hs, as_, False)


def test_sos_ranks_hardest_first():
    # team 1 faces a high-scoring opponent (130); team 3 faces the lowest (60)
    games = [game(1, 1, 2, 100, 130), game(1, 3, 4, 90, 60)]
    rows = compute_sos(games, [1, 2, 3, 4])
    by_team = {r.team_id: r for r in rows if r.week_num == 1}
    assert by_team[1].opp_avg_points == 130
    assert by_team[1].sos_rank == 1  # hardest schedule
    assert by_team[3].sos_rank == 4  # easiest schedule


def test_sos_cumulative():
    games = [game(1, 1, 2, 100, 90), game(2, 1, 2, 100, 110)]
    rows = compute_sos(games, [1, 2])
    team1_w2 = [r for r in rows if r.team_id == 1 and r.week_num == 2][0]
    # team 1 faced 90 then 110 -> avg 100
    assert team1_w2.opp_avg_points == 100
