"""Real-world NFL stat extraction from ESPN box-score breakdowns.

espn_api parses each rostered player's weekly box score into a ``breakdown`` dict
mixing real NFL counters (yards, TDs, ...) with ESPN fantasy-scoring buckets
(numeric-string keys) and team-level noise (``teamWin``, ``pointsScored``). We keep
only the real counters that make sense to aggregate across weeks.
"""

from __future__ import annotations

REAL_STATS: tuple[str, ...] = (
    "passingAttempts",
    "passingCompletions",
    "passingYards",
    "passingTouchdowns",
    "passingInterceptions",
    "passing2PtConversions",
    "rushingAttempts",
    "rushingYards",
    "rushingTouchdowns",
    "rushing2PtConversions",
    "receivingReceptions",
    "receivingYards",
    "receivingTouchdowns",
    "receivingTargets",
    "receiving2PtConversions",
    "2PtConversions",
    "fumbles",
    "lostFumbles",
    "fumbleRecoveredForTD",
    "turnovers",
    "madeFieldGoals",
    "attemptedFieldGoals",
    "missedFieldGoals",
    "madeFieldGoalsFrom50Plus",
    "attemptedFieldGoalsFrom50Plus",
    "madeExtraPoints",
    "attemptedExtraPoints",
    "missedExtraPoints",
    "defensiveSacks",
    "defensiveInterceptions",
    "defensiveFumbles",
    "defensiveForcedFumbles",
    "defensiveTouchdowns",
    "defensiveSafeties",
    "defensiveBlockedKicks",
    "defensivePointsAllowed",
    "defensiveYardsAllowed",
)

_KEEP = frozenset(REAL_STATS)


def extract_real_stats(breakdown: dict | None) -> dict[str, float]:
    """Filter an espn_api breakdown down to aggregatable real-NFL counters."""
    if not breakdown:
        return {}
    out: dict[str, float] = {}
    for key, value in breakdown.items():
        if key in _KEEP and value:
            out[key] = float(value)
    return out
