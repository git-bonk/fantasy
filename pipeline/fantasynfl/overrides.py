"""Owner name overrides: replaces default ESPN display names with real ones.

The repo-root ``overrides.json`` maps ESPN owner IDs to preferred display names.
Overrides are only applied when the ESPN-provided name looks like a default
(e.g. ``espnfan12345``, ``ESPN12345``). Owners with real names are never touched.
"""

from __future__ import annotations

import json
import logging
import os
import re
from pathlib import Path

from .config import REPO_ROOT

log = logging.getLogger("fantasynfl.overrides")

_DEFAULT_NAME_RE = re.compile(r"^espn(fan)?\d*$", re.IGNORECASE)

_overrides: dict[str, str] | None = None


def _overrides_path() -> Path:
    raw = os.getenv("OVERRIDES_PATH", "").strip()
    if raw:
        return Path(raw)
    return REPO_ROOT / "overrides.json"


def _load() -> dict[str, str]:
    global _overrides
    if _overrides is None:
        path = _overrides_path()
        if path.exists():
            try:
                _overrides = json.loads(path.read_text(encoding="utf-8"))
            except (json.JSONDecodeError, OSError) as exc:
                log.warning("Could not load %s: %s", path, exc)
                _overrides = {}
        else:
            _overrides = {}
        if _overrides:
            log.info("Loaded %d owner name override from %s", len(_overrides), path)
    return _overrides


def is_default_name(display_name: str) -> bool:
    return bool(_DEFAULT_NAME_RE.match(display_name.strip()))


def apply_override(owner_id: str, display_name: str) -> str:
    if not is_default_name(display_name):
        return display_name
    override = _load().get(owner_id)
    if override:
        return override
    return display_name
