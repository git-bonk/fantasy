"""Generate TypeScript raw-table interfaces from the SQLite SCHEMA.

Single source of truth is `db/schema.py::SCHEMA`; this emits a mirrored
`web/src/lib/schema.generated.ts` so the web row types cannot silently drift
from the pipeline schema. A pytest drift check enforces they stay in sync.
"""

from __future__ import annotations

import re
from pathlib import Path

from .db.schema import SCHEMA

_TABLE_HEAD = re.compile(r"CREATE TABLE IF NOT EXISTS (\w+)\s*\(")
_CONSTRAINT_KEYWORDS = {"UNIQUE", "PRIMARY", "FOREIGN", "CHECK", "CONSTRAINT"}
_HEADER = (
    "// Auto-generated from pipeline/fantasynfl/db/schema.py (SCHEMA). Do not edit by hand.\n"
    "// Regenerate: python -m fantasynfl.typegen\n"
)


def _ts_type(sql_type: str) -> str:
    t = sql_type.upper()
    if "INT" in t:
        return "number"
    if any(key in t for key in ("REAL", "FLOA", "DOUB", "NUM", "DEC")):
        return "number"
    return "string"


def _pascal(table: str) -> str:
    return "".join(part.capitalize() for part in table.split("_"))


def _iter_tables(schema: str):
    for match in _TABLE_HEAD.finditer(schema):
        start = match.end()
        depth = 1
        i = start
        while i < len(schema) and depth > 0:
            if schema[i] == "(":
                depth += 1
            elif schema[i] == ")":
                depth -= 1
            i += 1
        yield match.group(1), schema[start : i - 1]


def _split_columns(body: str) -> list[str]:
    parts: list[str] = []
    current: list[str] = []
    depth = 0
    for ch in body:
        if ch == "(":
            depth += 1
        elif ch == ")":
            depth -= 1
        if ch == "," and depth == 0:
            parts.append("".join(current).strip())
            current = []
        else:
            current.append(ch)
    tail = "".join(current).strip()
    if tail:
        parts.append(tail)
    return parts


def generate_ts_types(schema: str = SCHEMA) -> str:
    lines: list[str] = [_HEADER]
    for table, body in _iter_tables(schema):
        lines.append(f"export interface {_pascal(table)} {{")
        for col in _split_columns(body):
            tokens = col.split()
            if not tokens:
                continue
            head = tokens[0].split("(", 1)[0].upper()
            if head in _CONSTRAINT_KEYWORDS:
                continue
            name = tokens[0]
            sql_type = tokens[1] if len(tokens) > 1 else "TEXT"
            upper = col.upper()
            nullable = "NOT NULL" not in upper and "PRIMARY KEY" not in upper
            ts_type = _ts_type(sql_type) + (" | null" if nullable else "")
            lines.append(f"  {name}: {ts_type};")
        lines.append("}")
        lines.append("")
    return "\n".join(lines).rstrip("\n") + "\n"


def main() -> None:
    out = (
        Path(__file__).resolve().parent.parent.parent
        / "web"
        / "src"
        / "lib"
        / "schema.generated.ts"
    )
    out.write_text(generate_ts_types(), encoding="utf-8")
    print(f"wrote {out}")


if __name__ == "__main__":
    main()
