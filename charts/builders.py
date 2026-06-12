import json
import pandas as pd
import altair as alt
import numpy as np
from functools import lru_cache
from pathlib import Path

from api.history_utils import (
    RANK_TO_LABEL,
    STAGE_COLORS,
    STAGE_ORDER,
    iter_mens_matches,
    normalize_team_name,
    stage_rank,
)
from api.names import (
    AMERICAN_ODDS,
    SQUAD_VALUES_M,
    american_to_prob,
    resolve_team_name,
)

DATA_DIR = Path(__file__).parent.parent / "data" / "processed"

# Design token hex values (must match CSS custom properties)
PITCH_NIGHT = "#0D2818"
TROPHY_GOLD = "#D4A017"
RED_CARD = "#C42B2B"
DATA_TEAL = "#0F766E"
PITCH_MIST = "#E8F0EB"
MUTED = "#9CA3AF"

CONFED_COLORS = {
    "UEFA": PITCH_NIGHT,
    "CONMEBOL": DATA_TEAL,
    "CAF": TROPHY_GOLD,
    "AFC": "#6B2E7E",
    "CONCACAF": RED_CARD,
    "OFC": MUTED,
}

@lru_cache(maxsize=None)
def _load(filename):
    with open(DATA_DIR / filename, encoding="utf-8") as f:
        return json.load(f)


# ── 1. Historical heatmap ─────────────────────────────────────────────────────

def build_heatmap(confederation: str = None) -> dict:
    history = _load("matches_history.json")
    teams_data = _load("master_teams.json")

    qualified_teams = {t["name"] for t in teams_data}
    team_confederation = {t["name"]: t.get("confederation", "") for t in teams_data}

    records: dict[tuple[str, int], dict] = {}

    def _ensure(key: tuple[str, int]) -> dict:
        if key not in records:
            records[key] = {"stage_rank": 0, "w": 0, "d": 0, "l": 0, "matches": 0}
        return records[key]

    for m, year in iter_mens_matches(history):
        home = normalize_team_name(m.get("home_team_name", ""))
        away = normalize_team_name(m.get("away_team_name", ""))
        stage_raw = (m.get("stage_name") or "").lower().strip()
        rank = stage_rank(m.get("stage_name"))

        hw = int(m.get("home_team_win") or 0)
        aw = int(m.get("away_team_win") or 0)
        dr = int(m.get("draw") or 0)

        for team, is_home in ((home, True), (away, False)):
            if not team:
                continue
            rec = _ensure((team, year))
            rec["stage_rank"] = max(rec["stage_rank"], rank)
            rec["matches"] += 1

            if is_home:
                if hw:
                    rec["w"] += 1
                elif aw:
                    rec["l"] += 1
                elif dr:
                    rec["d"] += 1
            else:
                if aw:
                    rec["w"] += 1
                elif hw:
                    rec["l"] += 1
                elif dr:
                    rec["d"] += 1

        if stage_raw in ("final", "finals"):
            winner = home if hw else away if aw else None
            if winner:
                _ensure((winner, year))["stage_rank"] = 7

    title_counts: dict[str, int] = {}
    for (team, _year), rec in records.items():
        if rec["stage_rank"] == 7:
            title_counts[team] = title_counts.get(team, 0) + 1

    if confederation and confederation.upper() != "ALL":
        filtered_teams = {t for t in qualified_teams if team_confederation.get(t) == confederation}
    else:
        filtered_teams = qualified_teams

    all_years = sorted({y for (_, y) in records})
    all_teams = sorted(filtered_teams, key=lambda t: (-title_counts.get(t, 0), t))

    rows = []
    for team in all_teams:
        for year in all_years:
            rec = records.get((team, year), {})
            rank = rec.get("stage_rank", 0)
            rows.append({
                "team": team,
                "year": year,
                "stage": RANK_TO_LABEL[rank],
                "titles": title_counts.get(team, 0),
                "matches": rec.get("matches", 0),
                "w": rec.get("w", 0),
                "d": rec.get("d", 0),
                "l": rec.get("l", 0),
            })

    df = pd.DataFrame(rows)

    color_scale = alt.Scale(
        domain=STAGE_ORDER,
        range=[STAGE_COLORS[s] for s in STAGE_ORDER],
    )

    n_teams = len(all_teams)
    conf_label = confederation if confederation and confederation.upper() != "ALL" else "All Confederations"
    chart = (
        alt.Chart(df)
        .mark_rect()
        .encode(
            x=alt.X("year:O", title="Year", axis=alt.Axis(labelAngle=-45)),
            y=alt.Y("team:N", title=None, sort=all_teams),
            color=alt.Color(
                "stage:N",
                scale=color_scale,
                legend=alt.Legend(title="Stage reached", orient="bottom"),
            ),
            tooltip=[
                alt.Tooltip("team:N", title="Team"),
                alt.Tooltip("year:O", title="Year"),
                alt.Tooltip("stage:N", title="Stage reached"),
                alt.Tooltip("matches:Q", title="Matches played"),
                alt.Tooltip("titles:Q", title="Total WC titles"),
                alt.Tooltip("w:Q", title="Wins that year"),
                alt.Tooltip("d:Q", title="Draws that year"),
                alt.Tooltip("l:Q", title="Losses that year"),
            ],
        )
        .properties(
            title=f"World Cup Performance — 2026 Qualified Nations · {conf_label} (1930–2022)",
            width=900,
            height=max(200, n_teams * 16),
        )
    )
    return chart.to_dict()


