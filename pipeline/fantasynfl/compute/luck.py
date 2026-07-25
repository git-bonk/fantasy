"""Luck: how much a team's record over/under-performed its scoring.

Model: in each week, a team's "expected" result is the fraction of the other teams
it outscored. Summing over the season gives expected wins; luck = actual - expected.
A team that keeps winning despite low relative scores is lucky; one that scores big
but loses close ones is unlucky.
"""

from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass

from .types import GameResult


@dataclass(frozen=True)
class LuckRow:
    team_id: int
    week_num: int
    actual_wins: float
    expected_wins: float
    luck_score: float


def _result(home_score: float, away_score: float) -> tuple[float, float]:
    if home_score > away_score:
        return 1.0, 0.0
    if away_score > home_score:
        return 0.0, 1.0
    return 0.5, 0.5


def outscored_fraction(score: float, others: list[float]) -> float:
    if not others:
        return 0.5
    beaten = sum(1 for o in others if score > o)
    tied = sum(1 for o in others if score == o)
    return (beaten + 0.5 * tied) / len(others)


def compute_luck(games: list[GameResult], team_ids: list[int]) -> list[LuckRow]:
    scores_by_week: dict[int, dict[int, float]] = defaultdict(dict)
    result_by_week: dict[int, dict[int, float]] = defaultdict(dict)

    for g in games:
        scores_by_week[g.week_num][g.home_id] = g.home_score
        scores_by_week[g.week_num][g.away_id] = g.away_score
        hr, ar = _result(g.home_score, g.away_score)
        result_by_week[g.week_num][g.home_id] = hr
        result_by_week[g.week_num][g.away_id] = ar

    cum_actual = {t: 0.0 for t in team_ids}
    cum_expected = {t: 0.0 for t in team_ids}
    rows: list[LuckRow] = []

    for week in sorted(scores_by_week):
        scores = scores_by_week[week]
        for tid, score in scores.items():
            others = [s for otid, s in scores.items() if otid != tid]
            cum_actual[tid] += result_by_week[week][tid]
            cum_expected[tid] += outscored_fraction(score, others)
        for tid in team_ids:
            rows.append(
                LuckRow(
                    team_id=tid,
                    week_num=week,
                    actual_wins=cum_actual[tid],
                    expected_wins=cum_expected[tid],
                    luck_score=cum_actual[tid] - cum_expected[tid],
                )
            )
    return rows
