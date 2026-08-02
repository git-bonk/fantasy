from __future__ import annotations

import sqlite3
from collections import defaultdict

from .elo import INITIAL, K, _mov_multiplier, expected_score
from .loaders import load_games
from .types import GameResult

REGRESSION = 0.75


def regress_to_mean(rating: float, factor: float = REGRESSION, mean: float = INITIAL) -> float:
    return mean + factor * (rating - mean)


def compute_owner_elo(
    games: list[GameResult],
    team_owner: dict[int, str],
    seed: dict[str, float],
    k: float = K,
) -> tuple[dict[str, float], dict[tuple[str, int], float]]:
    ratings = dict(seed)
    snapshots: dict[tuple[str, int], float] = {}

    by_week: dict[int, list[GameResult]] = defaultdict(list)
    for g in games:
        by_week[g.week_num].append(g)

    for week in sorted(by_week):
        for g in by_week[week]:
            ho = team_owner.get(g.home_id)
            ao = team_owner.get(g.away_id)
            if ho is None or ao is None or ho == ao:
                continue
            ratings.setdefault(ho, INITIAL)
            ratings.setdefault(ao, INITIAL)
            eh = expected_score(ratings[ho], ratings[ao])
            ea = 1.0 - eh
            if g.home_score > g.away_score:
                sh, sa = 1.0, 0.0
                winner_diff = ratings[ho] - ratings[ao]
            elif g.away_score > g.home_score:
                sh, sa = 0.0, 1.0
                winner_diff = ratings[ao] - ratings[ho]
            else:
                sh, sa = 0.5, 0.5
                winner_diff = 0.0
            mult = _mov_multiplier(abs(g.margin), winner_diff)
            ratings[ho] += k * mult * (sh - eh)
            ratings[ao] += k * mult * (sa - ea)
        for owner in ratings:
            snapshots[(owner, week)] = ratings[owner]

    return ratings, snapshots


def compute_owner_elo_all(conn: sqlite3.Connection, regress: float = REGRESSION) -> None:
    seasons = conn.execute("SELECT id, year FROM seasons ORDER BY year").fetchall()
    if not seasons:
        return

    conn.execute("DELETE FROM owner_elo")
    carry: dict[str, float] = {}
    rows: list[tuple[str, int, int, float]] = []

    for s in seasons:
        season_id = s["id"]
        team_owner = {
            r["id"]: r["owner_id"]
            for r in conn.execute(
                "SELECT id, owner_id FROM teams WHERE season_id = ? AND owner_id IS NOT NULL",
                (season_id,),
            ).fetchall()
        }
        if not team_owner:
            continue

        owners_this = set(team_owner.values())
        seed = {
            o: regress_to_mean(carry[o], regress) if o in carry else INITIAL for o in owners_this
        }
        final, snapshots = compute_owner_elo(load_games(conn, season_id), team_owner, seed)

        for (owner, week), rating in snapshots.items():
            rows.append((owner, season_id, week, rating))
        if snapshots:
            for o in owners_this:
                if o in final:
                    carry[o] = final[o]

    conn.executemany(
        "INSERT INTO owner_elo (owner_id, season_id, week_num, rating) VALUES (?, ?, ?, ?)",
        rows,
    )
    conn.commit()