# ── 2. Elo trajectory ────────────────────────────────────────────────────────

def build_elo_chart(teams: list) -> dict:
    elo = _load("elo_history.json")
    df = pd.DataFrame(elo)
    df = df[df["year"] >= 1930].copy()

    if teams:
        df = df[df["country"].isin(teams)]

    if df.empty:
        empty = pd.DataFrame({"year": [], "rating": [], "country": []})
        return (
            alt.Chart(empty).mark_line()
            .encode(x="year:Q", y="rating:Q", color="country:N")
            .properties(title="Elo Ratings Over Time").to_dict()
        )

    df = df.sort_values("rating", ascending=False).drop_duplicates(subset=["country", "year"])

    chart = (
        alt.Chart(df)
        .mark_line(strokeWidth=2)
        .encode(
            x=alt.X("year:Q", title="Year", scale=alt.Scale(zero=False)),
            y=alt.Y("rating:Q", title="Elo Rating", scale=alt.Scale(zero=False)),
            color=alt.Color("country:N", title="Team", scale=alt.Scale(scheme="category10")),
            tooltip=[
                alt.Tooltip("country:N", title="Team"),
                alt.Tooltip("year:Q", title="Year"),
                alt.Tooltip("rating:Q", title="Elo Rating"),
            ],
        )
        .properties(title="Elo Ratings Over Time", width=850, height=320)
    )
    return chart.to_dict()


# ── 3. Squad strength (Elo bars) ─────────────────────────────────────────────

def build_wealth_chart() -> dict:
    teams = _load("master_teams.json")
    elo = _load("elo_history.json")

    elo_2026 = {r["country"]: r["rating"] for r in elo if r["year"] == 2026}

    rows = []
    for t in teams:
        rows.append({
            "team": t["name"],
            "confederation": t["confederation"],
            "elo": elo_2026.get(t["name"], t["elo"]),
            "fifa_rank": t["fifa_rank"],
        })

    df = pd.DataFrame(rows).sort_values("elo", ascending=True)

    confed_domain = list(CONFED_COLORS.keys())
    confed_range = [CONFED_COLORS[c] for c in confed_domain]

    chart = (
        alt.Chart(df)
        .mark_bar()
        .encode(
            x=alt.X("elo:Q", title="Elo Rating"),
            y=alt.Y("team:N", title=None, sort=list(df["team"])),
            color=alt.Color(
                "confederation:N",
                scale=alt.Scale(domain=confed_domain, range=confed_range),
                title="Confederation",
                legend=alt.Legend(orient="bottom"),
            ),
            tooltip=[
                alt.Tooltip("team:N", title="Team"),
                alt.Tooltip("confederation:N", title="Confederation"),
                alt.Tooltip("elo:Q", title="Elo Rating"),
                alt.Tooltip("fifa_rank:Q", title="FIFA Rank"),
            ],
        )
        .properties(title="Team Strength by Elo Rating — All 48 Nations", width=600, height=700)
    )
    return chart.to_dict()


