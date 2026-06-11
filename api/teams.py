import json


def _load(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def get_all_teams():
    return _load("data/processed/master_teams.json")


def get_squad(country: str):
    squads = _load("data/processed/master_squads.json")
    for team in squads:
        if team["country"].lower() == country.lower():
            return team["players"]
    return []


def get_standings():
    return _load("data/processed/groups.json")
