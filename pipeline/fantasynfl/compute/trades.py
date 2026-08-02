"""Trade analyzer: reconstruct trades from derived transactions and grade them.

The derived rows produced by ``transactions.py`` already pair each player move:
for a given ``(week_num, espn_player_id)`` the ``TRADE_IN`` team received the
player and the ``TRADE_OUT`` team sent it. Grouping those player moves by
``(week_num, frozenset({sender, receiver}))`` collapses multi-player deals between
the same pair in the same week into a single trade row. ``team_a_id`` is the lower
of the two ids so the UNIQUE(season_id, week_num, team_a_id, team_b_id) key is
stable regardless of who initiated.

Each side is graded by the points its *received* players produced over the next
``moves.EVAL_WEEKS`` regular-season weeks (``moves.points_after`` with a receiving-
team filter). A trade is ``finalized`` only when the full window exists in the
schedule — ``weeks_evaluated`` counts the regular-season weeks present in
``(w, w + EVAL_WEEKS]`` — and only finalized, untied trades get a ``winner_side``.

Data sources: ``transactions`` (source='derived'), ``rosters`` + ``weeks`` (via
``loaders.load_rosters``), graded through the shared ``moves`` seam.
"""

from __future__ import annotations

import json
import sqlite3
from collections import defaultdict
from collections.abc import Mapping
from dataclasses import asdict, dataclass

from . import moves
from .loaders import load_rosters
from .types import RosterRow

PairKey = tuple[int, frozenset[int]]
PlayerMove = tuple[int, str, int]  # (espn_player_id, player_name, receiver_id)


@dataclass(frozen=True)
class TradeRow:
    """One graded trade between two teams in one week (team_a_id < team_b_id)."""

    season_id: int
    week_num: int
    team_a_id: int
    team_b_id: int
    a_players_json: str
    b_players_json: str
    a_points: float
    b_points: float
    winner_side: str | None
    weeks_evaluated: int
    finalized: bool


@dataclass(frozen=True)
class _ReceivedPlayer:
    pid: int
    name: str
    position: str


def _season_weeks(conn: sqlite3.Connection, season_id: int) -> tuple[set[int], set[int]]:
    """Return (regular_season_weeks, playoff_weeks) for the season."""
    rows = conn.execute(
        "SELECT week_num, is_playoff FROM weeks WHERE season_id = ?", (season_id,)
    ).fetchall()
    regular = {r["week_num"] for r in rows if not r["is_playoff"]}
    playoff = {r["week_num"] for r in rows if r["is_playoff"]}
    return regular, playoff


def _group_player_moves(
    conn: sqlite3.Connection, season_id: int
) -> dict[PairKey, list[PlayerMove]]:
    """Group derived TRADE_IN/OUT rows into per-pair lists of (pid, name, receiver_id).

    Each player's IN/OUT rows for the same week are zipped (mirroring the pairing
    in ``transactions.py``): the IN team received the player, the OUT team sent it.
    """
    rows = conn.execute(
        "SELECT week_num, team_id, espn_player_id, player_name, type FROM transactions "
        "WHERE season_id = ? AND source = 'derived' AND type IN ('TRADE_IN', 'TRADE_OUT') "
        "ORDER BY week_num, espn_player_id, id",
        (season_id,),
    ).fetchall()

    inbound: dict[tuple[int, int], list[tuple[int, str]]] = defaultdict(list)
    outbound: dict[tuple[int, int], list[int]] = defaultdict(list)
    for r in rows:
        key = (r["week_num"], r["espn_player_id"])
        if r["type"] == "TRADE_IN":
            inbound[key].append((r["team_id"], r["player_name"]))
        else:
            outbound[key].append(r["team_id"])

    grouped: dict[PairKey, list[PlayerMove]] = defaultdict(list)
    for key in sorted(set(inbound) | set(outbound)):
        senders = outbound.get(key, [])
        for (receiver_id, name), sender_id in zip(inbound.get(key, []), senders, strict=False):
            if sender_id == receiver_id:
                continue  # degenerate pair, not a trade between two teams
            week_num, pid = key
            grouped[(week_num, frozenset((sender_id, receiver_id)))].append(
                (pid, name, receiver_id)
            )
    return grouped


