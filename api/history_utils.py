"""Shared helpers for men's World Cup historical match data."""

from __future__ import annotations

from pathlib import Path

DATA_DIR = Path(__file__).parent.parent / "data" / "processed"

# Historical names in datahub.io CSV → canonical names in master_teams.json
HISTORY_TO_CANONICAL: dict[str, str] = {
    "West Germany": "Germany",
    "Czech Republic": "Czechia",
    "Zaire": "DR Congo",
    "Korea Republic": "South Korea",
    "Côte d'Ivoire": "Ivory Coast",
    "Congo DR": "DR Congo",
    "Cape Verde Islands": "Cape Verde",
    "Bosnia & Herzegovina": "Bosnia and Herzegovina",
}

# Lowercase stage_name → numeric rank (higher = deeper run)
STAGE_RANK: dict[str, int] = {
    "group stage": 1,
    "second group stage": 1,
    "final round": 2,  # 1950 final group
    "round of 16": 3,
    "round of 32": 3,
    "quarter-final": 4,
    "quarter-finals": 4,
    "semi-final": 5,
    "semi-finals": 5,
    "third place": 5,
    "third-place play-off": 5,
    "third-place match": 5,
    "final": 6,
    "finals": 6,
}

RANK_TO_LABEL: dict[int, str] = {
    0: "No appearance",
    1: "Groups",
    2: "Final Round",
    3: "R16",
    4: "QF",
    5: "SF",
    6: "Final",
    7: "Winner",
}

STAGE_ORDER: list[str] = [
    "No appearance",
    "Groups",
    "Final Round",
    "R16",
    "QF",
    "SF",
    "Final",
    "Winner",
]

STAGE_COLORS: dict[str, str] = {
    "No appearance": "#EDEAE4",
    "Groups": "#E8F0EB",
    "Final Round": "#C5E8D5",
    "R16": "#A8D5BC",
    "QF": "#5EC98A",
    "SF": "#1E8A4A",
    "Final": "#0D5C2E",
    "Winner": "#D4A017",
}


def normalize_team_name(name: str | None) -> str:
    """Map a historical team name to the canonical 2026 roster name."""
    if not name:
        return ""
    return HISTORY_TO_CANONICAL.get(name, name)


def is_mens_world_cup_match(match: dict) -> bool:
    """Return True for men's World Cup final-tournament matches."""
    return "Women" not in (match.get("tournament_name") or "")


def stage_rank(stage_name: str | None) -> int:
    """Return the numeric rank for a stage_name, or raise if unmapped."""
    key = (stage_name or "").lower().strip()
    if key not in STAGE_RANK:
        raise KeyError(f"Unmapped men's World Cup stage_name: {stage_name!r}")
    return STAGE_RANK[key]


def iter_mens_matches(history: list[dict]):
    """Yield men's World Cup matches with year >= 1930."""
    for match in history:
        if not is_mens_world_cup_match(match):
            continue
        year = int((match.get("match_date") or "0")[:4])
        if year < 1930:
            continue
        yield match, year


def collect_unmapped_stages(history: list[dict]) -> set[str]:
    """Return stage_name values present in men's data but absent from STAGE_RANK."""
    unmapped: set[str] = set()
    for match, _year in iter_mens_matches(history):
        key = (match.get("stage_name") or "").lower().strip()
        if key and key not in STAGE_RANK:
            unmapped.add(match.get("stage_name") or "")
    return unmapped
