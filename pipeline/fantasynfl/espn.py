"""ESPN client: wraps espn_api and normalizes a season into SeasonData.

NOTE: This cannot be exercised without real league credentials, so it is written
defensively and should be verified against a live league on first use. The sample
generator (sample.py) produces the exact same SeasonData shape, so everything
downstream (ingest + compute + web) is source-agnostic.
"""

from __future__ import annotations

from datetime import UTC

from .models import Matchup, RosterPlayer, SeasonData, Team, Transaction, WeekInfo, WeekRoster

_PALETTE = [
    "#22c55e",
    "#f59e0b",
    "#38bdf8",
    "#ef4444",
    "#a855f7",
    "#ec4899",
    "#14b8a6",
    "#f97316",
    "#84cc16",
    "#6366f1",
    "#0ea5e9",
    "#eab308",
]


def _norm_position(pos: str) -> str:
    return "DEF" if pos in ("D/ST", "DST", "DP") else pos


def _norm_slot(slot: str) -> str:
    mapping = {"D/ST": "DEF", "DST": "DEF", "Bench": "BN", "BE": "BN", "IR": "IR", "OP": "FLEX"}
    return mapping.get(slot, slot)


def fetch_season(league_id: str, year: int, espn_s2: str, swid: str) -> SeasonData:
    from espn_api.football import League  # imported lazily so sample runs without it

    league = League(league_id=int(league_id), year=year, espn_s2=espn_s2, swid=swid)

    teams = [
        Team(
            espn_team_id=t.team_id,
            name=t.team_name,
            abbrev=getattr(t, "team_abbrev", "") or t.team_name[:3].upper(),
            owner_name=getattr(t, "owner", "") or "",
            color=_PALETTE[i % len(_PALETTE)],
            logo_url=getattr(t, "logo_url", None),
        )
        for i, t in enumerate(league.teams)
    ]

    weeks: list[WeekInfo] = []
    matchups: list[Matchup] = []
    rosters: list[WeekRoster] = []

    week = 1
    while True:
        try:
            boxes = league.box_scores(week)
        except Exception:
            break
        if not boxes:
            break

        is_playoff = any((getattr(b, "playoff_tier_type", None) or "NONE") != "NONE" for b in boxes)
        label = f"Week {week}" if not is_playoff else f"Playoff {week}"
        weeks.append(WeekInfo(week, label, None, None, is_playoff))

        for b in boxes:
            if b.home_team is None or b.away_team is None:
                continue
            home_id = b.home_team.team_id
            away_id = b.away_team.team_id
            home_score = float(b.home_score or 0.0)
            away_score = float(b.away_score or 0.0)
            matchups.append(Matchup(week, home_id, away_id, home_score, away_score, is_playoff))

            rosters.append(WeekRoster(week, home_id, _lineup(b.home_lineup)))
            rosters.append(WeekRoster(week, away_id, _lineup(b.away_lineup)))

        week += 1

    settings = {
        "scoring": getattr(getattr(league, "settings", None), "scoring_format", "unknown"),
        "playoff_teams": getattr(getattr(league, "settings", None), "playoff_team_count", 6),
    }

    return SeasonData(
        year=year,
        league_id=league_id,
        settings=settings,
        teams=teams,
        weeks=weeks,
        matchups=matchups,
        rosters=rosters,
        transactions=_transactions(league, teams),
    )


def _lineup(lineup: list[object]) -> list[RosterPlayer]:
    players = []
    for p in lineup or []:
        players.append(
            RosterPlayer(
                espn_player_id=int(p.player_id),
                name=p.name,
                position=_norm_position(getattr(p, "position", "") or ""),
                nfl_team=getattr(p, "proTeam", "") or "",
                lineup_slot=_norm_slot(getattr(p, "lineup_slot", "") or "BN"),
                points=float(getattr(p, "points", 0.0) or 0.0),
            )
        )
    return players


def _transactions(league: object, teams: list[Team]) -> list[Transaction]:
    """Best-effort recent activity -> transactions. ESPN's API only exposes recent
    activity, so this is inherently partial for historical seasons."""
    txs: list[Transaction] = []
    team_by_name = {t.name: t.espn_team_id for t in teams}
    try:
        activities = league.recent_activity(limit=200)
    except Exception:
        return txs
    for act in activities or []:
        date_iso = ""
        try:
            from datetime import datetime

            date_iso = datetime.fromtimestamp(act.date / 1000, tz=UTC).isoformat()
        except Exception:
            date_iso = ""
        for team_name, action, player in getattr(act, "actions", []):
            ttype = {
                "ADDED": "ADD",
                "DROPPED": "DROP",
                "TRADED_IN": "TRADE_IN",
                "TRADED_OUT": "TRADE_OUT",
            }.get(action)
            if not ttype:
                continue
            txs.append(
                Transaction(
                    team_id=team_by_name.get(team_name),
                    espn_player_id=int(getattr(player, "player_id", 0) or 0),
                    player_name=getattr(player, "name", None),
                    type=ttype,
                    bid_amount=None,
                    occurred_at=date_iso,
                )
            )
    return txs
