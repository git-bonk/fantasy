"""Playoff standings, seeding, and Monte-Carlo qualification odds."""

from __future__ import annotations

import random
from dataclasses import dataclass

from .elo import win_probability
from .types import GameResult


@dataclass(frozen=True)
class Standing:
    team_id: int
    wins: int
    losses: int
    ties: int
    points_for: float
    points_against: float

    @property
    def games(self) -> int:
        return self.wins + self.losses + self.ties


def compute_standings(
    games: list[GameResult], team_ids: list[int], through_week: int | None = None
) -> dict[int, Standing]:
    wins = {t: 0 for t in team_ids}
    losses = {t: 0 for t in team_ids}
    ties = {t: 0 for t in team_ids}
    pf = {t: 0.0 for t in team_ids}
    pa = {t: 0.0 for t in team_ids}

    for g in games:
        if through_week is not None and g.week_num > through_week:
            continue
        pf[g.home_id] += g.home_score
        pa[g.home_id] += g.away_score
        pf[g.away_id] += g.away_score
        pa[g.away_id] += g.home_score
        if g.home_score > g.away_score:
            wins[g.home_id] += 1
            losses[g.away_id] += 1
        elif g.away_score > g.home_score:
            wins[g.away_id] += 1
            losses[g.home_id] += 1
        else:
            ties[g.home_id] += 1
            ties[g.away_id] += 1

    return {t: Standing(t, wins[t], losses[t], ties[t], pf[t], pa[t]) for t in team_ids}


def rank_standings(standings: dict[int, Standing]) -> list[int]:
    """Order team ids best-first: wins, then ties, then points-for."""
    return sorted(
        standings,
        key=lambda t: (standings[t].wins, standings[t].ties, standings[t].points_for),
        reverse=True,
    )


def playoff_odds(
    games: list[GameResult],
    team_ids: list[int],
    ratings: dict[int, float],
    through_week: int,
    n_playoff: int = 6,
    sims: int = 2000,
    seed: int | None = None,
) -> dict[int, float]:
    """Probability each team makes the top `n_playoff`, via Monte-Carlo over the
    remaining regular-season games using Elo win probabilities."""
    rng = random.Random(seed)
    base = compute_standings(games, team_ids, through_week)
    remaining = [g for g in games if g.week_num > through_week and not g.is_playoff]

    played = {t: base[t].games for t in team_ids}
    total_played = sum(played.values())
    league_ppg = sum(base[t].points_for for t in team_ids) / total_played if total_played else 90.0
    ppg = {t: (base[t].points_for / played[t] if played[t] else league_ppg) for t in team_ids}

    made = {t: 0 for t in team_ids}
    for _ in range(sims):
        wins = {t: base[t].wins for t in team_ids}
        ties = {t: base[t].ties for t in team_ids}
        pf = {t: base[t].points_for for t in team_ids}
        for g in remaining:
            ph = win_probability(ratings[g.home_id], ratings[g.away_id])
            home_win = rng.random() < ph
            base_pts = max(50.0, rng.gauss((ppg[g.home_id] + ppg[g.away_id]) / 2, 12))
            margin = abs(rng.gauss(9, 9)) + 0.5
            if home_win:
                pf[g.home_id] += base_pts + margin / 2
                pf[g.away_id] += max(40.0, base_pts - margin / 2)
                wins[g.home_id] += 1
            else:
                pf[g.away_id] += base_pts + margin / 2
                pf[g.home_id] += max(40.0, base_pts - margin / 2)
                wins[g.away_id] += 1
        order = sorted(team_ids, key=lambda t: (wins[t], ties[t], pf[t]), reverse=True)
        for t in order[:n_playoff]:
            made[t] += 1

    return {t: made[t] / sims for t in team_ids}
