"""All-time records across every season, computed directly from the database."""

from __future__ import annotations

import sqlite3
from dataclasses import dataclass

SINGLE_GAME_HIGH = "SINGLE_GAME_HIGH"
SINGLE_GAME_LOW = "SINGLE_GAME_LOW"
BIGGEST_WIN = "BIGGEST_WIN"
TOP_PLAYER_GAME = "TOP_PLAYER_GAME"
BEST_SEASON = "BEST_SEASON"
LONGEST_STREAK = "LONGEST_STREAK"

TOP_N = 5


@dataclass(frozen=True)
class RecordRow:
    category: str
    rank: int
    season_id: int | None
    team_id: int | None
    player_name: str | None
    value: float
    detail: str


_TEAM_GAMES_SQL = """
SELECT s.id AS season_id, s.year AS year, w.week_num AS week_num,
       m.home_team_id AS team_id, th.name AS team_name,
       m.home_score AS score, m.away_score AS opp_score, m.is_playoff AS is_playoff
FROM matchups m
JOIN weeks w ON w.id = m.week_id
JOIN seasons s ON s.id = w.season_id
JOIN teams th ON th.id = m.home_team_id
UNION ALL
SELECT s.id, s.year, w.week_num,
       m.away_team_id, ta.name,
       m.away_score, m.home_score, m.is_playoff
FROM matchups m
JOIN weeks w ON w.id = m.week_id
JOIN seasons s ON s.id = w.season_id
JOIN teams ta ON ta.id = m.away_team_id
"""


def compute_records(conn: sqlite3.Connection) -> list[RecordRow]:
    games = [dict(r) for r in conn.execute(_TEAM_GAMES_SQL).fetchall()]
    rows: list[RecordRow] = []
    rows += _single_game(games)
    rows += _biggest_win(games)
    rows += _top_player_game(conn)
    rows += _best_season(games)
    rows += _longest_streak(games)
    return rows


def _single_game(games: list[dict]) -> list[RecordRow]:
    high = sorted(games, key=lambda g: -g["score"])[:TOP_N]
    low = sorted(games, key=lambda g: g["score"])[:TOP_N]
    rows: list[RecordRow] = []
    for i, g in enumerate(high, 1):
        rows.append(
            RecordRow(
                SINGLE_GAME_HIGH,
                i,
                g["season_id"],
                g["team_id"],
                None,
                g["score"],
                f"{g['team_name']} · {g['score']:.1f} pts ({g['year']} W{g['week_num']})",
            )
        )
    for i, g in enumerate(low, 1):
        rows.append(
            RecordRow(
                SINGLE_GAME_LOW,
                i,
                g["season_id"],
                g["team_id"],
                None,
                g["score"],
                f"{g['team_name']} · {g['score']:.1f} pts ({g['year']} W{g['week_num']})",
            )
        )
    return rows


def _biggest_win(games: list[dict]) -> list[RecordRow]:
    wins = [g for g in games if g["score"] > g["opp_score"]]
    wins.sort(key=lambda g: -(g["score"] - g["opp_score"]))
    rows: list[RecordRow] = []
    for i, g in enumerate(wins[:TOP_N], 1):
        margin = g["score"] - g["opp_score"]
        rows.append(
            RecordRow(
                BIGGEST_WIN,
                i,
                g["season_id"],
                g["team_id"],
                None,
                margin,
                f"{g['team_name']} won by {margin:.1f} ({g['year']} W{g['week_num']})",
            )
        )
    return rows


def _top_player_game(conn: sqlite3.Connection) -> list[RecordRow]:
    sql = """
    SELECT r.player_name AS player_name, r.points AS points, r.position AS position,
           t.name AS team_name, s.year AS year, s.id AS season_id, t.id AS team_id
    FROM rosters r
    JOIN teams t ON t.id = r.team_id
    JOIN weeks w ON w.id = r.week_id
    JOIN seasons s ON s.id = w.season_id
    ORDER BY r.points DESC
    LIMIT ?
    """
    rows: list[RecordRow] = []
    for i, r in enumerate(conn.execute(sql, (TOP_N,)).fetchall(), 1):
        detail = f"{r['player_name']} ({r['position']}) · {r['points']:.1f} pts ({r['year']})"
        rows.append(
            RecordRow(
                TOP_PLAYER_GAME,
                i,
                r["season_id"],
                r["team_id"],
                r["player_name"],
                r["points"],
                detail,
            )
        )
    return rows


def _best_season(games: list[dict]) -> list[RecordRow]:
    agg: dict[tuple[int, int], dict] = {}
    for g in games:
        key = (g["season_id"], g["team_id"])
        a = agg.setdefault(key, {"wins": 0, "pf": 0.0, "name": g["team_name"], "year": g["year"]})
        a["pf"] += g["score"]
        if g["score"] > g["opp_score"]:
            a["wins"] += 1
    ranked = sorted(agg.items(), key=lambda kv: (kv[1]["wins"], kv[1]["pf"]), reverse=True)
    rows: list[RecordRow] = []
    for i, ((season_id, team_id), a) in enumerate(ranked[:TOP_N], 1):
        rows.append(
            RecordRow(
                BEST_SEASON,
                i,
                season_id,
                team_id,
                None,
                float(a["wins"]),
                f"{a['name']} · {a['wins']} wins ({a['year']})",
            )
        )
    return rows


def _longest_streak(games: list[dict]) -> list[RecordRow]:
    by_team: dict[tuple[int, int], list[dict]] = {}
    for g in games:
        by_team.setdefault((g["season_id"], g["team_id"]), []).append(g)

    best: list[tuple[int, int, str, int, int]] = []  # season, team, name, streak, year
    for (season_id, team_id), gs in by_team.items():
        gs.sort(key=lambda g: g["week_num"])
        streak = 0
        max_streak = 0
        name = gs[0]["team_name"]
        year = gs[0]["year"]
        for g in gs:
            if g["score"] > g["opp_score"]:
                streak += 1
                max_streak = max(max_streak, streak)
            else:
                streak = 0
        best.append((season_id, team_id, name, max_streak, year))

    best.sort(key=lambda x: -x[3])
    rows: list[RecordRow] = []
    for i, (season_id, team_id, name, streak, year) in enumerate(best[:TOP_N], 1):
        rows.append(
            RecordRow(
                LONGEST_STREAK,
                i,
                season_id,
                team_id,
                None,
                float(streak),
                f"{name} · {streak} straight wins ({year})",
            )
        )
    return rows
