"""Complete per-season NFL stats from ESPN's public athlete API.

Phase 2 source: one GET per player returns every NFL season with per-category stat
tables (labels + aligned values). No auth; keyed by the same ESPN athlete ids stored in
``players.espn_player_id``. Team defenses (negative ESPN ids) are not athletes and
return no categories — callers should skip them.

Rate limiting is the caller's responsibility (owner policy: <= 25 calls/hour).
"""

from __future__ import annotations

import json
import logging
import time
import urllib.error
import urllib.request
from dataclasses import dataclass, field

log = logging.getLogger("fantasynfl.nfl_api")

ATHLETE_STATS_URL = "https://site.web.api.espn.com/apis/common/v3/sports/football/nfl/athletes/{espn_player_id}/stats"
USER_AGENT = "Mozilla/5.0 (fantasynfl personal league dashboard)"
API_TIMEOUT = 30
MAX_RETRIES = 3
RETRY_BASE_DELAY = 5

CATEGORY_LABEL_MAP: dict[str, dict[str, str]] = {
    "passing": {
        "CMP": "passingCompletions",
        "ATT": "passingAttempts",
        "YDS": "passingYards",
        "TD": "passingTouchdowns",
        "INT": "passingInterceptions",
    },
    "rushing": {
        "CAR": "rushingAttempts",
        "YDS": "rushingYards",
        "TD": "rushingTouchdowns",
        "FUM": "fumbles",
        "LST": "lostFumbles",
    },
    "receiving": {
        "REC": "receivingReceptions",
        "TGTS": "receivingTargets",
        "YDS": "receivingYards",
        "TD": "receivingTouchdowns",
        "FUM": "fumbles",
        "LST": "lostFumbles",
    },
    "defensive": {
        "SACK": "defensiveSacks",
        "FF": "defensiveForcedFumbles",
        "FR": "defensiveFumbles",
        "INT": "defensiveInterceptions",
        "TD": "defensiveTouchdowns",
    },
}

KICKING_PAIR_LABELS: dict[str, tuple[str, str]] = {
    "FG": ("madeFieldGoals", "attemptedFieldGoals"),
    "50+": ("madeFieldGoalsFrom50Plus", "attemptedFieldGoalsFrom50Plus"),
}
KICKING_SIMPLE_LABELS: dict[str, str] = {
    "XPM": "madeExtraPoints",
    "XPA": "attemptedExtraPoints",
}

SLUG_TO_ABBREV: dict[str, str] = {
    "arizona-cardinals": "ARI",
    "atlanta-falcons": "ATL",
    "baltimore-ravens": "BAL",
    "buffalo-bills": "BUF",
    "carolina-panthers": "CAR",
    "chicago-bears": "CHI",
    "cincinnati-bengals": "CIN",
    "cleveland-browns": "CLE",
    "dallas-cowboys": "DAL",
    "denver-broncos": "DEN",
    "detroit-lions": "DET",
    "green-bay-packers": "GB",
    "houston-texans": "HOU",
    "indianapolis-colts": "IND",
    "jacksonville-jaguars": "JAX",
    "kansas-city-chiefs": "KC",
    "las-vegas-raiders": "LV",
    "los-angeles-chargers": "LAC",
    "los-angeles-rams": "LAR",
    "miami-dolphins": "MIA",
    "minnesota-vikings": "MIN",
    "new-england-patriots": "NE",
    "new-orleans-saints": "NO",
    "new-york-giants": "NYG",
    "new-york-jets": "NYJ",
    "philadelphia-eagles": "PHI",
    "pittsburgh-steelers": "PIT",
    "san-francisco-49ers": "SF",
    "seattle-seahawks": "SEA",
    "tampa-bay-buccaneers": "TB",
    "tennessee-titans": "TEN",
    "washington-commanders": "WAS",
    "washington": "WAS",
    "oakland-raiders": "LV",
    "san-diego-chargers": "LAC",
    "st-louis-rams": "LAR",
    "washington-redskins": "WAS",
    "washington-football-team": "WAS",
}


def _team_abbrev(slug: str | None) -> str | None:
    if not slug:
        return None
    return SLUG_TO_ABBREV.get(slug, slug)


