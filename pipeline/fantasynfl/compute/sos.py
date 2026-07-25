"""Strength of schedule: cumulative average points scored by opponents faced."""

from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass

from .types import GameResult


@dataclass(frozen=True)
class SosRow:
    team_id: int
    week_num: int
    opp_avg_points: float
    sos_rank: int


def compute_sos(games: list[GameResult], team_ids: list[int]) -> list[SosRow]:
    faced: dict[int, list[float]] = {t: [] for t in team_ids}
    by_week: dict[int, list[GameResult]] = defaultdict(list)
    for g in games:
        by_week[g.week_num].append(g)

    rows: list[SosRow] = []
    for week in sorted(by_week):
        for g in by_week[week]:
            faced[g.home_id].append(g.away_score)
            faced[g.away_id].append(g.home_score)

        avgs = {t: sum(faced[t]) / len(faced[t]) for t in team_ids if faced[t]}
        ranked = sorted(avgs, key=lambda t: -avgs[t])  # hardest first
        rank_of = {t: i + 1 for i, t in enumerate(ranked)}
        for t in team_ids:
            if faced[t]:
                rows.append(SosRow(t, week, avgs[t], rank_of[t]))
    return rows