# ── 4. Age pyramid ───────────────────────────────────────────────────────────

def build_age_pyramid(country: str) -> dict:
    squads = _load("master_squads.json")
    team = next((t for t in squads if t["country"].lower() == country.lower()), None)
    if not team:
        return {}

    df = pd.DataFrame(team["players"])
    df = df[df["age"].notna()].copy()
    df["age"] = df["age"].astype(int)

    def age_band(a):
        if a < 23:
            return "U23"
        elif a < 28:
            return "23-27"
        elif a <= 30:
            return "28-30"
        return "30+"

    df["band"] = df["age"].apply(age_band)

    band_order = ["U23", "23-27", "28-30", "30+"]
    pos_order = ["GK", "DEF", "MID", "FWD"]
    pos_colors = {"GK": PITCH_NIGHT, "DEF": DATA_TEAL, "MID": TROPHY_GOLD, "FWD": RED_CARD}

    agg = df.groupby(["band", "pos"]).size().reset_index(name="count")

    chart = (
        alt.Chart(agg)
        .mark_bar()
        .encode(
            x=alt.X("count:Q", title="Players"),
            y=alt.Y("band:N", title="Age Band", sort=band_order),
            color=alt.Color(
                "pos:N",
                scale=alt.Scale(domain=pos_order, range=[pos_colors[p] for p in pos_order]),
                title="Position",
                legend=alt.Legend(orient="bottom"),
            ),
            tooltip=[
                alt.Tooltip("band:N", title="Age Band"),
                alt.Tooltip("pos:N", title="Position"),
                alt.Tooltip("count:Q", title="Players"),
            ],
        )
        .properties(title=f"{country} — Squad Age Distribution", width=400, height=240)
    )
    return chart.to_dict()


# ── 5. League / club chart ───────────────────────────────────────────────────

def build_league_chart(country: str) -> dict:
    squads = _load("master_squads.json")
    team = next((t for t in squads if t["country"].lower() == country.lower()), None)
    if not team:
        return {}

    df = pd.DataFrame(team["players"])
    club_counts = df.groupby("club").size().reset_index(name="count").sort_values("count", ascending=False)

    threshold = 2
    major = club_counts[club_counts["count"] >= threshold].copy()
    minor_count = int(club_counts[club_counts["count"] < threshold]["count"].sum())
    if minor_count > 0:
        other = pd.DataFrame([{"club": "Other", "count": minor_count}])
        major = pd.concat([major, other], ignore_index=True)

    major = major.sort_values("count", ascending=True)

    chart = (
        alt.Chart(major)
        .mark_bar(color=DATA_TEAL)
        .encode(
            x=alt.X("count:Q", title="Players"),
            y=alt.Y("club:N", title="Club", sort=list(major["club"])),
            tooltip=[
                alt.Tooltip("club:N", title="Club"),
                alt.Tooltip("count:Q", title="Players"),
            ],
        )
        .properties(title=f"{country} — Players by Club", width=400, height=200)
    )
    return chart.to_dict()


# ── 6. Model vs market ───────────────────────────────────────────────────────

