import json
from pathlib import Path

from api.history_utils import (
    HISTORY_TO_CANONICAL,
    is_mens_world_cup_match,
    normalize_team_name,
)

DATA_DIR = Path(__file__).parent.parent / "data" / "processed"


def _load(filename):
    with open(DATA_DIR / filename, encoding="utf-8") as f:
        return json.load(f)


def get_matches():
    return _load("fixtures.json")


def _canonical_lookup() -> dict[str, str]:
    """Lowercase canonical name -> canonical name for exact H2H matching."""
    teams = _load("master_teams.json")
    lookup = {t["name"].lower(): t["name"] for t in teams}
    for hist, canon in HISTORY_TO_CANONICAL.items():
        lookup[hist.lower()] = canon
    return lookup


def get_h2h(team_a: str, team_b: str):
    history = _load("matches_history.json")
    lookup = _canonical_lookup()
    canon_a = lookup.get(team_a.lower(), team_a)
    canon_b = lookup.get(team_b.lower(), team_b)
    results = []

    for m in history:
        if not is_mens_world_cup_match(m):
            continue

        home = normalize_team_name(m.get("home_team_name"))
        away = normalize_team_name(m.get("away_team_name"))
        pair = {home, away}
        if canon_a not in pair or canon_b not in pair:
            continue

        score_a = m.get("home_team_score") if home == canon_a else m.get("away_team_score")
        score_b = m.get("away_team_score") if home == canon_a else m.get("home_team_score")
        results.append({
            "year": (m.get("match_date") or "")[:4],
            "stage": m.get("stage_name") or m.get("group_name", ""),
            "score_a": score_a,
            "score_b": score_b,
            "tournament": m.get("tournament_name", ""),
        })

    return results
