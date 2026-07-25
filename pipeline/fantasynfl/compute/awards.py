"""Weekly award badges computed from scores, Elo, and outscored fractions."""

from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass

from .luck import outscored_fraction
from .types import GameResult

TOP_SCORE = "TOP_SCORE"
BIGGEST_BUST = "BIGGEST_BUST"
CLOSEST_FINISH = "CLOSEST_FINISH"
BIGGEST_UPSET = "BIGGEST_UPSET"
LUCKIEST = "LUCKIEST"
TOP_PLAYER = "TOP_PLAYER"


@dataclass(frozen=True)
class Award:
    week_num: int
    type: str
    team_id: int | None
    player_name: str | None
    value: float
    detail: str


def compute_awards(
    games: list[GameResult],
    team_names: dict[int, str],
    elo_before: dict[tuple[int, int], float],
    top_players: dict[int, tuple[str, int, float]],
) -> list[Award]:
    by_week: dict[int, list[GameResult]] = defaultdict(list)
    for g in games:
        by_week[g.week_num].append(g)

    awards: list[Award] = []
    for week in sorted(by_week):
        week_games = by_week[week]
        scores: dict[int, float] = {}
        for g in week_games:
            scores[g.home_id] = g.home_score
            scores[g.away_id] = g.away_score

        if scores:
            top_id = max(scores, key=lambda t: scores[t])
            bust_id = min(scores, key=lambda t: scores[t])
            awards.append(
                Award(
                    week,
                    TOP_SCORE,
                    top_id,
                    None,
                    scores[top_id],
                    f"{team_names[top_id]} dropped {scores[top_id]:.1f}",
                )
            )
            awards.append(
                Award(
                    week,
                    BIGGEST_BUST,
                    bust_id,
                    None,
                    scores[bust_id],
                    f"{team_names[bust_id]} managed just {scores[bust_id]:.1f}",
                )
            )

        decided = [g for g in week_games if g.winner() is not None]
        if decided:
            closest = min(decided, key=lambda g: abs(g.margin))
            winner = closest.winner()
            loser = closest.away_id if winner == closest.home_id else closest.home_id
            margin = abs(closest.margin)
            awards.append(
                Award(
                    week,
                    CLOSEST_FINISH,
                    winner,
                    None,
                    margin,
                    f"{team_names[winner]} edged {team_names[loser]} by {margin:.1f}",
                )
            )

            upsets = []
            for g in decided:
                w = g.winner()
                loser_id = loser_of(g)
                ew = elo_before.get((w, week))
                el = elo_before.get((loser_id, week))
                if ew is not None and el is not None and el > ew:
                    upsets.append((el - ew, w, loser_id))
            if upsets:
                diff, w, loser_id = max(upsets, key=lambda x: x[0])
                awards.append(
                    Award(
                        week,
                        BIGGEST_UPSET,
                        w,
                        None,
                        diff,
                        f"{team_names[w]} stunned {team_names[loser_id]}",
                    )
                )

            luckiest = None
            for g in decided:
                w = g.winner()
                others = [s for t, s in scores.items() if t != w]
                frac = outscored_fraction(scores[w], others)
                if luckiest is None or frac < luckiest[0]:
                    luckiest = (frac, w)
            if luckiest is not None:
                frac, w = luckiest
                awards.append(
                    Award(week, LUCKIEST, w, None, frac, f"{team_names[w]} found a way to win")
                )

        if week in top_players:
            pname, tid, pts = top_players[week]
            awards.append(
                Award(week, TOP_PLAYER, tid, pname, pts, f"{pname} erupted for {pts:.1f}")
            )

    return awards


def loser_of(g: GameResult) -> int:
    return g.away_id if g.winner() == g.home_id else g.home_id
