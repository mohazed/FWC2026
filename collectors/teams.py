import json
import pandas as pd


WC_TEAMS_2026 = [
    ("Algeria", "CAF", "E"), ("Argentina", "CONMEBOL", "G"), ("Australia", "AFC", "H"),
    ("Austria", "UEFA", "D"), ("Belgium", "UEFA", "J"), ("Bosnia and Herzegovina", "UEFA", "B"),
    ("Brazil", "CONMEBOL", "F"), ("Canada", "CONCACAF", "B"), ("Cape Verde", "CAF", "I"),
    ("Colombia", "CONMEBOL", "L"), ("Croatia", "UEFA", "D"), ("Curaçao", "CONCACAF", "K"),
    ("Czechia", "UEFA", "A"), ("DR Congo", "CAF", "H"), ("Ecuador", "CONMEBOL", "C"),
    ("Egypt", "CAF", "F"), ("England", "UEFA", "L"), ("France", "UEFA", "J"),
    ("Germany", "UEFA", "C"), ("Ghana", "CAF", "K"), ("Haiti", "CONCACAF", "G"),
    ("Iran", "AFC", "E"), ("Iraq", "AFC", "I"), ("Ivory Coast", "CAF", "G"),
    ("Japan", "AFC", "C"), ("Jordan", "AFC", "D"), ("Mexico", "CONCACAF", "A"),
    ("Morocco", "CAF", "B"), ("Netherlands", "UEFA", "E"), ("New Zealand", "OFC", "K"),
    ("Norway", "UEFA", "F"), ("Panama", "CONCACAF", "I"), ("Paraguay", "CONMEBOL", "H"),
    ("Portugal", "UEFA", "L"), ("Qatar", "AFC", "B"), ("Saudi Arabia", "AFC", "J"),
    ("Scotland", "UEFA", "C"), ("Senegal", "CAF", "A"), ("South Africa", "CAF", "A"),
    ("South Korea", "AFC", "A"), ("Spain", "UEFA", "K"), ("Sweden", "UEFA", "G"),
    ("Switzerland", "UEFA", "B"), ("Tunisia", "CAF", "F"), ("Turkey", "UEFA", "E"),
    ("United States", "CONCACAF", "D"), ("Uruguay", "CONMEBOL", "I"), ("Uzbekistan", "AFC", "J"),
]

# CSV uses "Czech Republic" or "Czechia" inconsistently; South Korea may vary
NAME_MAP = {
    "Czechia": "Czech Republic",
    "South Korea": "Korea Republic",
    "Ivory Coast": "Côte d'Ivoire",
    "DR Congo": "Congo DR",
    "Cape Verde": "Cape Verde Islands",
}


def main():
    print("Building master_teams.json...")
    df = pd.read_csv("data/raw/elo_ratings_wc2026.csv")
    df2026 = df[df["year"] == 2026].drop_duplicates(subset=["country"]).set_index("country")

    teams = []
    for name, confed, group in WC_TEAMS_2026:
        csv_key = NAME_MAP.get(name, name)
        row = df2026.loc[csv_key] if csv_key in df2026.index else (
            df2026.loc[name] if name in df2026.index else None
        )

        elo = int(row["rating"]) if row is not None else 1600
        fifa_rank = int(row["rank"]) if row is not None else 50

        teams.append({
            "name": name,
            "confederation": confed,
            "group": group,
            "elo": elo,
            "fifa_rank": fifa_rank,
            "squad_value_m": None,
            "flag": "",
            "implied_prob": None,
        })

    with open("data/processed/master_teams.json", "w", encoding="utf-8") as f:
        json.dump(teams, f, indent=2, ensure_ascii=False)
    print(f"✓ Saved master_teams.json ({len(teams)} teams)")


if __name__ == "__main__":
    main()
