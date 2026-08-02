"""Week lock deadlines: the fallback first-kickoff rule and the is_locked gate."""

from __future__ import annotations

import sqlite3
from datetime import UTC, date, datetime, timedelta


def _nth_weekday(year: int, month: int, weekday: int, n: int) -> date:
    """Return the n-th ``weekday`` (Monday=0 .. Sunday=6) of a month."""
    first = date(year, month, 1)
    offset = (weekday - first.weekday()) % 7
    return first + timedelta(days=offset + 7 * (n - 1))


def _et_offset_hours(day: date) -> int:
    """US Eastern UTC offset for a date: -4 (EDT) mid-March..early-Nov, else -5 (EST)."""
    dst_start = _nth_weekday(day.year, 3, 6, 2)
    dst_end = _nth_weekday(day.year, 11, 6, 1)
    return -4 if dst_start <= day < dst_end else -5


def first_kickoff_utc(week_num: int, year: int | None = None) -> str:
    """Return an ISO-8601 UTC string for the first NFL kickoff of an NFL week.

    Static v1 assumption (documented, deterministic, no network):
      - Week 1 opens on the Thursday after US Labor Day, i.e. the first Monday of
        September plus three days (matches the 2024/2025 NFL openers).
      - Each later week is exactly 7 days after week 1.
      - Kickoff time is Thursday 8:15pm US Eastern, converted to UTC using a fixed
        DST rule (EDT, UTC-4, from the 2nd Sunday of March to the 1st Sunday of
        November; otherwise EST, UTC-5). This avoids a tz-database dependency.
    """
    if year is None:
        year = datetime.now(UTC).year
    labor_day = _nth_weekday(year, 9, 0, 1)
    week1_thursday = labor_day + timedelta(days=3)
    kickoff_day = week1_thursday + timedelta(weeks=week_num - 1)
    local = datetime(kickoff_day.year, kickoff_day.month, kickoff_day.day, 20, 15)
    utc = local - timedelta(hours=_et_offset_hours(kickoff_day))
    return utc.replace(tzinfo=UTC).isoformat()


def _parse_iso(value: str) -> datetime:
    dt = datetime.fromisoformat(value)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=UTC)
    return dt


def is_locked(conn: sqlite3.Connection, season_id: int, week_num: int, now: datetime) -> bool:
    """Return True when picks for a week are locked.

    Locked when the week is finalized; otherwise locked when ``now`` is at or past
    the earliest scheduled kickoff for that (season, week). Fails CLOSED: if there
    is no kickoff data, the week is treated as locked rather than left open.
    """
    row = conn.execute(
        "SELECT finalized FROM weeks WHERE season_id = ? AND week_num = ?",
        (season_id, week_num),
    ).fetchone()
    if row is not None and row["finalized"]:
        return True
    kickoff = conn.execute(
        "SELECT MIN(kickoff) AS k FROM scheduled_matchups WHERE season_id = ? AND week_num = ?",
        (season_id, week_num),
    ).fetchone()["k"]
    if not kickoff:
        return True
    if now.tzinfo is None:
        now = now.replace(tzinfo=UTC)
    return now >= _parse_iso(kickoff)
