import json
from pathlib import Path

DATA_DIR = Path(__file__).parent.parent / "data" / "processed"


def _load(filename):
    with open(DATA_DIR / filename, encoding="utf-8") as f:
        return json.load(f)


def get_matches():
    return _load("fixtures.json")


def get_h2h(team_a: str, team_b: str):
    history = _load("matches_history.json")
    a, b = team_a.lower(), team_b.lower()
    results = []
    for m in history:
        home = (m.get("home_team_name") or "").lower()
        away = (m.get("away_team_name") or "").lower()
        if (a in home or a in away) and (b in home or b in away):
            results.append({
                "year": (m.get("match_date") or "")[:4],
                "stage": m.get("stage_name") or m.get("group_name", ""),
                "score_a": m.get("home_team_score") if a in home else m.get("away_team_score"),
                "score_b": m.get("away_team_score") if a in home else m.get("home_team_score"),
                "tournament": m.get("tournament_name", ""),
            })
    return results