@dataclass(frozen=True)
class AthleteSeason:
    season_year: int
    nfl_team: str | None
    gp: int | None
    stats: dict[str, float] = field(default_factory=dict)


def _num(raw: object) -> float | None:
    """Parse '1,793' / '25' / '64.8'; None for '-', '' or junk."""
    if raw is None:
        return None
    text = str(raw).replace(",", "").strip()
    if not text or text == "-":
        return None
    try:
        return float(text)
    except ValueError:
        return None


def _pair(raw: object) -> tuple[float, float] | None:
    """Parse kicking 'made-attempted' pairs like '36-42'."""
    text = str(raw).strip()
    if "-" not in text:
        return None
    head, _, tail = text.partition("-")
    made, attempted = _num(head), _num(tail)
    if made is None or attempted is None:
        return None
    return made, attempted


def parse_athlete_stats(payload: dict) -> list[AthleteSeason]:
    """Pure parser: ESPN athlete /stats payload -> one AthleteSeason per NFL season."""
    by_year: dict[int, dict] = {}

    def season_entry(year: int, slug: str | None) -> dict:
        abbrev = _team_abbrev(slug)
        entry = by_year.get(year)
        if entry is None:
            entry = {"nfl_team": abbrev, "gp": None, "stats": {}}
            by_year[year] = entry
        elif abbrev and not entry["nfl_team"]:
            entry["nfl_team"] = abbrev
        return entry

    for category in payload.get("categories") or []:
        name = category.get("name")
        labels = [str(lbl).strip() for lbl in category.get("labels") or []]
        label_map = CATEGORY_LABEL_MAP.get(name or "")
        for row in category.get("statistics") or []:
            year_raw = (row.get("season") or {}).get("year")
            try:
                year = int(year_raw)
            except (TypeError, ValueError):
                continue
            entry = season_entry(year, row.get("teamSlug"))
            values = row.get("stats") or []
            for label, value in zip(labels, values, strict=False):
                if label == "GP":
                    gp = _num(value)
                    if gp is not None and entry["gp"] is None:
                        entry["gp"] = int(gp)
                    continue
                if name == "kicking":
                    if label in KICKING_PAIR_LABELS:
                        pair = _pair(value)
                        if pair:
                            made_key, attempted_key = KICKING_PAIR_LABELS[label]
                            entry["stats"][made_key] = pair[0]
                            entry["stats"][attempted_key] = pair[1]
                    elif label in KICKING_SIMPLE_LABELS:
                        number = _num(value)
                        if number is not None:
                            entry["stats"][KICKING_SIMPLE_LABELS[label]] = number
                    continue
                if not label_map:
                    continue
                key = label_map.get(label)
                if key is None:
                    continue
                number = _num(value)
                if number is not None:
                    entry["stats"][key] = entry["stats"].get(key, 0.0) + number

    return [
        AthleteSeason(
            season_year=year,
            nfl_team=entry["nfl_team"],
            gp=entry["gp"],
            stats=entry["stats"],
        )
        for year, entry in sorted(by_year.items())
        if entry["stats"]
    ]


def fetch_athlete_season_stats(espn_player_id: int) -> list[AthleteSeason]:
    """GET one player's complete NFL season stats. Raises after MAX_RETRIES failures."""
    url = ATHLETE_STATS_URL.format(espn_player_id=espn_player_id)
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    last_exc: Exception | None = None
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            with urllib.request.urlopen(request, timeout=API_TIMEOUT) as response:
                payload = json.loads(response.read().decode("utf-8"))
            return parse_athlete_stats(payload)
        except urllib.error.HTTPError as exc:
            if exc.code == 404:
                raise RuntimeError(f"athlete {espn_player_id} not found (404)") from exc
            last_exc = exc
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, OSError) as exc:
            last_exc = exc
        if attempt < MAX_RETRIES:
            delay = RETRY_BASE_DELAY * (2 ** (attempt - 1))
            log.warning(
                "athlete stats %s attempt %d failed (%s); retrying in %ds",
                espn_player_id,
                attempt,
                last_exc,
                delay,
            )
            time.sleep(delay)
    raise RuntimeError(f"athlete stats fetch failed for {espn_player_id}") from last_exc
