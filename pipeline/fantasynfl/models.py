"""Normalized data model shared by the sample generator and the ESPN client.

Both sources produce a `SeasonData`, which the ingester writes to SQLite and the
compute modules consume. Keeping this shape source-agnostic means swapping the
sample generator for the real ESPN client changes nothing downstream.
"""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(frozen=True)
class Team:
    espn_team_id: int
    name: str
    abbrev: str
    owner_name: str
    color: str
    logo_url: str | None = None


@dataclass(frozen=True)
class RosterPlayer:
    espn_player_id: int
    name: str
    position: str  # QB, RB, WR, TE, K, DEF
    nfl_team: str
    lineup_slot: str  # QB, RB, WR, TE, FLEX, K, DEF, BN, IR
    points: float


@dataclass(frozen=True)
class WeekInfo:
    week_num: int
    label: str
    start_date: str | None
    end_date: str | None
    is_playoff: bool


@dataclass(frozen=True)
class Matchup:
    week_num: int
    home_team_id: int
    away_team_id: int
    home_score: float
    away_score: float
    is_playoff: bool


@dataclass
class WeekRoster:
    week_num: int
    team_id: int
    players: list[RosterPlayer] = field(default_factory=list)


@dataclass(frozen=True)
class Transaction:
    team_id: int | None
    espn_player_id: int | None
    player_name: str | None
    type: str  # ADD, DROP, TRADE_IN, TRADE_OUT
    bid_amount: int | None
    occurred_at: str  # ISO date


@dataclass
class SeasonData:
    year: int
    league_id: str
    settings: dict[str, object] = field(default_factory=dict)
    teams: list[Team] = field(default_factory=list)
    weeks: list[WeekInfo] = field(default_factory=list)
    matchups: list[Matchup] = field(default_factory=list)
    rosters: list[WeekRoster] = field(default_factory=list)
    transactions: list[Transaction] = field(default_factory=list)