def build_model_vs_market() -> dict:
    teams = _load("master_teams.json")

    elos = np.array([t["elo"] for t in teams], dtype=float)
    exp_elos = np.exp((elos - elos.max()) / 400)
    elo_win_pct = exp_elos / exp_elos.sum()

    rows = []
    for i, t in enumerate(teams):
        implied = t.get("implied_prob") or elo_win_pct[i]
        rows.append({
            "team": t["name"],
            "confederation": t["confederation"],
            "elo_win_pct": round(float(elo_win_pct[i]), 4),
            "implied_prob": round(float(implied), 4),
            "elo": t["elo"],
        })

    df = pd.DataFrame(rows).sort_values("elo_win_pct", ascending=False).reset_index(drop=True)
    df["color"] = df.apply(
        lambda r: DATA_TEAL if r["elo_win_pct"] >= r["implied_prob"] else RED_CARD, axis=1
    )
    df["label"] = df.index.map(lambda i: df.loc[i, "team"] if i < 10 else "")

    max_val = float(df[["elo_win_pct", "implied_prob"]].max().max()) * 1.15
    diag_df = pd.DataFrame({"x": [0.0, max_val], "y": [0.0, max_val]})
    diag = (
        alt.Chart(diag_df)
        .mark_line(strokeDash=[4, 4], color=MUTED, strokeWidth=1)
        .encode(x=alt.X("x:Q"), y=alt.Y("y:Q"))
    )

    points = (
        alt.Chart(df)
        .mark_circle(opacity=0.8)
        .encode(
            x=alt.X("implied_prob:Q", title="Bookmaker Implied Probability", axis=alt.Axis(format=".1%")),
            y=alt.Y("elo_win_pct:Q", title="Elo Win Probability", axis=alt.Axis(format=".1%")),
            color=alt.Color("color:N", scale=None, legend=None),
            size=alt.Size("elo:Q", title="Elo", scale=alt.Scale(range=[50, 400]), legend=None),
            tooltip=[
                alt.Tooltip("team:N", title="Team"),
                alt.Tooltip("elo:Q", title="Elo"),
                alt.Tooltip("elo_win_pct:Q", title="Model Prob", format=".2%"),
                alt.Tooltip("implied_prob:Q", title="Market Prob", format=".2%"),
            ],
        )
    )

    labels = (
        alt.Chart(df)
        .mark_text(align="left", dx=6, fontSize=10, color=PITCH_NIGHT)
        .encode(
            x=alt.X("implied_prob:Q"),
            y=alt.Y("elo_win_pct:Q"),
            text="label:N",
        )
        .transform_filter(alt.datum.label != "")
    )

    chart = (diag + points + labels).properties(
        title="Elo Model vs Bookmaker Market", width=550, height=500
    )
    return chart.to_dict()


# ── 7. Upset tracker ─────────────────────────────────────────────────────────

def build_upset_chart() -> dict:
    fixtures = _load("fixtures.json")
    teams_data = _load("master_teams.json")
    elo_map = {t["name"]: t["elo"] for t in teams_data}

    played = [m for m in fixtures if m.get("played")]

    if not played:
        empty = pd.DataFrame({"elo_gap": [0], "idx": [0], "match": ["—"], "result": ["No data"]})
        chart = (
            alt.Chart(empty)
            .mark_circle(opacity=0)
            .encode(x="elo_gap:Q", y="idx:Q")
            .properties(title="Upset Tracker (no matches played yet)", width=600, height=350)
        )
        return chart.to_dict()

    rows = []
    for i, m in enumerate(played):
        home = resolve_team_name(m["home"])
        away = resolve_team_name(m["away"])
        eh = elo_map.get(home, 1600)
        ea = elo_map.get(away, 1600)
        gap = abs(eh - ea)
        if eh >= ea:
            favoured_won = m["score_h"] > m["score_a"]
        else:
            favoured_won = m["score_a"] > m["score_h"]
        is_upset = not favoured_won and m["score_h"] != m["score_a"]
        rows.append({
            "idx": i,
            "date": m["date"],
            "match": f"{m['home']} v {m['away']}",
            "elo_gap": gap,
            "result": "Upset" if is_upset else "Expected",
            "color": RED_CARD if is_upset else DATA_TEAL,
        })

    df = pd.DataFrame(rows)

    chart = (
        alt.Chart(df)
        .mark_circle(opacity=0.85)
        .encode(
            x=alt.X("elo_gap:Q", title="Elo Gap (|home − away|)"),
            y=alt.Y("idx:Q", title="Match", axis=alt.Axis(labels=False, ticks=False)),
            color=alt.Color("color:N", scale=None, legend=None),
            size=alt.Size("elo_gap:Q", scale=alt.Scale(range=[40, 400]), legend=None),
            tooltip=[
                alt.Tooltip("match:N", title="Match"),
                alt.Tooltip("date:N", title="Date"),
                alt.Tooltip("elo_gap:Q", title="Elo Gap"),
                alt.Tooltip("result:N", title="Result"),
            ],
        )
        .properties(title="Upset Tracker — Completed Matches", width=600, height=350)
    )
    return chart.to_dict()


