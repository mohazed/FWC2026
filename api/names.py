"""Single source of truth for team-name normalization and pre-tournament market data.

All processed JSON and API/chart code should resolve team names through
`resolve_team_name()` so that historical aliases, live-feed aliases, and the
2026 roster in master_teams.json all agree on one canonical name.
"""

from __future__ import annotations

# Any alias (historical, live-feed, or CSV) -> canonical master_teams.json name.
TEAM_ALIASES: dict[str, str] = {
    # Historical World Cup names
    "West Germany": "Germany",
    "Czech Republic": "Czechia",
    "Zaire": "DR Congo",
    "Korea Republic": "South Korea",
    "Côte d'Ivoire": "Ivory Coast",
    "Congo DR": "DR Congo",
    "Cape Verde Islands": "Cape Verde",
    "Bosnia & Herzegovina": "Bosnia and Herzegovina",
    # Live-feed / fixtures aliases
    "USA": "United States",
    "Democratic Republic of the Congo": "DR Congo",
}

# Pre-tournament American opening odds (CBS Sports / Oddspedia, frozen at start).
AMERICAN_ODDS: dict[str, int] = {
    "Argentina": -150, "France": 400, "Brazil": 450, "England": 600,
    "Spain": 700, "Germany": 1000, "Portugal": 1400, "Netherlands": 2000,
    "United States": 2500, "Uruguay": 2500, "Colombia": 3000, "Morocco": 3000,
    "Belgium": 3500, "Mexico": 3500, "Japan": 5000, "Croatia": 5000,
    "Canada": 4500, "Turkey": 8000, "Austria": 8000, "Switzerland": 8000,
    "South Korea": 10000, "Ecuador": 10000, "Senegal": 8000, "Ivory Coast": 12000,
    "Norway": 15000, "Sweden": 12000, "Algeria": 20000, "Ghana": 20000,
    "Scotland": 25000, "Tunisia": 25000, "Egypt": 20000, "Paraguay": 30000,
    "Czechia": 20000, "Bosnia and Herzegovina": 25000, "Iran": 30000,
    "Saudi Arabia": 35000, "Australia": 25000, "DR Congo": 40000,
    "South Africa": 50000, "Panama": 50000, "Cape Verde": 50000, "Iraq": 60000,
    "New Zealand": 75000, "Uzbekistan": 75000, "Jordan": 75000, "Qatar": 75000,
    "Curaçao": 100000, "Haiti": 150000,
}

# Squad market values (€M), Transfermarkt estimates.
SQUAD_VALUES_M: dict[str, float] = {
    "England": 1150, "France": 1100, "Spain": 1000, "Germany": 850,
    "Brazil": 900, "Portugal": 850, "Netherlands": 650, "Argentina": 700,
    "Belgium": 500, "Uruguay": 400, "Colombia": 350, "United States": 350,
    "Morocco": 300, "Turkey": 350, "Croatia": 280, "Switzerland": 300,
    "Austria": 250, "Mexico": 250, "Norway": 350, "Sweden": 220,
    "Japan": 200, "South Korea": 200, "Senegal": 200, "Ivory Coast": 200,
    "Scotland": 180, "Canada": 150, "Ecuador": 120, "Czechia": 200,
    "Algeria": 100, "Egypt": 130, "Bosnia and Herzegovina": 100,
    "Ghana": 80, "Tunisia": 60, "Iran": 30, "Saudi Arabia": 50,
    "Australia": 100, "Paraguay": 50, "DR Congo": 40, "South Africa": 40,
    "Panama": 20, "Cape Verde": 30, "Iraq": 20, "New Zealand": 20,
    "Uzbekistan": 30, "Jordan": 15, "Qatar": 40, "Haiti": 10,
    "Curaçao": 15,
}

# ISO 3166-1 alpha-2 (or flagcdn subdivision) codes for all 48 WC 2026 teams.
TEAM_FLAG_CODES: dict[str, str] = {
    "Algeria": "dz",
    "Argentina": "ar",
    "Australia": "au",
    "Austria": "at",
    "Belgium": "be",
    "Bosnia and Herzegovina": "ba",
    "Brazil": "br",
    "Canada": "ca",
    "Cape Verde": "cv",
    "Colombia": "co",
    "Croatia": "hr",
    "Curaçao": "cw",
    "Czechia": "cz",
    "DR Congo": "cd",
    "Ecuador": "ec",
    "Egypt": "eg",
    "England": "gb-eng",
    "France": "fr",
    "Germany": "de",
    "Ghana": "gh",
    "Haiti": "ht",
    "Iran": "ir",
    "Iraq": "iq",
    "Ivory Coast": "ci",
    "Japan": "jp",
    "Jordan": "jo",
    "Mexico": "mx",
    "Morocco": "ma",
    "Netherlands": "nl",
    "New Zealand": "nz",
    "Norway": "no",
    "Panama": "pa",
    "Paraguay": "py",
    "Portugal": "pt",
    "Qatar": "qa",
    "Saudi Arabia": "sa",
    "Scotland": "gb-sct",
    "Senegal": "sn",
    "South Africa": "za",
    "South Korea": "kr",
    "Spain": "es",
    "Sweden": "se",
    "Switzerland": "ch",
    "Tunisia": "tn",
    "Turkey": "tr",
    "United States": "us",
    "Uruguay": "uy",
    "Uzbekistan": "uz",
}


def resolve_team_name(name: str | None) -> str:
    """Map any known alias to its canonical 2026 roster name."""
    if not name:
        return ""
    return TEAM_ALIASES.get(name, name)


def american_to_prob(odds: float) -> float:
    """Convert American moneyline odds to an implied probability in [0, 1]."""
    if odds >= 0:
        return 100 / (odds + 100)
    return abs(odds) / (abs(odds) + 100)


def implied_prob_normalized() -> dict[str, float]:
    """Vig-removed implied win probability per team, summing to 1.0."""
    raw = {team: american_to_prob(odds) for team, odds in AMERICAN_ODDS.items()}
    total = sum(raw.values())
    return {team: p / total for team, p in raw.items()}


def flag_code_for(team: str) -> str:
    """Return flagcdn.com country/subdivision code for a canonical team name."""
    return TEAM_FLAG_CODES.get(resolve_team_name(team), "un")


def flag_asset_url(team: str, width: int = 40) -> str:
    """Return a flagcdn.com PNG URL sized for the requested width."""
    return f"https://flagcdn.com/w{width}/{flag_code_for(team)}.png"
