"""ESPN client: wraps espn_api with retry, timeouts, and incremental fetching.

Each fetch function returns data for one logical unit (teams, one week, etc.)
so the ingester can write to the DB incrementally and resume after interruption.
"""

from __future__ import annotations

import logging
import time
from typing import Any

from .models import Matchup, Owner, RosterPlayer, Team, Transaction, WeekInfo, WeekRoster

log = logging.getLogger("fantasynfl.espn")

_PALETTE = [
    "#22c55e", "#f59e0b", "#38bdf8", "#ef4444", "#a855f7", "#ec4899",
    "#14b8a6", "#f97316", "#84cc16", "#6366f1", "#0ea5e9", "#eab308",
]

MAX_RETRIES = 3
RETRY_BASE_DELAY = 5
API_TIMEOUT = 60


def _norm_position(pos: str) -> str:
    return "DEF" if pos in ("D/ST", "DST", "DP") else pos


def _norm_slot(slot: str) -> str:
    mapping = {"D/ST": "DEF", "DST": "DEF", "Bench": "BN", "BE": "BN", "IR": "IR", "OP": "FLEX"}
    return mapping.get(slot, slot)


def _owner_from_member(member: dict[str, Any]) -> Owner:
    """Build an Owner from an ESPN member dict (stable `id` + name fields)."""
    first = member.get("firstName")
    last = member.get("lastName")
    raw_id = member.get("id")
    display = member.get("displayName")
    if not display:
        display = " ".join(part for part in (first, last) if part)
    if not display:
        display = str(raw_id) if raw_id is not None else "Unknown"
    return Owner(
        owner_id=str(raw_id) if raw_id is not None else "",
        display_name=display,
        first_name=first,
        last_name=last,
    )


def _retry(fn: Any, *args: Any, label: str = "", **kwargs: Any) -> Any:
    """Call fn with exponential-backoff retry. Raises after MAX_RETRIES failures."""
    last_exc: Exception | None = None
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            t0 = time.monotonic()
            result = fn(*args, **kwargs)
            elapsed = time.monotonic() - t0
            if elapsed > API_TIMEOUT:
                log.warning("%s took %.1fs (slow but succeeded)", label or fn.__name__, elapsed)
            return result
        except Exception as exc:
            last_exc = exc
            delay = RETRY_BASE_DELAY * (2 ** (attempt - 1))
            log.warning(
                "%s failed (attempt %d/%d): %s - retrying in %ds",
                label or fn.__name__, attempt, MAX_RETRIES, exc, delay,
            )
            if attempt < MAX_RETRIES:
                time.sleep(delay)
    raise RuntimeError(
        f"{label or 'API call'} failed after {MAX_RETRIES} attempts: {last_exc}"
    ) from last_exc


