import json
from pathlib import Path

DATA_DIR = Path(__file__).parent.parent / "data" / "processed"


def _load(filename):
    with open(DATA_DIR / filename, encoding="utf-8") as f:
        return json.load(f)


def get_all_teams():
    return _load("master_teams.json")


def get_squad(country: str):
    squads = _load("master_squads.json")
    for team in squads:
        if team["country"].lower() == country.lower():
            return team["players"]
    return []


def get_standings():
    return _load("groups.json")