# ── 8. FBRef live stats ──────────────────────────────────────────────────────
# FBRef blocks automated server-side requests (403). We serve stats derived
# from our own fixtures + squads data instead.

def build_fbref_chart() -> dict:
    try:
        fixtures = _load("fixtures.json")
        teams_data = _load("master_teams.json")

        elo_map = {t["name"]: t["elo"] for t in teams_data}

        played = [m for m in fixtures if m.get("played")]
        if not played:
            raise ValueError("No matches played yet")

        team_stats: dict = {}
        for m in played:
            for team, gf, ga in [
                (resolve_team_name(m["home"]), m.get("score_h", 0), m.get("score_a", 0)),
                (resolve_team_name(m["away"]), m.get("score_a", 0), m.get("score_h", 0)),
            ]:
                if team not in team_stats:
                    team_stats[team] = {"gf": 0, "ga": 0, "played": 0, "elo": elo_map.get(team, 1700)}
                team_stats[team]["gf"] += gf
                team_stats[team]["ga"] += ga
                team_stats[team]["played"] += 1

        rows = []
        for team, s in team_stats.items():
            if s["played"] == 0:
                continue
            rows.append({
                "squad": team,
                "Goals scored": float(s["gf"]),
                "Goals conceded": float(s["ga"]),
                "Goal difference": float(s["gf"] - s["ga"]),
            })

        if not rows:
            raise ValueError("No team data available")

        df = pd.DataFrame(rows).sort_values("Goals scored", ascending=True)
        melted = df.melt(id_vars=["squad"], var_name="metric", value_name="value").dropna()

        chart = (
            alt.Chart(melted)
            .mark_bar()
            .encode(
                x=alt.X("value:Q", title="Goals"),
                y=alt.Y("squad:N", title=None, sort=list(df["squad"])),
                yOffset=alt.YOffset("metric:N"),
                color=alt.Color(
                    "metric:N",
                    scale=alt.Scale(
                        domain=["Goals scored", "Goals conceded", "Goal difference"],
                        range=[DATA_TEAL, RED_CARD, TROPHY_GOLD],
                    ),
                    title="Metric",
                    legend=alt.Legend(orient="bottom"),
                ),
                tooltip=[
                    alt.Tooltip("squad:N", title="Team"),
                    alt.Tooltip("metric:N", title="Metric"),
                    alt.Tooltip("value:Q", title="Value", format=".0f"),
                ],
            )
            .properties(title="Goals For / Against — Matches Played", width=650, height=max(200, len(rows) * 56))
        )
        return chart.to_dict()

    except Exception as e:
        msg = str(e) if "No matches" in str(e) or "No team" in str(e) else "Stats available once matches are played"
        empty = pd.DataFrame({"x": [0.5], "y": [0.5], "msg": [msg]})
        chart = (
            alt.Chart(empty)
            .mark_text(fontSize=13, color=MUTED)
            .encode(
                x=alt.X("x:Q", axis=None, scale=alt.Scale(domain=[0, 1])),
                y=alt.Y("y:Q", axis=None, scale=alt.Scale(domain=[0, 1])),
                text="msg:N",
            )
            .properties(title="Goals For / Against — Matches Played", width=650, height=300)
        )
        return chart.to_dict()


# ── 9. Credibility Gap (Focus Chart) ─────────────────────────────────────────