class ESPNClient:
    """Stateful ESPN API client for one league/year.

    Usage:
        client = ESPNClient(league_id, year, espn_s2, swid)
        teams, owners = client.fetch_teams()
        for week_num in range(1, 20):
            data = client.fetch_week(week_num)
            if data is None:
                break  # no more weeks
    """

    def __init__(self, league_id: str, year: int, espn_s2: str, swid: str) -> None:
        self.league_id = league_id
        self.year = year
        self._espn_s2 = espn_s2
        self._swid = swid
        self._league: Any = None
        self._last_fingerprint: str | None = None

    def _get_league(self) -> Any:
        if self._league is None:
            from espn_api.football import League
            log.info("Initializing ESPN League(league_id=%s, year=%d)...", self.league_id, self.year)
            self._league = _retry(
                League,
                league_id=int(self.league_id),
                year=self.year,
                espn_s2=self._espn_s2,
                swid=self._swid,
                label=f"League init ({self.year})",
            )
            log.info("League initialized: %s", getattr(self._league, "settings", None))
        return self._league

    def fetch_teams(self) -> tuple[list[Team], list[Owner]]:
        """Fetch team metadata + deduped owners. Call once per season.

        Returns ``(teams, owners)`` where each ``Team.owner_id`` references the
        primary owner and ``owners`` is the deduped list of league members that
        own at least one team.
        """
        league = self._get_league()
        owners_by_id: dict[str, Owner] = {}
        teams: list[Team] = []
        for i, t in enumerate(league.teams):
            member_owners = list(getattr(t, "owners", None) or [])
            owner_id: str | None = None
            owner_name = ""
            if member_owners:
                if len(member_owners) > 1:
                    log.info(
                        "Team %r has %d owners; using primary owner only",
                        t.team_name, len(member_owners),
                    )
                owner = _owner_from_member(member_owners[0])
                if owner.owner_id:
                    owners_by_id.setdefault(owner.owner_id, owner)
                    owner_id = owner.owner_id
                    owner_name = owner.display_name or ""
            teams.append(
                Team(
                    espn_team_id=t.team_id,
                    name=t.team_name,
                    abbrev=getattr(t, "team_abbrev", "") or t.team_name[:3].upper(),
                    owner_name=owner_name,
                    color=_PALETTE[i % len(_PALETTE)],
                    logo_url=getattr(t, "logo_url", None),
                    owner_id=owner_id,
                )
            )
        owners = list(owners_by_id.values())
        log.info("Fetched %d teams and %d owners for %d", len(teams), len(owners), self.year)
        return teams, owners

    def fetch_week(self, week_num: int) -> tuple[WeekInfo, list[Matchup], list[WeekRoster]] | None:
        """Fetch one week of box scores. Returns None when no more weeks exist."""
        league = self._get_league()
        try:
            boxes = _retry(
                league.box_scores, week_num,
                label=f"box_scores(week={week_num}, year={self.year})",
            )
        except RuntimeError:
            raise
        except Exception:
            return None

        if not boxes:
            return None

        is_playoff = any(
            (getattr(b, "playoff_tier_type", None) or "NONE") != "NONE" for b in boxes
        )
        label = f"Playoff {week_num}" if is_playoff else f"Week {week_num}"
        week_info = WeekInfo(week_num, label, None, None, is_playoff)

        matchups: list[Matchup] = []
        rosters: list[WeekRoster] = []

        for b in boxes:
            if b.home_team is None or b.away_team is None:
                continue
            home_id = b.home_team.team_id
            away_id = b.away_team.team_id
            home_score = float(b.home_score or 0.0)
            away_score = float(b.away_score or 0.0)
            matchups.append(Matchup(week_num, home_id, away_id, home_score, away_score, is_playoff))
            rosters.append(WeekRoster(week_num, home_id, _lineup(b.home_lineup)))
            rosters.append(WeekRoster(week_num, away_id, _lineup(b.away_lineup)))

        # Dedup: ESPN returns the last real week's data for nonexistent weeks.
        # If matchups+scores are identical to the previous week, it's a phantom.
        fingerprint = str(sorted(
            (m.home_team_id, m.away_team_id, m.home_score, m.away_score)
            for m in matchups
        ))
        if fingerprint == self._last_fingerprint:
            log.info(
                "Week %d: identical to previous week - phantom duplicate, stopping",
                week_num,
            )
            return None
        self._last_fingerprint = fingerprint

        log.info(
            "Week %d: %d matchups, %d rosters%s",
            week_num, len(matchups), len(rosters),
            " (playoff)" if is_playoff else "",
        )
        return week_info, matchups, rosters

    def fetch_transactions(self, teams: list[Team]) -> list[Transaction]:
        """Best-effort recent activity -> transactions."""
        league = self._get_league()
        team_by_name = {t.name: t.espn_team_id for t in teams}
        txs: list[Transaction] = []
        try:
            activities = _retry(
                league.recent_activity,
                label=f"recent_activity(year={self.year})",
            )
        except Exception as exc:
            log.warning("Could not fetch transactions for %d: %s", self.year, exc)
            return txs

        for act in activities or []:
            date_iso = ""
            try:
                from datetime import UTC, datetime
                date_iso = datetime.fromtimestamp(act.date / 1000, tz=UTC).isoformat()
            except Exception:
                pass
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
                        espn_player_id=int(getattr(player, "playerId", 0) or 0),
                        player_name=getattr(player, "name", None),
                        type=ttype,
                        bid_amount=None,
                        occurred_at=date_iso,
                    )
                )
        log.info("Fetched %d transactions for %d", len(txs), self.year)
        return txs

    def get_settings(self) -> dict[str, object]:
        league = self._get_league()
        return {
            "scoring": getattr(getattr(league, "settings", None), "scoring_format", "unknown"),
            "playoff_teams": getattr(getattr(league, "settings", None), "playoff_team_count", 6),
        }


def _lineup(lineup: list[object]) -> list[RosterPlayer]:
    players = []
    for p in lineup or []:
        players.append(
            RosterPlayer(
                espn_player_id=int(p.playerId),
                name=p.name,
                position=_norm_position(getattr(p, "position", "") or ""),
                nfl_team=getattr(p, "proTeam", "") or "",
                lineup_slot=_norm_slot(getattr(p, "lineupSlot", "") or "BN"),
                points=float(getattr(p, "points", 0.0) or 0.0),
            )
        )
    return players
