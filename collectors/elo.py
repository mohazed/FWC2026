import json
import pandas as pd


def main():
    print("Building elo_history.json from CSV...")
    df = pd.read_csv("data/raw/elo_ratings_wc2026.csv")
    df = df[df["year"] >= 1901].copy()

    records = (
        df[["year", "snapshot_date", "country", "rank", "country_code", "rating", "confederation"]]
        .where(pd.notna(df), None)
        .to_dict(orient="records")
    )

    with open("data/processed/elo_history.json", "w") as f:
        json.dump(records, f, indent=2)
    print(f"✓ Saved elo_history.json ({len(records)} records)")


if __name__ == "__main__":
    main()
