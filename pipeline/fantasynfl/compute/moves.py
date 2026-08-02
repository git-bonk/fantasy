"""Shared seam for the transaction-impact features (trade analyzer + waiver regret).

Both ``trades.py`` and ``waiver.py`` grade a roster move with the same question:
how many points did the player produce in the weeks *after* the move? This module
owns that rule once — the evaluation window length, the gem/regret thresholds, the
``points_after`` helper, the roster pre-processing, and the team filters — so the
two features can never drift apart.

Regular-season filtering is a caller responsibility. ``RosterRow`` carries no
playoff flag and ``load_rosters`` returns every week, so the compute functions in
``trades.py`` / ``waiver.py`` load the season's playoff-week set themselves and
pre-filter rosters with ``without_playoff_weeks`` before grading. ``points_after``
stays week-set agnostic: it only knows the window ``(week_num, week_num + EVAL_WEEKS]``.

No database access lives here — this is the pure side of the pure/IO boundary.
"""

from __future__ import annotations

from collections import defaultdict
from collections.abc import Callable, Iterable

from .types import RosterRow

EVAL_WEEKS = 4
GEM_THRESHOLD = 50.0
REGRET_THRESHOLD = 50.0


def points_after(
    rosters: list[RosterRow],
    espn_player_id: int,
    week_num: int,
    team_filter: Callable[[int], bool],
) -> float:
    """Sum one player's roster points in the evaluation window after a move.

    The window is ``(week_num, week_num + EVAL_WEEKS]``: the move's own week is
    excluded (that roster already reflects the move) and exactly ``EVAL_WEEKS``
    later weeks are considered. Only rows whose team passes ``team_filter`` count.
    Callers must pre-filter ``rosters`` to regular-season weeks — the helper is
    week-set agnostic. ``rosters`` may be the whole season or a per-player slice.
    """
    total = 0.0
    for r in rosters:
        if (
            r.espn_player_id == espn_player_id
            and week_num < r.week_num <= week_num + EVAL_WEEKS
            and team_filter(r.team_id)
        ):
            total += r.points
    return total


def without_playoff_weeks(
    rosters: list[RosterRow], playoff_weeks: Iterable[int]
) -> list[RosterRow]:
    """Keep only regular-season rows; grading windows must never cross into playoffs."""
    excluded = set(playoff_weeks)
    return [r for r in rosters if r.week_num not in excluded]


def index_by_player(rosters: list[RosterRow]) -> dict[int, list[RosterRow]]:
    """Group rows by ESPN player id so window lookups are O(window), not O(season)."""
    by_player: dict[int, list[RosterRow]] = defaultdict(list)
    for r in rosters:
        by_player[r.espn_player_id].append(r)
    return dict(by_player)


def team_only(team_id: int) -> Callable[[int], bool]:
    """Filter accepting only ``team_id`` — points produced while on that roster."""
    return lambda other: other == team_id


def other_teams(team_id: int) -> Callable[[int], bool]:
    """Filter accepting every team except ``team_id`` — points produced elsewhere."""
    return lambda other: other != team_id
