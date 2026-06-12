#!/usr/bin/env python3
"""Read-only audit of matches_history.json for heatmap / H2H integrity."""

from __future__ import annotations

import json
import sys
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from api.history_utils import (  # noqa: E402
    HISTORY_TO_CANONICAL,
    STAGE_RANK,
    collect_unmapped_stages,
    iter_mens_matches,
    normalize_team_name,
)

DATA_DIR = ROOT / "data" / "processed"


def load_json(name: str):
    with open(DATA_DIR / name, encoding="utf-8") as f:
        return json.load(f)


def main() -> int:
    history = load_json("matches_history.json")
    teams = load_json("master_teams.json")
    qualified = {t["name"] for t in teams}

    women = [m for m in history if "Women" in (m.get("tournament_name") or "")]
    men = [m for m, _year in iter_mens_matches(history)]

    print("=== World Cup History Audit ===")
    print(f"Total records: {len(history)}")
    print(f"Men's records: {len(men)}")
    print(f"Women's records: {len(women)}")

    years = sorted({int((m.get("match_date") or "0")[:4]) for m in men})
    print(f"Men's years: {years[0]}–{years[-1]} ({len(years)} editions)")

    print("\n--- Stage names (men's) ---")
    stage_counts = Counter((m.get("stage_name") or "").lower().strip() for m in men)
    for stage, count in stage_counts.most_common():
        mapped = "OK" if stage in STAGE_RANK else "UNMAPPED"
        print(f"  {count:4d}  {stage!r:30s}  [{mapped}]")

    unmapped = collect_unmapped_stages(history)
    if unmapped:
        print(f"\nWARNING: unmapped stages: {sorted(unmapped)}")
    else:
        print("\nAll men's stage names are mapped.")

    print("\n--- Replay / penalty rows ---")
    replay_flags = Counter((m.get("replayed"), m.get("replay")) for m in men)
    for flag, count in replay_flags.items():
        print(f"  replayed={flag[0]}, replay={flag[1]}: {count}")
    print(f"  Penalty shootouts: {sum(1 for m in men if m.get('penalty_shootout'))}")

    print("\n--- Historical aliases ---")
    raw_names: set[str] = set()
    for m in men:
        raw_names.add(m.get("home_team_name") or "")
        raw_names.add(m.get("away_team_name") or "")
    raw_names.discard("")

    alias_hits = {k: v for k, v in HISTORY_TO_CANONICAL.items() if k in raw_names}
    for hist, canon in sorted(alias_hits.items()):
        print(f"  {hist} -> {canon}")

    unknown = sorted(n for n in raw_names if n not in qualified and n not in HISTORY_TO_CANONICAL)
    print(f"\nHistorical names not in 2026 roster and not aliased ({len(unknown)}):")
    for name in unknown[:20]:
        print(f"  {name}")
    if len(unknown) > 20:
        print(f"  ... and {len(unknown) - 20} more")

    print("\n--- 2026 team coverage (after normalization) ---")
    team_years: dict[str, set[int]] = defaultdict(set)
    for m, year in iter_mens_matches(history):
        for key in ("home_team_name", "away_team_name"):
            canon = normalize_team_name(m.get(key))
            if canon:
                team_years[canon].add(year)

    no_history = sorted(t for t in qualified if t not in team_years)
    print(f"Teams with no men's WC appearances: {len(no_history)}")
    print(f"  {', '.join(no_history)}")

    spot_checks = {
        "Germany": {1954, 1974, 1990},
        "Czechia": {2006},
        "DR Congo": {1974},
        "South Korea": {1954, 2002},
        "Ivory Coast": {2006, 2010, 2014},
    }
    print("\n--- Spot checks ---")
    ok = True
    for team, expected_years in spot_checks.items():
        actual = team_years.get(team, set())
        missing = expected_years - actual
        status = "OK" if not missing else f"MISSING {sorted(missing)}"
        print(f"  {team}: {status} (years: {sorted(actual)[:5]}...)" if len(actual) > 5 else f"  {team}: {status} (years: {sorted(actual)})")
        if missing:
            ok = False

    return 0 if ok and not unmapped else 1


if __name__ == "__main__":
    raise SystemExit(main())
