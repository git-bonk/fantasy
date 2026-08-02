"""Synthetic 12-team season generator.

Produces a fully self-consistent SeasonData with no external dependencies, so the
whole dashboard can be built and previewed before real ESPN credentials are available.
A team's matchup score always equals the sum of its starter roster points.
"""

from __future__ import annotations

import random
import sqlite3
from dataclasses import replace
from datetime import UTC, date, datetime, timedelta

from .models import (
    Matchup,
    Owner,
    RosterPlayer,
    SeasonData,
    Team,
    Transaction,
    WeekInfo,
    WeekRoster,
)

TEAMS = [
    ("Gridiron Gladiators", "GLA", "Marcus Reed", "#22c55e"),
    ("End Zone Elite", "EZE", "Tanya Brooks", "#f59e0b"),
    ("The Pigskin Prophets", "PIP", "Devon Clarke", "#38bdf8"),
    ("Blitzkrieg Battalion", "BLI", "Sofia Nguyen", "#ef4444"),
    ("Catch Me If You Can", "CAT", "Liam O'Connor", "#a855f7"),
    ("Hail Mary Heroes", "HMH", "Priya Patel", "#ec4899"),
    ("Turbo Tight Ends", "TTE", "Jamal Wright", "#14b8a6"),
    ("Fumble Nation", "FUM", "Grace Kim", "#f97316"),
    ("The Running Backs", "RUN", "Noah Fischer", "#84cc16"),
    ("Pick Six Society", "PSS", "Ava Rossi", "#6366f1"),
    ("Sack Pack", "SAC", "Ethan Cole", "#0ea5e9"),
    ("Two Point Conversions", "TPC", "Mia Alvarez", "#eab308"),
]

FIRST_NAMES = [
    "Jaylen",
    "Marcus",
    "Tyreek",
    "Davante",
    "Cooper",
    "Aaron",
    "Joe",
    "Justin",
    "Ja'Marr",
    "CeeDee",
    "Amon-Ra",
    "Bijan",
    "Breece",
    "Saquon",
    "Travis",
    "George",
    "Tee",
    "Drake",
    "Puka",
    "Rashee",
    "De'Von",
    "Jameson",
    "Tank",
    "Zay",
    "Garrett",
    "Dak",
    "Jalen",
    "Lamar",
    "Josh",
    "Patrick",
    "Tua",
    "Jordan",
]
LAST_NAMES = [
    "Robinson",
    "Hopkins",
    "Hill",
    "Adams",
    "Kupp",
    "Jones",
    "Burrow",
    "Jefferson",
    "Chase",
    "Lamb",
    "St. Brown",
    "Robinson",
    "Hall",
    "Barkley",
    "Kelce",
    "Kittle",
    "Higgins",
    "London",
    "Nacua",
    "Rice",
    "Achane",
    "Williams",
    "Bigby",
    "Flowers",
    "Wilson",
    "Prescott",
    "Hurts",
    "Jackson",
    "Allen",
    "Mahomes",
    "Tagovailoa",
    "Love",
]
NFL_TEAMS = ["KC", "BUF", "CIN", "DET", "PHI", "SF", "DAL", "MIA", "BAL", "MIN", "LAR", "JAX"]

# position -> (count on roster, base weekly points)
ROSTER_TEMPLATE = {
    "QB": (2, 18),
    "RB": (5, 12),
    "WR": (5, 11),
    "TE": (2, 9),
    "K": (1, 8),
    "DEF": (1, 7),
}
FLEX_ELIGIBLE = {"RB", "WR", "TE"}


def _make_players(rng: random.Random, team_idx: int) -> list[dict[str, object]]:
    players = []
    pid = 100000 + team_idx * 100
    for pos, (count, base) in ROSTER_TEMPLATE.items():
        for _ in range(count):
            pid += 1
            name = f"{rng.choice(FIRST_NAMES)} {rng.choice(LAST_NAMES)}"
            players.append(
                {
                    "espn_player_id": pid,
                    "name": name,
                    "position": pos,
                    "nfl_team": rng.choice(NFL_TEAMS),
                    "base": base,
                    "talent": rng.uniform(0.6, 1.45),
                }
            )
    return players


def _weekly_points(rng: random.Random, player: dict, quality: float) -> float:
    mean = player["base"] * player["talent"] * quality
    sd = player["base"] * 0.45
    return round(max(0.0, rng.gauss(mean, sd)), 1)


