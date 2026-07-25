"""Matchup win probability from Elo ratings."""

from __future__ import annotations

from .elo import win_probability
from .types import GameResult


def predict_games(games: list[GameResult], ratings: dict[int, float]) -> dict[int, float]:
    """Return {game_index: home_win_probability} using current ratings."""
    return {i: win_probability(ratings[g.home_id], ratings[g.away_id]) for i, g in enumerate(games)}


__all__ = ["predict_games", "win_probability"]
