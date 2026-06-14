# Live Data Refresh Runbook

Use this runbook after each World Cup match finishes and the deployed Vercel
site needs updated scores, standings, scorers, and live charts.

## What This Refresh Updates

The game-result-dependent dashboard data lives in:

- `data/processed/fixtures.json`: match scores, `played`, match count, goals,
  results strip, and live results.
- `data/processed/groups.json`: group standings, points, goal difference,
  goals for/against, wins, draws, and losses.
- `data/processed/scorers.json`: top scorers table.

The existing collector updates all three files:

```bash
python3 collectors/live_scores.py
```

It pulls from `https://worldcup26.ir/get/games`, updates finished matches in
`fixtures.json`, recomputes `groups.json`, and rebuilds `scorers.json`.

## Dashboard Areas Affected

These sections should change after a successful refresh:

- Overview: goals scored, matches played, average goals per match, standings,
  and the horizontal results strip.
- Live: results, top scorers, team stats, and performance vs expectation.
- Chart endpoints: `/charts/fbref`, `/charts/performance`, and `/charts/upsets`.

These sections usually do not need a live match refresh:

- History: uses `matches_history.json` and `elo_history.json`.
- Focus Chart: uses `master_teams.json`, Elo, and bookmaker inputs.
- Team DNA Explorer: uses team and squad data.
- Predict, H2H, and Monte Carlo: currently use Elo/team/group setup, not played
  match scores.

## Step-by-Step Refresh

1. Start from the project root:

```bash
cd /Users/mohorozovic/M2/S4/dataviz/project
```

2. Check current git state and note unrelated dirty files. Do not include
   unrelated files in the refresh commit.

```bash
git status --short
```

3. Run the live score collector:

```bash
python3 collectors/live_scores.py
```

Expected successful output looks like:

```text
{'synced': 3, 'matches_played': 6}
```

If the output contains `error`, stop and inspect whether the upstream feed is
down or whether the latest match has not been marked as `finished` yet.

4. Inspect the intended data diff:

```bash
git diff --stat -- data/processed/fixtures.json data/processed/groups.json data/processed/scorers.json
git diff -- data/processed/fixtures.json data/processed/groups.json data/processed/scorers.json
```

5. Verify the latest match manually:

- In `data/processed/fixtures.json`, the match should have `played: true` and
  correct `score_h` / `score_a`.
- In `data/processed/groups.json`, the affected group should have updated
  `pts`, `gd`, `gf`, `ga`, `w`, `d`, and `l`.
- In `data/processed/scorers.json`, scorers should update if the upstream feed
  includes scorer data.

Useful searches:

```bash
rg -C 4 "Brazil|Morocco" data/processed/fixtures.json data/processed/groups.json
rg -C 2 "\"player\"|\"goals\"" data/processed/scorers.json
```

6. Optionally verify local APIs:

```bash
uvicorn app:app --reload
curl http://127.0.0.1:8000/api/matches
curl http://127.0.0.1:8000/api/standings
curl http://127.0.0.1:8000/api/scorers
curl http://127.0.0.1:8000/charts/performance
curl http://127.0.0.1:8000/charts/fbref
```

7. Stage only the refreshed data files:

```bash
git add data/processed/fixtures.json data/processed/groups.json data/processed/scorers.json
```

If this runbook was changed intentionally, stage `refresh.md` too:

```bash
git add refresh.md
```

8. Commit:

```bash
git commit -m "Refresh live World Cup match data"
```

9. Push to production branch:

```bash
git push origin main
```

The repository is connected to Vercel, so pushing `main` should automatically
queue a production deployment.

10. Verify Vercel deploy is ready:

- Check the Vercel deployment for project `fwc-2026`.
- Wait until the latest deployment state is `READY`.
- Then open `https://worldcup2026-analytics.vercel.app` and hard refresh.

Production checks:

- Overview totals changed as expected.
- The latest result appears in the results strip.
- The affected group standings are correct.
- Live results show the latest match.
- Top scorers reflect any scorer data in the upstream feed.
- Team Stats and Performance vs Expectation render without chart errors.

## Important Vercel Constraint

Do not rely on the website's `Refresh` button for production data updates on
Vercel. In `app.py`, live sync is disabled whenever Vercel is detected because
serverless deployments cannot persist writes to JSON files:

```python
LIVE_SYNC_ENABLED = (
    os.getenv("ENABLE_LIVE_SYNC", "").lower() in ("1", "true", "yes")
    and not os.getenv("VERCEL")
)
```

The quick production path is always:

```text
run collector locally -> commit refreshed JSON -> push main -> Vercel deploy
```
