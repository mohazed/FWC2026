import json
import numpy as np
from collections import defaultdict
from functools import lru_cache
from pathlib import Path

from api.names import AMERICAN_ODDS, american_to_prob, resolve_team_name

DATA_DIR = Path(__file__).parent.parent / "data" / "processed"


@lru_cache(maxsize=None)
def _load(filename):
    with open(DATA_DIR / filename, encoding="utf-8") as f:
        return json.load(f)


def _elo_win_prob(elo_a: float, elo_b: float) -> dict:
    expected_a = 1 / (1 + 10 ** ((elo_b - elo_a) / 400))
    draw_adj = 0.25
    win_a = round(expected_a * (1 - draw_adj), 3)
    win_b = round((1 - expected_a) * (1 - draw_adj), 3)
    draw = round(draw_adj, 3)
    return {"win_a": win_a, "draw": draw, "win_b": win_b}


def _get_team_elo(teams: list, name: str) -> float:
    canon = resolve_team_name(name).lower()
    for t in teams:
        if t["name"].lower() == canon:
            return float(t["elo"])
    return 1600.0


def _bookmaker_h2h(team_a: str, team_b: str) -> dict:
    """Head-to-head win share implied by tournament-winner odds (vig removed)."""
    canon_a = resolve_team_name(team_a)
    canon_b = resolve_team_name(team_b)
    odds_a = AMERICAN_ODDS.get(canon_a)
    odds_b = AMERICAN_ODDS.get(canon_b)
    if odds_a is None or odds_b is None:
        return {"bookie_a": None, "bookie_b": None}
    pa, pb = american_to_prob(odds_a), american_to_prob(odds_b)
    total = pa + pb
    if total <= 0:
        return {"bookie_a": None, "bookie_b": None}
    return {"bookie_a": round(pa / total, 3), "bookie_b": round(pb / total, 3)}


def predict_match(team_a: str, team_b: str) -> dict:
    teams = _load("master_teams.json")
    elo_a = _get_team_elo(teams, team_a)
    elo_b = _get_team_elo(teams, team_b)
    probs = _elo_win_prob(elo_a, elo_b)
    return {
        "team_a": team_a,
        "team_b": team_b,
        "elo_a": elo_a,
        "elo_b": elo_b,
        **probs,
        **_bookmaker_h2h(team_a, team_b),
    }


def _sim_match(elo_a: float, elo_b: float, rng: np.random.Generator) -> str:
    probs = _elo_win_prob(elo_a, elo_b)
    r = rng.random()
    if r < probs["win_a"]:
        return "a"
    elif r < probs["win_a"] + probs["draw"]:
        return "draw"
    return "b"


def _sim_knockout(elo_a: float, elo_b: float, rng: np.random.Generator) -> str:
    """No draws in knockout — resolve via extra-time/penalties pseudo-coin."""
    expected_a = 1 / (1 + 10 ** ((elo_b - elo_a) / 400))
    return "a" if rng.random() < expected_a else "b"


def run_montecarlo(n: int = 500) -> list:
    teams_data = _load("master_teams.json")
    groups_data = _load("groups.json")

    elo_map = {t["name"]: float(t["elo"]) for t in teams_data}
    group_map = {}
    for g in groups_data:
        group_map[g["group"]] = [resolve_team_name(t["name"]) for t in g["teams"]]

    rng = np.random.default_rng(42)
    win_counts = defaultdict(int)
    qf_counts = defaultdict(int)
    sf_counts = defaultdict(int)
    final_counts = defaultdict(int)

    for _ in range(n):
        # --- Group stage ---
        group_pts = {}
        group_gd = {}
        for g_label, g_teams in group_map.items():
            pts = {t: 0 for t in g_teams}
            gd = {t: 0.0 for t in g_teams}
            for i in range(len(g_teams)):
                for j in range(i + 1, len(g_teams)):
                    ta, tb = g_teams[i], g_teams[j]
                    ea, eb = elo_map.get(ta, 1600), elo_map.get(tb, 1600)
                    outcome = _sim_match(ea, eb, rng)
                    diff = abs(ea - eb) / 200
                    if outcome == "a":
                        pts[ta] += 3
                        gd[ta] += diff; gd[tb] -= diff
                    elif outcome == "b":
                        pts[tb] += 3
                        gd[tb] += diff; gd[ta] -= diff
                    else:
                        pts[ta] += 1; pts[tb] += 1
            group_pts[g_label] = pts
            group_gd[g_label] = gd

        # Determine group top-2
        qualified = []
        third_place = []
        for g_label, g_teams in group_map.items():
            ranked = sorted(g_teams, key=lambda t: (-group_pts[g_label][t], -group_gd[g_label][t]))
            qualified.append(ranked[0])
            qualified.append(ranked[1])
            third_place.append((ranked[2], group_pts[g_label][ranked[2]], group_gd[g_label][ranked[2]]))

        # Best 8 third-place teams advance (WC 2026 has 48 teams, 12 groups → 32 R32 teams = 24 group winners/runners-up + 8 best 3rd)
        third_place.sort(key=lambda x: (-x[1], -x[2]))
        qualified += [t[0] for t in third_place[:8]]  # 32 total

        # --- Knockout bracket (Round of 32 → Final) ---
        bracket = qualified[:]
        rng.shuffle(bracket)

        rounds_labels = ["R32", "R16", "QF", "SF"]
        for round_label in rounds_labels:
            next_round = []
            for i in range(0, len(bracket), 2):
                if i + 1 >= len(bracket):
                    next_round.append(bracket[i])
                    continue
                ta, tb = bracket[i], bracket[i + 1]
                ea, eb = elo_map.get(ta, 1600), elo_map.get(tb, 1600)
                winner = ta if _sim_knockout(ea, eb, rng) == "a" else tb
                if round_label == "QF":
                    qf_counts[ta] += 1; qf_counts[tb] += 1
                if round_label == "SF":
                    sf_counts[ta] += 1; sf_counts[tb] += 1
                next_round.append(winner)
            bracket = next_round

        # Final (bracket now has 2 teams)
        if len(bracket) == 2:
            fa, fb = bracket[0], bracket[1]
            final_counts[fa] += 1; final_counts[fb] += 1
            ea, eb = elo_map.get(fa, 1600), elo_map.get(fb, 1600)
            champion = fa if _sim_knockout(ea, eb, rng) == "a" else fb
            win_counts[champion] += 1

    results = []
    for t in teams_data:
        name = t["name"]
        results.append({
            "name": name,
            "qf_prob": round(qf_counts[name] / n, 4),
            "sf_prob": round(sf_counts[name] / n, 4),
            "final_prob": round(final_counts[name] / n, 4),
            "win_prob": round(win_counts[name] / n, 4),
        })
    results.sort(key=lambda x: -x["win_prob"])
    return results