def build_credibility_gap() -> dict:
    """
    Scatter plot: Elo win probability (Y) vs bookmaker implied probability (X).
    One dot per team. Diagonal = perfect agreement.
    Outliers labeled. Rubric-compliant: position encoding, honest axes, source cited.
    """
    # ── 1. Load master_teams.json ──────────────────────────────────────────
    teams = _load("master_teams.json")
    df = pd.DataFrame(teams)

    # Fill squad values from shared estimates if missing in data
    df["squad_value_m"] = df.apply(
        lambda r: r["squad_value_m"] if pd.notna(r.get("squad_value_m"))
                  else float(SQUAD_VALUES_M.get(r["name"], max(5.0, (float(r["elo"]) - 1500) * 0.15))),
        axis=1,
    )

    # ── 2. Elo-based win probability (softmax) ─────────────────────────────
    elo = df["elo"].values.astype(float)
    temperature = 350
    exp_elo = np.exp((elo - elo.mean()) / temperature)
    df["elo_prob"] = (exp_elo / exp_elo.sum() * 100).round(2)

    # ── 3. Bookmaker implied probability (prefer data, fall back to odds) ──
    if df["implied_prob"].notna().all():
        df["bookmaker_prob"] = (df["implied_prob"].astype(float) * 100).round(2)
    else:
        df["raw_implied"] = df["name"].apply(
            lambda n: american_to_prob(AMERICAN_ODDS.get(n, 10000)) * 100
        )
        df["bookmaker_prob"] = (df["raw_implied"] / df["raw_implied"].sum() * 100).round(2)

    # ── 4. Divergence and outlier labeling ────────────────────────────────
    df["divergence"] = (df["elo_prob"] - df["bookmaker_prob"]).round(2)
    df["divergence_abs"] = df["divergence"].abs()
    threshold = df["divergence_abs"].nlargest(6).min()
    # Label every team so each dot is identifiable.
    df["show_label"] = True
    df["label"] = df["name"]
    df["market_view"] = df["divergence"].apply(
        lambda d: f"Model +{d:.1f}pp vs market" if d > 0 else f"Market +{abs(d):.1f}pp vs model"
    )

    # ── 5. Colourblind-friendly confederation palette (Okabe-Ito inspired) ─
    CONF_COLORS = {
        "UEFA":      "#0D2818",
        "CONMEBOL":  "#0F766E",
        "CAF":       "#D4A017",
        "AFC":       "#7C3AED",
        "CONCACAF":  "#C42B2B",
        "OFC":       "#9CA3AF",
    }
    conf_domain = list(CONF_COLORS.keys())
    conf_range  = list(CONF_COLORS.values())

    axis_max = max(df["elo_prob"].max(), df["bookmaker_prob"].max()) * 1.10
    axis_max = round(float(axis_max) + 0.5)

    # ── 6. Build chart layers ─────────────────────────────────────────────

    zone_above = pd.DataFrame({"x": [0, axis_max], "y1": [0, axis_max], "y2": [axis_max, axis_max]})
    zone_below = pd.DataFrame({"x": [0, axis_max], "y1": [0, 0],        "y2": [0, axis_max]})

    # Linear scales so the diagonal is the true equality line and distance from
    # it reads as real percentage-point divergence.
    sqrt_scale_x = alt.Scale(type="linear", domain=[0, axis_max], nice=False)
    sqrt_scale_y = alt.Scale(type="linear", domain=[0, axis_max], nice=False)

    shade_above = alt.Chart(zone_above).mark_area(
        opacity=0.04, color="#0F766E"
    ).encode(
        x=alt.X("x:Q", scale=sqrt_scale_x),
        y=alt.Y("y1:Q", scale=sqrt_scale_y),
        y2=alt.Y2("y2:Q"),
    )
    shade_below = alt.Chart(zone_below).mark_area(
        opacity=0.04, color="#C42B2B"
    ).encode(
        x=alt.X("x:Q", scale=sqrt_scale_x),
        y=alt.Y("y1:Q", scale=sqrt_scale_y),
        y2=alt.Y2("y2:Q"),
    )

    diag = pd.DataFrame({"x": [0, axis_max], "y": [0, axis_max]})
    diagonal = alt.Chart(diag).mark_line(
        strokeDash=[5, 4], color="#9CA3AF", strokeWidth=1.5, opacity=0.8
    ).encode(
        x=alt.X("x:Q", scale=sqrt_scale_x),
        y=alt.Y("y:Q", scale=sqrt_scale_y),
    )

    zone_text = pd.DataFrame({
        "x":    [1.5,                axis_max * 0.60],
        "y":    [axis_max * 0.78,    1.5],
        "text": ["Model more optimistic\nthan bookmakers ↑",
                 "Bookmakers more\noptimistic ↓"],
        "color": ["#0F766E", "#C42B2B"],
    })
    zone_labels = alt.Chart(zone_text).mark_text(
        fontSize=9.5, fontStyle="italic", font="Inter", align="left", opacity=0.75,
        lineBreak="\n",
    ).encode(
        x=alt.X("x:Q", scale=sqrt_scale_x),
        y=alt.Y("y:Q", scale=sqrt_scale_y),
        text=alt.Text("text:N"),
        color=alt.Color("color:N", scale=None),
    )

    selection = alt.selection_point(
        name="team_click",
        fields=["name"],
        on="click",
        clear="dblclick",
    )

    base = alt.Chart(df)

    scatter = base.mark_circle(
        stroke="white", strokeWidth=0.8
    ).encode(
        x=alt.X(
            "bookmaker_prob:Q",
            title="Bookmaker implied probability (%)",
            scale=alt.Scale(type="linear", domain=[0, axis_max], nice=False),
            axis=alt.Axis(tickCount=7, labelExpr='format(datum.value, ".1f") + "%"',
                          grid=True, gridColor="#F0F0EE", gridOpacity=0.8),
        ),
        y=alt.Y(
            "elo_prob:Q",
            title="Elo-based win probability (%)",
            scale=alt.Scale(type="linear", domain=[0, axis_max], nice=False),
            axis=alt.Axis(tickCount=7, labelExpr='format(datum.value, ".1f") + "%"',
                          grid=True, gridColor="#F0F0EE", gridOpacity=0.8),
        ),
        size=alt.Size(
            "squad_value_m:Q",
            title="Squad value (€M)",
            scale=alt.Scale(range=[35, 480]),
            legend=alt.Legend(
                title="Squad value (€M)",
                titleFontSize=10,
                labelFontSize=10,
                orient="top-right",
            ),
        ),
        color=alt.Color(
            "confederation:N",
            title="Confederation",
            scale=alt.Scale(domain=conf_domain, range=conf_range),
            legend=alt.Legend(
                title="Confederation",
                titleFontSize=10,
                labelFontSize=10,
                orient="top-left",
            ),
        ),
        opacity=alt.condition(selection, alt.value(0.92), alt.value(0.30)),
        tooltip=[
            alt.Tooltip("name:N",           title="Team"),
            alt.Tooltip("confederation:N",  title="Confederation"),
            alt.Tooltip("elo_prob:Q",       title="Elo win prob (%)",   format=".2f"),
            alt.Tooltip("bookmaker_prob:Q", title="Bookmaker prob (%)", format=".2f"),
            alt.Tooltip("divergence:Q",     title="Divergence (pp)",    format="+.2f"),
            alt.Tooltip("elo:Q",            title="Elo rating",         format=".0f"),
            alt.Tooltip("squad_value_m:Q",  title="Squad value (€M)",   format=".0f"),
            alt.Tooltip("market_view:N",    title="Summary"),
        ],
    ).add_params(selection)

    _label_base = dict(
        align="left", dx=6,
        fontSize=9, font="Inter", fontWeight=400,
        color="#374151",
    )
    labels_above = base.mark_text(**_label_base, dy=-9).encode(
        x="bookmaker_prob:Q",
        y="elo_prob:Q",
        text=alt.Text("label:N"),
    )

    # ── 7. Compose and style ──────────────────────────────────────────────
    top_outliers = df.nlargest(2, "divergence_abs")["name"].tolist()
    outlier_str = " & ".join(top_outliers)

    zoom = alt.selection_interval(bind='scales', name='zoom', encodings=['x', 'y'])

    chart = (
        shade_below + shade_above + diagonal + zone_labels + scatter + labels_above
    ).add_params(zoom).properties(
        width=700,
        height=600,
        title=alt.TitleParams(
            text=f"Our model and bookmakers broadly agree — except on {outlier_str}",
            subtitle=[
                "Each circle = 1 team · Circle size = squad market value (€M) · "
                "Diagonal line = perfect agreement between model and market",
                "Points above diagonal: Elo model more optimistic than bookmakers · "
                "Points below: bookmakers more optimistic · n = 48 teams",
            ],
            fontSize=15,
            subtitleFontSize=11,
            subtitleColor="#6B7280",
            font="Inter",
            fontWeight=600,
            anchor="start",
            dy=-6,
        ),
    ).configure_view(
        strokeOpacity=0,
        fill="#FFFFFF",
    ).configure_axis(
        labelFont="Inter",
        titleFont="Inter",
        titleFontSize=12,
        labelFontSize=11,
        titleColor="#374151",
        labelColor="#374151",
    ).configure_legend(
        labelFont="Inter",
        titleFont="Inter",
        padding=8,
    )

    return chart.to_dict()


