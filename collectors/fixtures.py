import re
import json
import sys
import requests
import pandas as pd
from io import StringIO
from pathlib import Path
from collections import defaultdict

BASE_DIR = Path(__file__).parent.parent
sys.path.insert(0, str(BASE_DIR))
from api.names import resolve_team_name

OPENFOOTBALL_URLS = [
    "https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json",
    "https://raw.githubusercontent.com/openfootball/worldcup/master/2026/worldcup.json",
]

DATAHUB_MATCHES = "https://datahub.io/football/worldcup/_r/-/matches.csv"


def fetch_openfootball():
    for url in OPENFOOTBALL_URLS:
        try:
            resp = requests.get(url, timeout=15)
            if resp.status_code == 200:
                print(f"  ✓ openfootball: {url}")
                return resp.json()
        except Exception as e:
            print(f"  ✗ {url}: {e}")
    return None


def parse_stage(round_name):
    rn = round_name.lower()
    if "round of 32" in rn or "round of thirty-two" in rn:
        return "round-of-32", None
    if "round of 16" in rn or "round of sixteen" in rn:
        return "round-of-16", None
    if "quarter" in rn:
        return "QF", None
    if "semi" in rn:
        return "SF", None
    if "third" in rn or "3rd" in rn or "bronze" in rn:
        return "3rd", None
    if "final" in rn:
        return "final", None
    m = re.search(r'group\s+([A-L])\b', rn, re.I)
    group = m.group(1).upper() if m else None
    return "group", group


def parse_fixtures(data):
    fixtures = []
    # Support both {"rounds": [...]} and {"matches": [...]} layouts
    all_matches = []
    if data.get("rounds"):
        for round_ in data["rounds"]:
            round_name = round_.get("name", "")
            for match in round_.get("matches", []):
                match.setdefault("round", round_name)
                all_matches.append(match)
    else:
        all_matches = data.get("matches", [])

    for match in all_matches:
        round_name = match.get("round", "")
        stage, group = parse_stage(round_name)

        date_str = match.get("date", "")
        team1 = match.get("team1", "")
        team2 = match.get("team2", "")
        home = team1.get("name", "") if isinstance(team1, dict) else str(team1)
        away = team2.get("name", "") if isinstance(team2, dict) else str(team2)
        home = resolve_team_name(home)
        away = resolve_team_name(away)

        match_group = group
        if not match_group:
            mg = match.get("group", "")
            if mg:
                m2 = re.search(r'[Gg]roup\s+([A-L])\b', str(mg))
                if m2:
                    match_group = m2.group(1).upper()
                    if not stage or stage == "group":
                        stage = "group"

        score = match.get("score", {})
        score_h = score_a = None
        if isinstance(score, dict):
            ft = score.get("ft")
            if ft and len(ft) >= 2:
                score_h, score_a = int(ft[0]), int(ft[1])
        elif isinstance(score, list) and len(score) >= 2:
            score_h, score_a = int(score[0]), int(score[1])

        if home and away:
            fixtures.append({
                "date": date_str,
                "stage": stage,
                "group": match_group,
                "home": home,
                "away": away,
                "score_h": score_h,
                "score_a": score_a,
                "played": score_h is not None,
            })

    return fixtures


def compute_standings(fixtures):
    group_teams = defaultdict(set)
    records = defaultdict(lambda: {"pts": 0, "gd": 0, "gf": 0, "ga": 0, "w": 0, "d": 0, "l": 0})

    for m in fixtures:
        if m["stage"] != "group" or not m["group"]:
            continue
        g = m["group"]
        group_teams[g].add(m["home"])
        group_teams[g].add(m["away"])

        if not m["played"]:
            continue

        sh, sa = m["score_h"], m["score_a"]
        kh, ka = (g, m["home"]), (g, m["away"])

        records[kh]["gf"] += sh; records[kh]["ga"] += sa; records[kh]["gd"] += sh - sa
        records[ka]["gf"] += sa; records[ka]["ga"] += sh; records[ka]["gd"] += sa - sh

        if sh > sa:
            records[kh]["pts"] += 3; records[kh]["w"] += 1; records[ka]["l"] += 1
        elif sh < sa:
            records[ka]["pts"] += 3; records[ka]["w"] += 1; records[kh]["l"] += 1
        else:
            records[kh]["pts"] += 1; records[kh]["d"] += 1
            records[ka]["pts"] += 1; records[ka]["d"] += 1

    groups = []
    for g in sorted(group_teams.keys()):
        team_records = []
        for team in group_teams[g]:
            r = dict(records[(g, team)])
            r["name"] = team
            r["form"] = ""
            r["status"] = ""
            team_records.append(r)
        team_records.sort(key=lambda x: (-x["pts"], -x["gd"], -x["gf"]))
        groups.append({"group": g, "teams": team_records})

    return groups


def fetch_history():
    try:
        print("  Fetching historical WC matches from datahub.io...")
        resp = requests.get(DATAHUB_MATCHES, timeout=20)
        resp.raise_for_status()
        df = pd.read_csv(StringIO(resp.text))
        records = df.where(pd.notna(df), None).to_dict(orient="records")
        print(f"  ✓ Got {len(records)} historical matches")
        return records
    except Exception as e:
        print(f"  ✗ datahub.io: {e}")
        return []


def main():
    print("Building fixtures and groups...")

    data = fetch_openfootball()
    if data:
        fixtures = parse_fixtures(data)
        print(f"  Parsed {len(fixtures)} fixtures")
    else:
        print("  openfootball unavailable — empty fixture list")
        fixtures = []

    groups = compute_standings(fixtures)

    out_dir = BASE_DIR / "data" / "processed"
    with open(out_dir / "fixtures.json", "w", encoding="utf-8") as f:
        json.dump(fixtures, f, indent=2, ensure_ascii=False)
    print(f"✓ Saved fixtures.json ({len(fixtures)} matches)")

    with open(out_dir / "groups.json", "w", encoding="utf-8") as f:
        json.dump(groups, f, indent=2, ensure_ascii=False)
    print(f"✓ Saved groups.json ({len(groups)} groups)")

    history = fetch_history()
    with open(out_dir / "matches_history.json", "w", encoding="utf-8") as f:
        json.dump(history, f, indent=2, ensure_ascii=False)
    print(f"✓ Saved matches_history.json ({len(history)} records)")


if __name__ == "__main__":
    main()
