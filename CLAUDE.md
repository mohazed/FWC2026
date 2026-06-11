# WC 2026 Analytics Dashboard — Project Bible

## Project Context
FIFA World Cup 2026 interactive analytics dashboard built for Paris Dauphine IASD
data visualization project. Tournament: June 11 – July 19, 2026.
Goal: professional web dashboard crossing 12 data sources, not a Streamlit prototype.

## Architecture (read before writing any code)
- **Backend**: FastAPI (Python) runs at localhost:8000
- **Frontend**: Vanilla HTML + CSS custom properties + Vanilla JS — NO npm, NO build step
- **Chart bridge**: Altair `.to_dict()` → FastAPI JSON endpoint → `vega-embed.js` renders in browser
- **Hero charts**: D3.js v7 for radar, Monte Carlo bracket, probability gauges
- **Data**: JSON files in `data/processed/` — no database needed
- **Start command**: `uvicorn app:app --reload`

## Design System — NEVER deviate from these values

### CSS Custom Properties (put in :root)
```css
:root {
  /* Colors */
  --pitch-night:  #0D2818;   /* nav, hero bg, primary brand */
  --chalk-white:  #F5F3EF;   /* page background */
  --trophy-gold:  #D4A017;   /* winners, highlights, #1 */
  --red-card:     #C42B2B;   /* upsets, errors, eliminations */
  --slate:        #374151;   /* body text */
  --surface:      #FFFFFF;   /* card backgrounds */
  --pitch-mist:   #E8F0EB;   /* alt section bg, table stripes */
  --data-teal:    #0F766E;   /* positive stats, over-expected */
  --border:       #E2E8E4;   /* card/input borders */
  --muted:        #9CA3AF;   /* secondary labels */

  /* Typography */
  --font-display: 'Bebas Neue', sans-serif;   /* ONLY for scores, big nums, team names */
  --font-body:    'Inter', sans-serif;        /* all UI text */
  --font-data:    'Space Mono', monospace;    /* all %, Elo scores, odds */

  /* Spacing */
  --sp-xs: 4px;  --sp-sm: 8px;  --sp-md: 16px;  --sp-lg: 24px;  --sp-xl: 40px;

  /* Borders */
  --radius:    6px;
  --radius-lg: 12px;
  --shadow:    0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06);
  --shadow-md: 0 4px 6px rgba(0,0,0,0.07), 0 2px 4px rgba(0,0,0,0.06);
}
```

### Google Fonts import (put in <head>)
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;500;600;700&family=Space+Mono:ital,wght@0,400;0,700&display=swap" rel="stylesheet">
```

### CDN imports (put at end of <body>)
```html
<script src="https://cdn.jsdelivr.net/npm/vega@5"></script>
<script src="https://cdn.jsdelivr.net/npm/vega-lite@5"></script>
<script src="https://cdn.jsdelivr.net/npm/vega-embed@6"></script>
<script src="https://cdn.jsdelivr.net/npm/d3@7"></script>
```

## File Structure
```
wc2026/
├── app.py                        ← FastAPI: routes, static files, API, chart endpoints
├── requirements.txt
├── CLAUDE.md
├── .gitignore
├── data/
│   ├── raw/                      ← gitignored, manual Kaggle downloads go here
│   └── processed/
│       ├── master_teams.json     ← 48 teams, all metadata
│       ├── master_squads.json    ← 48 × 26 players
│       ├── fixtures.json         ← all 104 matches (scores update as played)
│       ├── groups.json           ← 12 groups with live standings
│       ├── elo_history.json      ← 4683 rows, Elo 1901–2026
│       └── matches_history.json  ← 964 WC matches 1930–2022
├── collectors/
│   ├── squads.py                 ← Wikipedia → master_squads.json
│   ├── fixtures.py               ← openfootball JSON → fixtures.json + groups.json
│   ├── elo.py                    ← Kaggle CSV → elo_history.json
│   └── teams.py                  ← merge all sources → master_teams.json
├── charts/
│   └── builders.py               ← all Altair chart functions returning .to_dict()
└── static/
    ├── index.html                ← single page, all 6 sections
    ├── style.css                 ← full design system
    ├── main.js                   ← navigation, fetch, vega-embed calls
    └── js/
        ├── radar.js              ← D3 team DNA radar chart
        └── bracket.js            ← D3 Monte Carlo bracket tree
```

## Chart Bridge Pattern (use for ALL Altair charts)

**Python — charts/builders.py**
```python
import altair as alt
import pandas as pd
import json

def build_age_pyramid(country: str) -> dict:
    with open("data/processed/master_squads.json") as f:
        squads = json.load(f)
    team = next((t for t in squads if t["country"] == country), None)
    if not team:
        return {}
    df = pd.DataFrame(team["players"])
    # ... chart building logic ...
    chart = alt.Chart(df).mark_bar().encode(...)
    return chart.to_dict()
