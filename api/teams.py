import json
from functools import lru_cache
from pathlib import Path

from api.names import resolve_team_name

DATA_DIR = Path(__file__).parent.parent / "data" / "processed"


@lru_cache(maxsize=None)
def _load(filename):
    with open(DATA_DIR / filename, encoding="utf-8") as f:
        return json.load(f)


def get_all_teams():
    return _load("master_teams.json")


def get_squad(country: str):
    squads = _load("master_squads.json")
    target = resolve_team_name(country).lower()
    for team in squads:
        if resolve_team_name(team["country"]).lower() == target:
            return team["players"]
    return []


def get_standings():
    return _load("groups.json")
