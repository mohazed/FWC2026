import os
import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from typing import List

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

from api.teams import get_all_teams, get_squad, get_standings
from api.matches import get_matches, get_h2h
from api.predict import predict_match, run_montecarlo
from collectors.live_scores import sync_live_scores

from charts.builders import (
    build_heatmap,
    build_elo_chart,
    build_wealth_chart,
    build_age_pyramid,
    build_league_chart,
    build_model_vs_market,
    build_upset_chart,
    build_fbref_chart,
    build_performance_chart,
)

REFRESH_INTERVAL = 600  # seconds (10 minutes)


async def _background_refresh():
    while True:
        await asyncio.sleep(REFRESH_INTERVAL)
        try:
            result = await asyncio.to_thread(sync_live_scores)
            print(f"[auto-refresh] {result}")
        except Exception as e:
            print(f"[auto-refresh] error: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Sync on startup so data is fresh immediately
    try:
        result = await asyncio.to_thread(sync_live_scores)
        print(f"[startup] live sync: {result}")
    except Exception as e:
        print(f"[startup] live sync failed: {e}")
    task = asyncio.create_task(_background_refresh())
    yield
    task.cancel()


app = FastAPI(title="WC 2026 Analytics Dashboard", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/static", StaticFiles(directory=os.path.join(BASE_DIR, "static")), name="static")


@app.get("/")
def root():
    return FileResponse(os.path.join(BASE_DIR, "static", "index.html"))


@app.get("/health")
def health():
    return JSONResponse({"status": "ok", "tournament": "FIFA World Cup 2026"})


# ── Data API ──────────────────────────────────────────────────────────────────

@app.get("/api/teams")
def api_teams():
    try:
        return JSONResponse(get_all_teams())
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)


@app.get("/api/squads/{country}")
def api_squad(country: str):
    try:
        return JSONResponse(get_squad(country))
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)


@app.get("/api/standings")
def api_standings():
    try:
        return JSONResponse(get_standings())
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)


@app.get("/api/matches")
def api_matches():
    try:
        return JSONResponse(get_matches())
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)


@app.get("/api/h2h/{team_a}/{team_b}")
def api_h2h(team_a: str, team_b: str):
    try:
        return JSONResponse(get_h2h(team_a, team_b))
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)


@app.get("/api/predict/{team_a}/{team_b}")
def api_predict(team_a: str, team_b: str):
    try:
        return JSONResponse(predict_match(team_a, team_b))
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)


@app.get("/api/montecarlo")
def api_montecarlo(n: int = Query(default=500, ge=100, le=2000)):
    try:
        return JSONResponse({"teams": run_montecarlo(n)})
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)


@app.post("/api/refresh")
def api_refresh():
    try:
        result = sync_live_scores()
        return JSONResponse(result)
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)


@app.get("/api/scorers")
def api_scorers():
    try:
        import json as _json
        path = os.path.join(BASE_DIR, "data", "processed", "scorers.json")
        if not os.path.exists(path):
            return JSONResponse([])
        with open(path) as f:
            return JSONResponse(_json.load(f))
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)


@app.get("/charts/performance")
def chart_performance():
    try:
        return JSONResponse(build_performance_chart())
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)


# ── Chart endpoints ───────────────────────────────────────────────────────────

@app.get("/charts/heatmap")
def chart_heatmap():
    try:
        return JSONResponse(build_heatmap())
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)


@app.get("/charts/elo")
def chart_elo(teams: List[str] = Query(default=["France", "Spain", "Brazil", "Argentina", "England"])):
    try:
        return JSONResponse(build_elo_chart(teams))
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)


@app.get("/charts/wealth")
def chart_wealth():
    try:
        return JSONResponse(build_wealth_chart())
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)


@app.get("/charts/age/{country}")
def chart_age(country: str):
    try:
        spec = build_age_pyramid(country)
        if not spec:
            return JSONResponse({"error": f"Country '{country}' not found"}, status_code=404)
        return JSONResponse(spec)
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)


@app.get("/charts/league/{country}")
def chart_league(country: str):
    try:
        spec = build_league_chart(country)
        if not spec:
            return JSONResponse({"error": f"Country '{country}' not found"}, status_code=404)
        return JSONResponse(spec)
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)


@app.get("/charts/scatter")
def chart_scatter():
    try:
        return JSONResponse(build_model_vs_market())
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)


@app.get("/charts/radar/{a}/{b}")
def chart_radar(a: str, b: str):
    try:
        from charts.builders import build_elo_chart
        return JSONResponse(build_elo_chart([a, b]))
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)


@app.get("/charts/upsets")
def chart_upsets():
    try:
        return JSONResponse(build_upset_chart())
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)


@app.get("/charts/fbref")
def chart_fbref():
    try:
        return JSONResponse(build_fbref_chart())
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)


@app.get("/charts/credibility-gap")
def chart_credibility_gap():
    try:
        from charts.builders import build_credibility_gap
        return JSONResponse(build_credibility_gap())
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)
