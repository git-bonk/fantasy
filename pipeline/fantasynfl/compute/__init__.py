"""Orchestrates all compute modules against the database for a season."""

from __future__ import annotations

import sqlite3

from .awards import compute_awards
from .elo import INITIAL, compute_elo
from .loaders import load_games, load_team_ids
from .luck import compute_luck
from .owner_elo import compute_owner_elo_all
from .players import compute_players
from .playoffs import compute_standings, playoff_odds, rank_standings
from .predict import predict_games
from .records import compute_records
from .sos import compute_sos
from .transactions import store_derived_transactions

__all__ = [
    "compute_all",
    "compute_owner_elo_all",
    "compute_players",
    "load_games",
    "load_team_ids",
    "predict_games",
]


def _team_names(conn: sqlite3.Connection, season_id: int) -> dict[int, str]:
    rows = conn.execute("SELECT id, name FROM teams WHERE season_id = ?", (season_id,)).fetchall()
    return {r["id"]: r["name"] for r in rows}


def _week_ids(conn: sqlite3.Connection, season_id: int) -> dict[int, int]:
    rows = conn.execute(
        "SELECT week_num, id FROM weeks WHERE season_id = ?", (season_id,)
    ).fetchall()
    return {r["week_num"]: r["id"] for r in rows}


def _top_players(conn: sqlite3.Connection, season_id: int) -> dict[int, tuple[str, int, float]]:
    sql = """
    SELECT w.week_num AS week_num, r.player_name AS name, r.team_id AS team_id, r.points AS points
    FROM rosters r
    JOIN weeks w ON w.id = r.week_id
    WHERE w.season_id = ?
    """
    best: dict[int, tuple[str, int, float]] = {}
    for r in conn.execute(sql, (season_id,)).fetchall():
        cur = best.get(r["week_num"])
        if cur is None or r["points"] > cur[2]:
            best[r["week_num"]] = (r["name"], r["team_id"], r["points"])
    return best


def compute_all(
    conn: sqlite3.Connection, season_id: int, n_playoff: int = 6, sims: int = 2000
) -> None:
    games = load_games(conn, season_id)
    team_ids = load_team_ids(conn, season_id)
    if not games or not team_ids:
        return

    names = _team_names(conn, season_id)
    week_ids = _week_ids(conn, season_id)
    weeks = sorted({g.week_num for g in games})
    regular_weeks = sorted({g.week_num for g in games if not g.is_playoff})

    # --- Elo ---
    _, snapshots = compute_elo(games, team_ids)
    conn.executemany(
        "INSERT OR REPLACE INTO elo_ratings (season_id, team_id, week_num, rating) "
        "VALUES (?, ?, ?, ?)",
        [(season_id, t, w, snapshots[(t, w)]) for (t, w) in snapshots],
    )
    elo_before: dict[tuple[int, int], float] = {}
    for i, w in enumerate(weeks):
        prev = weeks[i - 1] if i > 0 else None
        for t in team_ids:
            elo_before[(t, w)] = snapshots[(t, prev)] if prev is not None else INITIAL

    # --- Luck ---
    luck_rows = compute_luck(games, team_ids)
    conn.executemany(
        "INSERT OR REPLACE INTO luck (season_id, team_id, week_num, actual_wins, expected_wins, "
        "luck_score) VALUES (?, ?, ?, ?, ?, ?)",
        [
            (season_id, r.team_id, r.week_num, r.actual_wins, r.expected_wins, r.luck_score)
            for r in luck_rows
        ],
    )

    # --- Strength of schedule ---
    sos_rows = compute_sos(games, team_ids)
    conn.executemany(
        "INSERT OR REPLACE INTO sos (season_id, team_id, week_num, opp_avg_points, sos_rank) "
        "VALUES (?, ?, ?, ?, ?)",
        [(season_id, r.team_id, r.week_num, r.opp_avg_points, r.sos_rank) for r in sos_rows],
    )

    # --- Awards ---
    top_players = _top_players(conn, season_id)
    awards = compute_awards(games, names, elo_before, top_players)
    season_week_ids = [week_ids[w] for w in week_ids]
    if season_week_ids:
        placeholders = ",".join("?" * len(season_week_ids))
        conn.execute(f"DELETE FROM awards WHERE week_id IN ({placeholders})", season_week_ids)
    conn.executemany(
        "INSERT INTO awards (week_id, type, team_id, player_name, value, detail) "
        "VALUES (?, ?, ?, ?, ?, ?)",
        [
            (week_ids[a.week_num], a.type, a.team_id, a.player_name, a.value, a.detail)
            for a in awards
        ],
    )

    # --- Playoff snapshots (per regular-season week) ---
    snapshot_rows = []
    for w in regular_weeks:
        ratings = {t: snapshots[(t, w)] for t in team_ids}
        standings = compute_standings(games, team_ids, through_week=w)
        order = rank_standings(standings)
        seed_of = {t: (i + 1) for i, t in enumerate(order) if i < n_playoff}
        odds = playoff_odds(
            games, team_ids, ratings, through_week=w, n_playoff=n_playoff, sims=sims, seed=1337 + w
        )
        for t in team_ids:
            s = standings[t]
            snapshot_rows.append(
                (
                    season_id,
                    w,
                    t,
                    s.wins,
                    s.losses,
                    s.ties,
                    s.points_for,
                    s.points_against,
                    seed_of.get(t),
                    odds[t],
                )
            )
    conn.executemany(
        "INSERT OR REPLACE INTO playoff_snapshots "
        "(season_id, week_num, team_id, wins, losses, ties, points_for, points_against, "
        "playoff_seed, playoff_odds) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        snapshot_rows,
    )

    # --- Records (global; recompute across all seasons) ---
    conn.execute("DELETE FROM records")
    records = compute_records(conn)
    conn.executemany(
        "INSERT INTO records (category, rank, season_id, team_id, player_name, value, detail) "
        "VALUES (?, ?, ?, ?, ?, ?, ?)",
        [
            (r.category, r.rank, r.season_id, r.team_id, r.player_name, r.value, r.detail)
            for r in records
        ],
    )

    # --- Derived transactions (week-over-week roster diffs) ---
    store_derived_transactions(conn, season_id)

    conn.commit()