```

**Python — app.py**
```python
from fastapi.responses import JSONResponse
from charts.builders import build_age_pyramid

@app.get("/charts/age/{country}")
def chart_age(country: str):
    try:
        return JSONResponse(build_age_pyramid(country))
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)
```

**HTML — static/index.html**
```html
<div id="chart-age" class="chart-container"></div>
```

**JavaScript — static/main.js**
```javascript
async function loadChart(elementId, endpoint, opts = {}) {
  try {
    const spec = await fetch(endpoint).then(r => r.json())
    if (spec.error) throw new Error(spec.error)
    await vegaEmbed(`#${elementId}`, spec, {
      renderer: 'svg',
      actions: false,
      theme: 'none',
      ...opts
    })
  } catch (err) {
    document.getElementById(elementId).innerHTML =
      `<p class="chart-error">Chart unavailable: ${err.message}</p>`
  }
}
```

## All API Endpoints

```
GET  /                              → index.html
GET  /api/teams                     → [{name, confederation, group, elo, fifa_rank, squad_value_m, flag}]
GET  /api/squads/{country}          → [{name, position, age, club, league, caps, goals, value_m}]
GET  /api/standings                 → [{group, teams:[{name,pts,gd,gf,ga,form,status}]}]
GET  /api/matches                   → [{date,stage,group,home,away,score_h,score_a,played}]
GET  /api/h2h/{team_a}/{team_b}     → [{year,stage,score_a,score_b,scorers}]
GET  /api/predict/{team_a}/{team_b} → {win_a,draw,win_b,elo_a,elo_b,bookie_a,bookie_b}
GET  /api/montecarlo                → {teams:[{name,qf_prob,sf_prob,final_prob,win_prob}]}
GET  /charts/heatmap                → Vega-Lite JSON
GET  /charts/elo                    → Vega-Lite JSON
GET  /charts/radar/{a}/{b}          → Vega-Lite JSON (or use D3 via /static/js/radar.js)
GET  /charts/wealth                 → Vega-Lite JSON
GET  /charts/age/{country}          → Vega-Lite JSON
GET  /charts/league/{country}       → Vega-Lite JSON
GET  /charts/scatter                → Vega-Lite JSON
GET  /charts/upsets                 → Vega-Lite JSON
GET  /charts/fbref                  → Vega-Lite JSON (live FBRef scrape)
```

## Elo Win Probability Formula
```python
def elo_win_prob(elo_a: float, elo_b: float) -> dict:
    """Returns win/draw/loss probabilities using Elo formula."""
    expected_a = 1 / (1 + 10 ** ((elo_b - elo_a) / 400))
    # Adjust for draw: ~25% of matches end in draws in WC group stage
    draw_adj = 0.25
    win_a = expected_a * (1 - draw_adj)
    win_b = (1 - expected_a) * (1 - draw_adj)
    draw = draw_adj
    return {"win_a": round(win_a, 3), "draw": round(draw, 3), "win_b": round(win_b, 3)}
```

## Monte Carlo Simulation
```python
import numpy as np

def run_montecarlo(n_sims=10000) -> list:
    """Simulate full WC tournament n_sims times, return win probabilities."""
    # Load groups and elo ratings from master_teams.json
    # For each sim: simulate all group matches using elo_win_prob()
    # Advance top 2 + 8 best 3rd place to knockouts
    # Simulate knockout bracket until champion
    # Count wins per team across all sims
    # Return sorted by win_prob descending
    pass  # implement fully
```

## Quality Standards (non-negotiable)
1. Every color in HTML/JS/CSS must use `var(--variable)` — no hardcoded hex
2. Every Altair chart needs: title, axis labels with units, tooltip with all fields
3. Every API endpoint: wrapped in try/except, returns `{"error": "..."}` on failure
4. Mobile responsive: works at 375px viewport width
5. Chart containers: `class="chart-container"` with `min-height: 300px`
6. vega-embed always called with `{ renderer: 'svg', actions: false, theme: 'none' }`
7. No `console.error` swallowing — always show error state in UI

## Build Order (strict — verify each phase before next)
1. `collectors/` — build and run all 4, verify `data/processed/` has 6 JSON files
2. `charts/builders.py` + `api/` modules + `app.py` — verify all endpoints with curl
3. `static/style.css` — open index.html in browser, verify design tokens visible
4. `static/index.html` — build section by section, verify each in browser
5. `static/js/radar.js` — verify radar renders for France vs Spain
6. `static/js/bracket.js` — verify bracket renders with mock data
7. `static/main.js` — verify all vega-embed charts load, nav scrolls work