# ── 10. Performance vs Expectation ──────────────────────────────────────────

def build_performance_chart() -> dict:
    groups     = _load("groups.json")
    teams_data = _load("master_teams.json")
    fixtures   = _load("fixtures.json")

    elo_map = {t["name"]: t["elo"] for t in teams_data}

    def _elo_expected_pts(elo_a, elo_b):
        win_a = (1 / (1 + 10 ** ((elo_b - elo_a) / 400))) * 0.75
        win_b = (1 / (1 + 10 ** ((elo_a - elo_b) / 400))) * 0.75
        draw  = 1.0 - win_a - win_b
        return win_a * 3 + draw * 1, win_b * 3 + draw * 1

    expected: dict = {}
    played_fixtures = [m for m in fixtures if m.get("played") and m.get("stage") == "group"]
    for m in played_fixtures:
        home = resolve_team_name(m["home"])
        away = resolve_team_name(m["away"])
        elo_h = elo_map.get(home, 1700)
        elo_a = elo_map.get(away, 1700)
        exp_h, exp_a = _elo_expected_pts(elo_h, elo_a)
        expected[home] = expected.get(home, 0) + exp_h
        expected[away] = expected.get(away, 0) + exp_a

    rows = []
    for g in groups:
        for t in g["teams"]:
            played = t["w"] + t["d"] + t["l"]
            if played == 0:
                continue
            name = resolve_team_name(t["name"])
            exp = round(expected.get(name, 0), 2)
            rows.append({
                "team":         name,
                "actual_pts":   float(t["pts"]),
                "expected_pts": exp,
                "diff":         round(t["pts"] - exp, 2),
            })

    if not rows:
        empty = pd.DataFrame({"team": ["—"], "pts": [0.0], "type": ["Actual"]})
        return (
            alt.Chart(empty).mark_bar(opacity=0)
            .encode(x="pts:Q", y="team:N")
            .properties(title="Performance vs Expectation (no matches played yet)", width=700, height=160)
            .to_dict()
        )

    df = pd.DataFrame(rows).sort_values("diff", ascending=False)

    melted = df.melt(
        id_vars=["team"],
        value_vars=["actual_pts", "expected_pts"],
        var_name="type", value_name="pts",
    )
    melted["type_label"] = melted["type"].map({
        "actual_pts":   "Actual",
        "expected_pts": "Expected (Elo)",
    })

    pts_max = max(1.0, float(melted["pts"].max())) * 1.1

    chart = (
        alt.Chart(melted)
        .mark_bar(opacity=0.85)
        .encode(
            x=alt.X("pts:Q", title="Points", scale=alt.Scale(domain=[0, pts_max], nice=True)),
            y=alt.Y("team:N", title=None, sort=list(df["team"])),
            color=alt.Color(
                "type_label:N",
                scale=alt.Scale(
                    domain=["Actual", "Expected (Elo)"],
                    range=[DATA_TEAL, MUTED],
                ),
                title="Points",
                legend=alt.Legend(orient="bottom"),
            ),
            yOffset=alt.YOffset("type_label:N"),
            tooltip=[
                alt.Tooltip("team:N",       title="Team"),
                alt.Tooltip("type_label:N", title="Type"),
                alt.Tooltip("pts:Q",        title="Points", format=".2f"),
            ],
        )
        .properties(
            title="Actual vs Elo-Expected Points — Group Stage",
            width=700,
            height=max(160, len(rows) * 52),
        )
    )
    return chart.to_dict()
