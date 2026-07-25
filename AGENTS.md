# AGENTS.md — fantasynfl

A beautiful, data-rich dashboard for a personal 12-team ESPN fantasy football league.

## Structure

Two toolchains under one repo:

```
fantasynfl/
├── pipeline/    # Python 3 — scrapes ESPN (espn_api) + computes stats -> SQLite
├── web/         # Next.js 15 — reads SQLite, renders a dark dashboard
├── data/        # generated SQLite DB (gitignored)
├── PLAN.md      # full architecture + design notes
└── .env.example # ESPN creds + config (copy to .env, never commit)
```

## Commands

### Pipeline (Python)
| Task | Command |
|------|---------|
| Setup | `cd pipeline && python3 -m venv .venv && . .venv/bin/activate && pip install -e ".[dev]"` |
| Generate sample DB | `python -m fantasynfl sample` |
| Ingest real ESPN | `python -m fantasynfl ingest` (needs `.env` creds) |
| Recompute stats | `python -m fantasynfl compute` |
| Test | `cd pipeline && pytest` |
| Lint/format | `cd pipeline && ruff check . && ruff format .` |

### Web (Node)
| Task | Command |
|------|---------|
| Install | `cd web && pnpm install` |
| Dev | `cd web && pnpm dev` |
| Build | `cd web && pnpm build` |
| Lint | `cd web && pnpm lint` |

The web app reads `data/fantasynfl.db` — run the pipeline `sample` (or `ingest`) first.

## Conventions

- **Python**: type hints everywhere, `ruff` for lint/format, `pytest` for tests (tests in `pipeline/tests/`).
- **TypeScript**: strict, no `any`, named exports only, `const` by default, early returns.
- No secrets in code; ESPN creds via `.env` (gitignored).
- The web app reads the DB **only in server components / `lib/`** — never in client components.
- The pipeline and web communicate **only through the SQLite schema** (defined in `pipeline/fantasynfl/db.py`, mirrored in `web/src/lib/types.ts`). Keep them in sync.

## Data invariant

A team's matchup score must equal the sum of its **starter** roster points for that week.
The sample generator enforces this; the ESPN ingest maps ESPN's lineup slots accordingly.