def _play_week(
    rng: random.Random, players: list[dict], quality: float
) -> tuple[list[RosterPlayer], float]:
    """Generate a week's roster; return (roster, starter_total)."""
    scored = [{**p, "points": _weekly_points(rng, p, quality)} for p in players]
    by_pos: dict[str, list[dict]] = {}
    for p in scored:
        by_pos.setdefault(p["position"], []).append(p)
    for lst in by_pos.values():
        lst.sort(key=lambda x: -x["points"])

    starters: list[dict] = []
    used_ids: set[int] = set()

    def take_best(pos: str, n: int, slot: str) -> None:
        taken = 0
        for p in by_pos.get(pos, []):
            if taken == n:
                break
            if p["espn_player_id"] not in used_ids:
                p["slot"] = slot
                starters.append(p)
                used_ids.add(p["espn_player_id"])
                taken += 1

    take_best("QB", 1, "QB")
    take_best("RB", 2, "RB")
    take_best("WR", 2, "WR")
    take_best("TE", 1, "TE")
    take_best("K", 1, "K")
    take_best("DEF", 1, "DEF")

    # FLEX: best remaining RB/WR/TE
    flex_pool = [
        p
        for pos in FLEX_ELIGIBLE
        for p in by_pos.get(pos, [])
        if p["espn_player_id"] not in used_ids
    ]
    flex_pool.sort(key=lambda x: -x["points"])
    if flex_pool:
        flex_pool[0]["slot"] = "FLEX"
        starters.append(flex_pool[0])
        used_ids.add(flex_pool[0]["espn_player_id"])

    roster: list[RosterPlayer] = []
    total = 0.0
    for p in starters:
        total += p["points"]
        roster.append(
            RosterPlayer(
                p["espn_player_id"], p["name"], p["position"], p["nfl_team"], p["slot"], p["points"]
            )
        )
    for p in scored:
        if p["espn_player_id"] not in used_ids:
            roster.append(
                RosterPlayer(
                    p["espn_player_id"], p["name"], p["position"], p["nfl_team"], "BN", p["points"]
                )
            )
    return roster, round(total, 1)


