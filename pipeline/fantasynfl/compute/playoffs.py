"""Playoff standings, seeding, and Monte-Carlo qualification odds."""

from __future__ import annotations

import json
import random
import sqlite3
from collections.abc import Iterator
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


@dataclass(frozen=True)
class ScenarioRow:
    """Per-team playoff scenario summary for one snapshot week."""

    team_id: int
    week_num: int
    p_wins_out: float
    p_lose_out: float
    min_wins_fifty: int | None
    win_dist_json: str


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


def _sim_context(
    games: list[GameResult],
    team_ids: list[int],
    ratings: dict[int, float],
    through_week: int,
) -> tuple[dict[int, Standing], list[GameResult], dict[int, float]]:
    """Shared pre-computation: current standings, remaining games, and per-team PPG."""
    base = compute_standings(games, team_ids, through_week)
    remaining = [g for g in games if g.week_num > through_week and not g.is_playoff]

    played = {t: base[t].games for t in team_ids}
    total_played = sum(played.values())
    league_ppg = sum(base[t].points_for for t in team_ids) / total_played if total_played else 90.0
    ppg = {t: (base[t].points_for / played[t] if played[t] else league_ppg) for t in team_ids}

    return base, remaining, ppg


def _simulate_seasons(
    rng: random.Random,
    remaining: list[GameResult],
    team_ids: list[int],
    base: dict[int, Standing],
    ppg: dict[int, float],
    ratings: dict[int, float],
    n_playoff: int,
    sims: int,
) -> Iterator[tuple[dict[int, int], set[int]]]:
    """Yield (final_wins, made_playoff_set) for each simulated season.

    This is the shared Monte-Carlo core consumed by both ``playoff_odds`` and
    ``playoff_scenarios``.  Each iteration replays the remaining regular-season
    schedule using Elo win probabilities and Gaussian scoring noise, identical
    to the original inline loop.
    """
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
        yield wins, set(order[:n_playoff])


def _simulate_forced(
    rng: random.Random,
    remaining: list[GameResult],
    team_ids: list[int],
    base: dict[int, Standing],
    ppg: dict[int, float],
    ratings: dict[int, float],
    n_playoff: int,
    sims: int,
    force_team: int,
    force_win: bool,
) -> Iterator[bool]:
    """Yield whether ``force_team`` makes the playoffs in each sim where its
    remaining games are forced to all wins (``force_win=True``) or all losses.

    Other games are simulated normally with the same Elo-weighted mechanics.
    The forced team's games still consume RNG draws for scoring noise so that
    point-tiebreakers remain stochastic.
    """
    for _ in range(sims):
        wins = {t: base[t].wins for t in team_ids}
        ties = {t: base[t].ties for t in team_ids}
        pf = {t: base[t].points_for for t in team_ids}
        for g in remaining:
            involves = g.home_id == force_team or g.away_id == force_team
            ph = win_probability(ratings[g.home_id], ratings[g.away_id])
            if involves:
                home_win = (g.home_id == force_team) if force_win else (g.away_id == force_team)
                rng.random()
            else:
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
        yield force_team in set(order[:n_playoff])


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
    base, remaining, ppg = _sim_context(games, team_ids, ratings, through_week)

    made = {t: 0 for t in team_ids}
    seasons = _simulate_seasons(rng, remaining, team_ids, base, ppg, ratings, n_playoff, sims)
    for _, made_set in seasons:
        for t in made_set:
            made[t] += 1

    return {t: made[t] / sims for t in team_ids}


def playoff_scenarios(
    games: list[GameResult],
    team_ids: list[int],
    ratings: dict[int, float],
    through_week: int,
    n_playoff: int = 6,
    sims: int = 2000,
    seed: int | None = None,
) -> list[ScenarioRow]:
    """Per-team conditional playoff probabilities for a given snapshot week.

    Returns an empty list when no regular-season games remain (completed season).
    For each team the result captures:

    * ``p_wins_out`` — P(make top-N | wins ALL remaining games)
    * ``p_lose_out`` — P(make top-N | loses ALL remaining games)
    * ``win_dist_json`` — JSON object mapping final-win-count *k* (as a string
      key) to ``[P(make | exactly k wins), P(reach exactly k wins)]``
    * ``min_wins_fifty`` — smallest *k* where P(make | ≥ k wins) ≥ 0.5, or None
    """
    rng = random.Random(seed)
    base, remaining, ppg = _sim_context(games, team_ids, ratings, through_week)

    if not remaining:
        return []

    bucket_made: dict[int, dict[int, int]] = {t: {} for t in team_ids}
    bucket_total: dict[int, dict[int, int]] = {t: {} for t in team_ids}

    for final_wins, made_set in _simulate_seasons(
        rng, remaining, team_ids, base, ppg, ratings, n_playoff, sims
    ):
        for t in team_ids:
            k = final_wins[t]
            bucket_total[t][k] = bucket_total[t].get(k, 0) + 1
            if t in made_set:
                bucket_made[t][k] = bucket_made[t].get(k, 0) + 1

    rows: list[ScenarioRow] = []
    for t in team_ids:
        forced_rng_w = random.Random(rng.randint(0, 2**63))
        forced_rng_l = random.Random(rng.randint(0, 2**63))

        wins_out_made = sum(
            _simulate_forced(
                forced_rng_w, remaining, team_ids, base, ppg, ratings, n_playoff, sims, t, True
            )
        )
        lose_out_made = sum(
            _simulate_forced(
                forced_rng_l, remaining, team_ids, base, ppg, ratings, n_playoff, sims, t, False
            )
        )

        p_wins_out = wins_out_made / sims
        p_lose_out = lose_out_made / sims

        dist: dict[str, list[float]] = {}
        for k in sorted(bucket_total[t]):
            total_k = bucket_total[t][k]
            made_k = bucket_made[t].get(k, 0)
            dist[str(k)] = [made_k / total_k, total_k / sims]

        min_fifty: int | None = None
        all_k = sorted(bucket_total[t])
        for k in all_k:
            ge_total = sum(bucket_total[t][j] for j in all_k if j >= k)
            ge_made = sum(bucket_made[t].get(j, 0) for j in all_k if j >= k)
            if ge_total > 0 and ge_made / ge_total >= 0.5:
                min_fifty = k
                break

        rows.append(
            ScenarioRow(
                team_id=t,
                week_num=through_week,
                p_wins_out=p_wins_out,
                p_lose_out=p_lose_out,
                min_wins_fifty=min_fifty,
                win_dist_json=json.dumps(dist),
            )
        )

    return rows


def store_playoff_scenarios(
    conn: sqlite3.Connection, season_id: int, rows: list[ScenarioRow]
) -> None:
    """Persist scenario rows; re-running is idempotent via the
    UNIQUE(season_id, week_num, team_id) constraint.  Does not commit."""
    conn.executemany(
        "INSERT OR REPLACE INTO playoff_scenarios "
        "(season_id, week_num, team_id, p_wins_out, p_lose_out, min_wins_fifty, win_dist_json) "
        "VALUES (?, ?, ?, ?, ?, ?, ?)",
        [
            (
                season_id,
                r.week_num,
                r.team_id,
                r.p_wins_out,
                r.p_lose_out,
                r.min_wins_fifty,
                r.win_dist_json,
            )
            for r in rows
        ],
    )