def _position_of(
    position_at: Mapping[tuple[int, int, int], str],
    by_player: Mapping[int, list[RosterRow]],
    week_num: int,
    receiver_id: int,
    pid: int,
) -> str:
    """Position on the receiving roster at trade week, else the player's in any week."""
    position = position_at.get((week_num, receiver_id, pid))
    if position is not None:
        return position
    rows = by_player.get(pid, [])
    return rows[0].position if rows else ""


def _players_json(received: list[_ReceivedPlayer]) -> str:
    return json.dumps([asdict(p) for p in sorted(received, key=lambda p: p.pid)])


def _side_points(
    received: list[_ReceivedPlayer],
    by_player: Mapping[int, list[RosterRow]],
    receiver_id: int,
    week_num: int,
) -> float:
    """Points the received players produced while on the receiving team after the trade."""
    return sum(
        moves.points_after(by_player.get(p.pid, []), p.pid, week_num, moves.team_only(receiver_id))
        for p in received
    )


def compute_trades(conn: sqlite3.Connection, season_id: int) -> list[TradeRow]:
    """Reconstruct and grade every trade for a season from derived transactions."""
    regular_weeks, playoff_weeks = _season_weeks(conn, season_id)
    rosters = moves.without_playoff_weeks(load_rosters(conn, season_id), playoff_weeks)
    by_player = moves.index_by_player(rosters)
    position_at = {(r.week_num, r.team_id, r.espn_player_id): r.position for r in rosters}

    rows: list[TradeRow] = []
    for (week_num, pair), player_moves in _group_player_moves(conn, season_id).items():
        team_a_id, team_b_id = sorted(pair)
        a_players = [
            _ReceivedPlayer(
                pid, name, _position_of(position_at, by_player, week_num, team_a_id, pid)
            )
            for pid, name, receiver_id in player_moves
            if receiver_id == team_a_id
        ]
        b_players = [
            _ReceivedPlayer(
                pid, name, _position_of(position_at, by_player, week_num, team_b_id, pid)
            )
            for pid, name, receiver_id in player_moves
            if receiver_id == team_b_id
        ]

        a_points = _side_points(a_players, by_player, team_a_id, week_num)
        b_points = _side_points(b_players, by_player, team_b_id, week_num)

        # Window weeks that actually exist as regular-season weeks (capped at EVAL_WEEKS
        # by construction: the range holds exactly EVAL_WEEKS candidates).
        weeks_evaluated = sum(
            1 for w in range(week_num + 1, week_num + moves.EVAL_WEEKS + 1) if w in regular_weeks
        )
        finalized = weeks_evaluated == moves.EVAL_WEEKS
        winner_side: str | None = None
        if finalized and a_points != b_points:
            winner_side = "A" if a_points > b_points else "B"

        rows.append(
            TradeRow(
                season_id,
                week_num,
                team_a_id,
                team_b_id,
                _players_json(a_players),
                _players_json(b_players),
                a_points,
                b_points,
                winner_side,
                weeks_evaluated,
                finalized,
            )
        )

    rows.sort(key=lambda r: (r.week_num, r.team_a_id, r.team_b_id))
    return rows


def store_trades(conn: sqlite3.Connection, season_id: int, rows: list[TradeRow]) -> None:
    """Persist graded trades; INSERT OR REPLACE on the (season, week, A, B) unique key."""
    conn.executemany(
        "INSERT OR REPLACE INTO trades (season_id, week_num, team_a_id, team_b_id, "
        "a_players_json, b_players_json, a_points, b_points, winner_side, weeks_evaluated, "
        "finalized) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
            (
                r.season_id,
                r.week_num,
                r.team_a_id,
                r.team_b_id,
                r.a_players_json,
                r.b_players_json,
                r.a_points,
                r.b_points,
                r.winner_side,
                r.weeks_evaluated,
                int(r.finalized),
            )
            for r in rows
        ],
    )
