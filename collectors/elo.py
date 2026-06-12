import json
import sys
from pathlib import Path

import pandas as pd

BASE_DIR = Path(__file__).parent.parent
sys.path.insert(0, str(BASE_DIR))
from api.names import resolve_team_name


def main():
    print("Building elo_history.json from CSV...")
    df = pd.read_csv(BASE_DIR / "data/raw/elo_ratings_wc2026.csv")
    df = df[df["year"] >= 1901].copy()
    df["country"] = df["country"].map(resolve_team_name)

    records = (
        df[["year", "snapshot_date", "country", "rank", "country_code", "rating", "confederation"]]
        .where(pd.notna(df), None)
        .to_dict(orient="records")
    )

    # Keep one row per (country, year): the latest snapshot_date.
    best: dict = {}
    for r in records:
        key = (r["country"], r["year"])
        cur = best.get(key)
        if cur is None or (r.get("snapshot_date") or "") > (cur.get("snapshot_date") or ""):
            best[key] = r
    deduped = sorted(best.values(), key=lambda r: (r["country"], r["year"]))

    out_path = BASE_DIR / "data/processed/elo_history.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(deduped, f, indent=2, ensure_ascii=False)
    print(f"✓ Saved elo_history.json ({len(deduped)} records, deduped from {len(records)})")


if __name__ == "__main__":
    main()
