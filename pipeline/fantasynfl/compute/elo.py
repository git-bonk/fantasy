"""Margin-of-victory Elo power ratings (538-style)."""

from __future__ import annotations

import math
from collections import defaultdict

from .types import GameResult

INITIAL = 1500.0
K = 32.0


def expected_score(rating: float, opp_rating: float) -> float:
    return 1.0 / (1.0 + 10 ** ((opp_rating - rating) / 400.0))


def win_probability(rating: float, opp_rating: float) -> float:
    """Probability `rating` beats `opp_rating` (ignoring margin)."""
    return expected_score(rating, opp_rating)


def _mov_multiplier(abs_margin: float, winner_elo_diff: float) -> float:
    """Dampen big wins by favorites, amplify big wins by underdogs."""
    return math.log(abs_margin + 1.0) * (2.2 / ((winner_elo_diff * 0.001) + 2.2))


def compute_elo(
    games: list[GameResult],
    team_ids: list[int],
    initial: float = INITIAL,
    k: float = K,
) -> tuple[dict[int, float], dict[tuple[int, int], float]]:
    """Return (final_ratings, snapshots) where snapshots[(team_id, week_num)] is the
    rating *after* that week's games."""
    ratings = {t: initial for t in team_ids}
    snapshots: dict[tuple[int, int], float] = {}

    by_week: dict[int, list[GameResult]] = defaultdict(list)
    for g in games:
        by_week[g.week_num].append(g)

    for week in sorted(by_week):
        for g in by_week[week]:
            eh = expected_score(ratings[g.home_id], ratings[g.away_id])
            ea = 1.0 - eh
            if g.home_score > g.away_score:
                sh, sa = 1.0, 0.0
                winner_diff = ratings[g.home_id] - ratings[g.away_id]
            elif g.away_score > g.home_score:
                sh, sa = 0.0, 1.0
                winner_diff = ratings[g.away_id] - ratings[g.home_id]
            else:
                sh, sa = 0.5, 0.5
                winner_diff = 0.0
            mult = _mov_multiplier(abs(g.margin), winner_diff)
            ratings[g.home_id] += k * mult * (sh - eh)
            ratings[g.away_id] += k * mult * (sa - ea)
        for t in team_ids:
            snapshots[(t, week)] = ratings[t]

    return ratings, snapshots
