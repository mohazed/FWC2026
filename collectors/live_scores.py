import json
import re
import requests
from pathlib import Path
from collections import defaultdict

BASE_DIR = Path(__file__).parent.parent
FIXTURES_PATH = BASE_DIR / "data/processed/fixtures.json"
GROUPS_PATH   = BASE_DIR / "data/processed/groups.json"
SCORERS_PATH  = BASE_DIR / "data/processed/scorers.json"
API_URL       = "https://worldcup26.ir/get/games"

# worldcup26.ir names → our fixtures.json canonical names
NAME_MAP = {
    "United States":                    "USA",
    "Democratic Republic of the Congo": "DR Congo",
    "Bosnia and Herzegovina":           "Bosnia & Herzegovina",
}

def _norm(name: str) -> str:
    return NAME_MAP.get(name, name)


def sync_live_scores() -> dict:
    """Pull finished scores from worldcup26.ir and rewrite fixtures + groups JSON."""
    try:
        resp = requests.get(API_URL, timeout=15)
        resp.raise_for_status()
        api_games = resp.json().get("games", [])
    except Exception as e:
        return {"error": str(e), "synced": 0, "matches_played": 0}

    # Build lookup: (home_norm, away_norm) → {finished, score_h, score_a}
    api_lookup: dict = {}
    for g in api_games:
        home = g.get("home_team_name_en")
        away = g.get("away_team_name_en")
        if not home or not away:
            continue
        finished = g.get("finished", "FALSE") == "TRUE"
        api_lookup[(_norm(home), _norm(away))] = {
            "finished": finished,
            "score_h":  int(g["home_score"]) if finished else None,
            "score_a":  int(g["away_score"]) if finished else None,
        }

    with open(FIXTURES_PATH) as f:
        fixtures = json.load(f)

    synced = 0
    for match in fixtures:
        key = (match["home"], match["away"])
        live = api_lookup.get(key)
        if live and live["finished"]:
            if not match.get("played") or match["score_h"] != live["score_h"]:
                match["score_h"] = live["score_h"]
                match["score_a"] = live["score_a"]
                match["played"]  = True
                synced += 1

    with open(FIXTURES_PATH, "w") as f:
        json.dump(fixtures, f, indent=2)

    groups = _compute_standings(fixtures)
    with open(GROUPS_PATH, "w") as f:
        json.dump(groups, f, indent=2)

    scorers = _parse_scorers(api_games)
    with open(SCORERS_PATH, "w") as f:
        json.dump(scorers, f, indent=2)

    played_total = sum(1 for m in fixtures if m.get("played"))
    return {"synced": synced, "matches_played": played_total}


def _parse_scorer_string(raw: str, team: str) -> list:
    """Parse worldcup26.ir scorer string into records. Handles both ASCII and typographic quotes."""
    if not raw or raw.strip() in ("null", "{}", ""):
        return []
    # Normalize typographic/curly quotes to ASCII before matching
    normalized = raw.replace('“', '"').replace('”', '"').replace('‘', "'").replace('’', "'")
    entries = re.findall(r'"([^"]+)"', normalized)
    result = []
    for entry in entries:
        entry = entry.strip()
        if not entry:
            continue
        # Split off trailing minute(s): everything before last digit+'
        m = re.match(r'^(.+?)\s+(\d[\d\s,+]*\'?\s*)$', entry)
        player = m.group(1).strip() if m else entry
        result.append({"player": player, "team": team})
    return result


def _parse_scorers(api_games: list) -> list:
    tally: dict = {}  # player+team → goals count
    for g in api_games:
        if g.get("finished", "FALSE") != "TRUE":
            continue
        home = _norm(g.get("home_team_name_en", ""))
        away = _norm(g.get("away_team_name_en", ""))
        for scorer in _parse_scorer_string(g.get("home_scorers", ""), home):
            key = (scorer["player"], scorer["team"])
            tally[key] = tally.get(key, 0) + 1
        for scorer in _parse_scorer_string(g.get("away_scorers", ""), away):
            key = (scorer["player"], scorer["team"])
            tally[key] = tally.get(key, 0) + 1

    rows = [
        {"player": k[0], "team": k[1], "goals": v}
        for k, v in tally.items()
    ]
    rows.sort(key=lambda r: -r["goals"])
    return rows


def _compute_standings(fixtures: list) -> list:
    group_teams: dict = defaultdict(set)
    records: dict = defaultdict(lambda: {
        "pts": 0, "gd": 0, "gf": 0, "ga": 0, "w": 0, "d": 0, "l": 0
    })

    for m in fixtures:
        if m.get("stage") != "group" or not m.get("group"):
            continue
        g = m["group"]
        group_teams[g].add(m["home"])
        group_teams[g].add(m["away"])

        if not m.get("played"):
            continue

        sh, sa = m["score_h"], m["score_a"]
        kh, ka = (g, m["home"]), (g, m["away"])

        records[kh]["gf"] += sh;  records[kh]["ga"] += sa;  records[kh]["gd"] += sh - sa
        records[ka]["gf"] += sa;  records[ka]["ga"] += sh;  records[ka]["gd"] += sa - sh

        if sh > sa:
            records[kh]["pts"] += 3; records[kh]["w"] += 1; records[ka]["l"] += 1
        elif sh < sa:
            records[ka]["pts"] += 3; records[ka]["w"] += 1; records[kh]["l"] += 1
        else:
            records[kh]["pts"] += 1; records[kh]["d"] += 1
            records[ka]["pts"] += 1; records[ka]["d"] += 1

    groups = []
    for g in sorted(group_teams.keys()):
        team_list = []
        for team in group_teams[g]:
            r = dict(records[(g, team)])
            r["name"]   = team
            r["form"]   = ""
            r["status"] = ""
            team_list.append(r)
        team_list.sort(key=lambda x: (-x["pts"], -x["gd"], -x["gf"]))
        groups.append({"group": g, "teams": team_list})

    return groups


if __name__ == "__main__":
    result = sync_live_scores()
    print(result)