def _round_robin(team_ids: list[int]) -> list[list[tuple[int, int]]]:
    n = len(team_ids)
    rotating = team_ids[1:]
    fixed = team_ids[0]
    rounds = []
    for _ in range(n - 1):
        current = [fixed] + rotating
        pairs = [(current[i], current[n - 1 - i]) for i in range(n // 2)]
        rounds.append(pairs)
        rotating = [rotating[-1]] + rotating[:-1]
    return rounds


def _week_dates(start: date, week_num: int) -> tuple[str, str]:
    s = start + timedelta(weeks=week_num - 1)
    e = s + timedelta(days=6)
    return s.isoformat(), e.isoformat()


def generate_season(year: int = 2025, league_id: str = "sample", seed: int = 42) -> SeasonData:
    rng = random.Random(seed)
    owners = [
        Owner(
            owner_id=f"sample-owner-{i + 1:02d}",
            display_name=owner,
            first_name=owner.split(" ", 1)[0],
            last_name=owner.split(" ", 1)[1] if " " in owner else None,
        )
        for i, (_name, _abbrev, owner, _color) in enumerate(TEAMS)
    ]
    teams = [
        Team(
            espn_team_id=i + 1,
            name=name,
            abbrev=abbrev,
            owner_name=owner,
            color=color,
            owner_id=owners[i].owner_id,
        )
        for i, (name, abbrev, owner, color) in enumerate(TEAMS)
    ]
    team_ids = [t.espn_team_id for t in teams]
    quality = {tid: rng.uniform(0.82, 1.22) for tid in team_ids}
    rosters_by_team = {tid: _make_players(rng, i) for i, tid in enumerate(team_ids)}

    season_start = date(year, 9, 9)  # a Tuesday
    weeks: list[WeekInfo] = []
    matchups: list[Matchup] = []
    week_rosters: list[WeekRoster] = []

    def play(week_num: int, tid: int) -> float:
        roster, total = _play_week(rng, rosters_by_team[tid], quality[tid])
        week_rosters.append(WeekRoster(week_num, tid, roster))
        return total

    # --- Regular season: 14 weeks ---
    rr = _round_robin(team_ids)  # 11 unique rounds
    schedule = rr + rr[:3]  # 14 weeks (weeks 12-14 are rematches)
    for week_num, pairs in enumerate(schedule, start=1):
        if week_num > 1:
            _churn_rosters(rng, rosters_by_team, team_ids)
        s, e = _week_dates(season_start, week_num)
        weeks.append(WeekInfo(week_num, f"Week {week_num}", s, e, False))
        for home, away in pairs:
            hs = play(week_num, home)
            as_ = play(week_num, away)
            matchups.append(Matchup(week_num, home, away, hs, as_, False))

    # --- Standings -> top 6 make playoffs ---
    wins = {t: 0 for t in team_ids}
    pf = {t: 0.0 for t in team_ids}
    for m in matchups:
        pf[m.home_team_id] += m.home_score
        pf[m.away_team_id] += m.away_score
        if m.home_score > m.away_score:
            wins[m.home_team_id] += 1
        elif m.away_score > m.home_score:
            wins[m.away_team_id] += 1
    all_ranked = sorted(team_ids, key=lambda t: (wins[t], pf[t]), reverse=True)
    standing_map = {t: i + 1 for i, t in enumerate(all_ranked)}
    seeds = all_ranked[:6]
    seed_rank = {t: i + 1 for i, t in enumerate(seeds)}

    # --- Playoffs: weeks 15 (QF), 16 (SF), 17 (Final + 3rd) ---
    def playoff_week(
        week_num: int, label: str, pairs: list[tuple[int, int]], tiers: list[str]
    ) -> dict[int, int]:
        s, e = _week_dates(season_start, week_num)
        weeks.append(WeekInfo(week_num, label, s, e, True))
        winners: dict[int, int] = {}  # game index -> winner
        for i, (a, b) in enumerate(pairs):
            sa = play(week_num, a)
            sb = play(week_num, b)
            if sa == sb:
                # Nudge the last starter's points on team b to break the tie,
                # preserving the invariant: matchup score == sum(starter points).
                wr = week_rosters[-1]
                for p in reversed(wr.players):
                    if p.lineup_slot != "BN":
                        idx = len(wr.players) - 1 - list(reversed(wr.players)).index(p)
                        adjusted = RosterPlayer(
                            p.espn_player_id,
                            p.name,
                            p.position,
                            p.nfl_team,
                            p.lineup_slot,
                            round(p.points - 0.1, 1),
                        )
                        wr.players[idx] = adjusted
                        sb = round(sb - 0.1, 1)
                        break
            winners[i] = a if sa > sb else b
            matchups.append(Matchup(week_num, a, b, round(sa, 1), round(sb, 1), True, tiers[i]))
        return winners

    s3, s4, s5, s6 = seeds[2], seeds[3], seeds[4], seeds[5]
    qf_pairs = [(s3, s6), (s4, s5)]
    qf = playoff_week(15, "Quarterfinals", qf_pairs, ["WINNERS_BRACKET", "WINNERS_BRACKET"])
    qf_winners = [qf[0], qf[1]]
    qf_losers = [b if qf[i] == a else a for i, (a, b) in enumerate(qf_pairs)]
    # Semifinals: #1 vs lowest remaining seed, #2 vs the other
    sf_pairs = [
        (seeds[0], max(qf_winners, key=lambda t: seed_rank[t])),
        (seeds[1], min(qf_winners, key=lambda t: seed_rank[t])),
    ]
    sf = playoff_week(16, "Semifinals", sf_pairs, ["WINNERS_BRACKET", "WINNERS_BRACKET"])
    sf_winners = [sf[0], sf[1]]
    sf_losers = [b if sf[i] == a else a for i, (a, b) in enumerate(sf_pairs)]
    champ_pairs = [(sf_winners[0], sf_winners[1]), (sf_losers[0], sf_losers[1])]
    champ = playoff_week(
        17, "Championship", champ_pairs, ["WINNERS_BRACKET", "WINNERS_CONSOLATION_LADDER"]
    )

    final_standing_map: dict[int, int] = {champ[0]: 1, champ[1]: 3}
    final_standing_map[next(t for t in sf_winners if t != champ[0])] = 2
    final_standing_map[next(t for t in sf_losers if t != champ[1])] = 4
    for i, t in enumerate(qf_losers):
        final_standing_map[t] = 5 + i
    rest = [t for t in all_ranked if t not in final_standing_map]
    for i, t in enumerate(rest):
        final_standing_map[t] = 7 + i

    teams = [
        replace(
            t,
            standing=standing_map[t.espn_team_id],
            final_standing=final_standing_map[t.espn_team_id],
        )
        for t in teams
    ]

    # --- Transactions ---
    transactions = _make_transactions(rng, team_ids, rosters_by_team, season_start)

    return SeasonData(
        year=year,
        league_id=league_id,
        settings={
            "scoring": "PPR",
            "playoff_teams": 6,
            "roster": "sample",
            "playoff": {
                "team_count": 6,
                "regular_season_weeks": 14,
                "start_week": 15,
                "rounds": 3,
                "reseeding": False,
                "seeding_rule": "TOTAL_POINTS_SCORED",
                "round_length_weeks": 1,
                "consolation_ladder": True,
                "divisions": ["League Standings"],
            },
        },
        teams=teams,
        owners=owners,
        weeks=weeks,
        matchups=matchups,
        rosters=week_rosters,
        transactions=transactions,
    )


def _churn_rosters(
    rng: random.Random,
    rosters_by_team: dict[int, list[dict]],
    team_ids: list[int],
) -> None:
    """Mutate team pools in place so consecutive weeks differ.

    Produces realistic waiver/trade activity for the derived transaction history:
    a same-position swap between two teams reads as a trade, removing a player as a
    drop, and adding a fresh free agent as an add.
    """
    if rng.random() < 0.7:
        a, b = rng.sample(team_ids, 2)
        pos = rng.choice(["RB", "WR", "TE"])
        pool_a = [p for p in rosters_by_team[a] if p["position"] == pos]
        pool_b = [p for p in rosters_by_team[b] if p["position"] == pos]
        if pool_a and pool_b:
            pa, pb = rng.choice(pool_a), rng.choice(pool_b)
            rosters_by_team[a].remove(pa)
            rosters_by_team[b].remove(pb)
            rosters_by_team[a].append(pb)
            rosters_by_team[b].append(pa)
    if rng.random() < 0.35:
        tid = rng.choice(team_ids)
        droppable = [p for p in rosters_by_team[tid] if p["position"] in ("RB", "WR", "TE")]
        if len(droppable) > 3:
            rosters_by_team[tid].remove(rng.choice(droppable))
    if rng.random() < 0.35:
        tid = rng.choice(team_ids)
        pos = rng.choice(["RB", "WR", "TE"])
        rosters_by_team[tid].append(
            {
                "espn_player_id": rng.randint(900000, 999999),
                "name": f"{rng.choice(FIRST_NAMES)} {rng.choice(LAST_NAMES)}",
                "position": pos,
                "nfl_team": rng.choice(NFL_TEAMS),
                "base": {"RB": 12, "WR": 11, "TE": 9}[pos],
                "talent": rng.uniform(0.6, 1.45),
            }
        )


def _make_transactions(
    rng: random.Random,
    team_ids: list[int],
    rosters_by_team: dict[int, list[dict]],
    season_start: date,
) -> list[Transaction]:
    txs: list[Transaction] = []
    for week_num in range(2, 14):
        for _ in range(rng.randint(2, 5)):
            tid = rng.choice(team_ids)
            player = rng.choice(rosters_by_team[tid])
            ttype = rng.choice(["ADD", "DROP", "ADD", "DROP"])
            day = season_start + timedelta(weeks=week_num - 1, days=rng.randint(0, 5))
            txs.append(
                Transaction(
                    team_id=tid,
                    espn_player_id=player["espn_player_id"],
                    player_name=player["name"],
                    type=ttype,
                    bid_amount=rng.choice([0, 0, 5, 12, 25, 40]) if ttype == "ADD" else None,
                    occurred_at=day.isoformat(),
                )
            )
    return txs


def sample_token_plaintext(alias_num: int) -> str:
    """Deterministic dev token plaintext for a synthetic owner."""
    return f"sample-token-{alias_num:02d}"


def store_sample_tokens(conn: sqlite3.Connection, verbose: bool = False) -> None:
    """Insert deterministic dev tokens for every aliased owner (idempotent)."""
    from .tokens import hash_token

    created = datetime.now(UTC).isoformat()
    owners = conn.execute(
        "SELECT id, alias_num FROM owners WHERE alias_num IS NOT NULL ORDER BY alias_num"
    ).fetchall()
    for o in owners:
        plaintext = sample_token_plaintext(o["alias_num"])
        conn.execute(
            "INSERT INTO owner_tokens (owner_id, token_hash, label, created_at, revoked_at) "
            "VALUES (?, ?, ?, ?, NULL) ON CONFLICT(token_hash) DO NOTHING",
            (o["id"], hash_token(plaintext), "sample", created),
        )
        if verbose:
            print(f"sample token owner={o['id']} alias={o['alias_num']}: {plaintext}")
    conn.commit()


def store_sample_schedule(conn: sqlite3.Connection, season_id: int, season: SeasonData) -> None:
    """Insert scheduled_matchups for the regular season with fallback kickoffs."""
    from .lock import first_kickoff_utc

    mapping = {
        r["espn_team_id"]: r["id"]
        for r in conn.execute(
            "SELECT id, espn_team_id FROM teams WHERE season_id = ?", (season_id,)
        ).fetchall()
    }
    for m in season.matchups:
        if m.is_playoff:
            continue
        conn.execute(
            "INSERT OR IGNORE INTO scheduled_matchups "
            "(season_id, week_num, home_team_id, away_team_id, kickoff) "
            "VALUES (?, ?, ?, ?, ?)",
            (
                season_id,
                m.week_num,
                mapping[m.home_team_id],
                mapping[m.away_team_id],
                first_kickoff_utc(m.week_num, season.year),
            ),
        )
    conn.commit()
