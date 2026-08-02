from pathlib import Path

from fantasynfl.db.schema import SCHEMA
from fantasynfl.typegen import generate_ts_types

GENERATED = (
    Path(__file__).resolve().parent.parent.parent / "web" / "src" / "lib" / "schema.generated.ts"
)


def test_generated_types_exist():
    assert GENERATED.exists(), "schema.generated.ts missing; run `python -m fantasynfl.typegen`"


def test_generated_types_in_sync_with_schema():
    actual = GENERATED.read_text(encoding="utf-8")
    expected = generate_ts_types(SCHEMA)
    assert actual == expected, (
        "web/src/lib/schema.generated.ts is out of date; run `python -m fantasynfl.typegen`"
    )


def test_generator_covers_all_tables():
    out = generate_ts_types(SCHEMA)
    for table in (
        "Seasons",
        "Owners",
        "Teams",
        "Weeks",
        "Matchups",
        "Rosters",
        "Transactions",
        "EloRatings",
        "OwnerElo",
        "Luck",
        "Awards",
        "Sos",
        "PlayoffSnapshots",
        "Records",
    ):
        assert f"export interface {table} {{" in out


def test_generator_skips_table_constraints():
    out = generate_ts_types(SCHEMA)
    assert "UNIQUE(" not in out
