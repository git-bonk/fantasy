"""Lightweight value types for the compute modules (DB-agnostic, testable)."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class GameResult:
    week_num: int
    home_id: int
    away_id: int
    home_score: float
    away_score: float
    is_playoff: bool

    @property
    def margin(self) -> float:
        return self.home_score - self.away_score

    def winner(self) -> int | None:
        if self.home_score > self.away_score:
            return self.home_id
        if self.away_score > self.home_score:
            return self.away_id
        return None
