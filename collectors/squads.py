import re
import json
import sys
import requests
import pandas as pd
from io import StringIO
from pathlib import Path
from bs4 import BeautifulSoup

BASE_DIR = Path(__file__).parent.parent
sys.path.insert(0, str(BASE_DIR))
from api.names import resolve_team_name

POSITION_MAP = {
    "GK": "GK", "G": "GK",
    "DF": "DEF", "DEF": "DEF", "D": "DEF",
    "MF": "MID", "MID": "MID", "M": "MID",
    "CM": "MID", "AM": "MID", "DM": "MID",
    "FW": "FWD", "FWD": "FWD", "F": "FWD",
    "ST": "FWD", "AT": "FWD", "WF": "FWD",
}

SKIP_HEADINGS = {
    "Contents", "See also", "Notes", "References", "External links",
    "Group stage", "Knockout stage", "Round of 32", "Round of 16",
    "Quarter-finals", "Semi-finals", "Final", "Third-place play-off",
    "2026 FIFA World Cup squads", "Qualified teams",
}


def find_col(df, *keywords):
    for kw in keywords:
        for col in df.columns:
            if kw.lower() in str(col).lower():
                return col
    return None


def parse_age(s):
    s = str(s)
    m = re.search(r'aged?\s+(\d+)', s, re.I)
    if m:
        return int(m.group(1))
    m = re.search(r'\b(19[89]\d|200\d|201[0-4])\b', s)
    if m:
        return 2026 - int(m.group(1))
    return None


def clean(s):
    s = re.sub(r'\[.*?\]', '', str(s))
    return re.sub(r'\s+', ' ', s).strip()


def get_heading_text(tag):
    span = tag.find("span", class_="mw-headline")
    text = span.get_text(strip=True) if span else tag.get_text(strip=True)
    return clean(text)


def safe_read_html(html_str):
    for flavor in [None, 'html.parser', 'lxml', 'html5lib']:
        try:
            kw = {"flavor": flavor} if flavor else {}
            return pd.read_html(StringIO(html_str), **kw)
        except Exception:
            pass
    return []


def scrape_squads():
    url = "https://en.wikipedia.org/wiki/2026_FIFA_World_Cup_squads"
    headers = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"}
    resp = requests.get(url, headers=headers, timeout=30)
    resp.raise_for_status()

    soup = BeautifulSoup(resp.text, "html.parser")
    content = soup.find("div", id="mw-content-text") or soup

    squads = []
    current_country = None

    for tag in content.find_all(["h2", "h3", "table"]):
        if tag.name in ["h2", "h3"]:
            text = get_heading_text(tag)
            if not text or text in SKIP_HEADINGS:
                continue
            if re.match(r'^Group [A-L]\b', text):
                continue
            current_country = text

        elif tag.name == "table" and current_country:
            if tag.find_parent("table"):
                continue

            dfs = safe_read_html(str(tag))
            if not dfs:
                continue
            df = dfs[0]

            if isinstance(df.columns, pd.MultiIndex):
                df.columns = [
                    " ".join(str(c) for c in col if str(c) != "nan").strip()
                    for col in df.columns
                ]
            df.columns = [clean(c) for c in df.columns]

            pos_col   = find_col(df, "Position", "Pos")
            name_col  = find_col(df, "Name", "Player")
            dob_col   = find_col(df, "Date of birth", "DOB", "born")
            caps_col  = find_col(df, "Caps")
            goals_col = find_col(df, "Goals")
            club_col  = find_col(df, "Club")

            if not (name_col and club_col and pos_col):
                continue

            players = []
            for _, row in df.iterrows():
                name = clean(row[name_col])
                if not name or name.lower() in {"nan", "name", "player", "players"}:
                    continue

                pos_raw = clean(row[pos_col]).upper().split()[0] if pos_col else ""
                pos = POSITION_MAP.get(pos_raw, "MID")

                age = parse_age(row[dob_col]) if dob_col else None

                try:
                    caps = int(float(clean(str(row[caps_col])).split()[0])) if caps_col else 0
                except Exception:
                    caps = 0

                try:
                    goals = int(float(clean(str(row[goals_col])).split()[0])) if goals_col else 0
                except Exception:
                    goals = 0

                club = clean(row[club_col]) if club_col else ""

                players.append({
                    "name": name,
                    "pos": pos,
                    "age": age,
                    "club": club,
                    "caps": caps,
                    "goals": goals,
                })

            if len(players) >= 11:
                canon = resolve_team_name(current_country)
                squads.append({"country": canon, "players": players})
                print(f"  ✓ {canon}: {len(players)} players")
                current_country = None

    return squads


def main():
    print("Scraping 2026 WC squads from Wikipedia...")
    squads = scrape_squads()
    print(f"\nFound {len(squads)} national teams")

    out_path = BASE_DIR / "data/processed/master_squads.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(squads, f, indent=2, ensure_ascii=False)
    print(f"✓ Saved master_squads.json ({len(squads)} teams)")


if __name__ == "__main__":
    main()
