"""Regression tests for World Cup history heatmap and H2H data integrity."""

from __future__ import annotations

import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from api.history_utils import (  # noqa: E402
    collect_unmapped_stages,
    iter_mens_matches,
    normalize_team_name,
)
from api.matches import get_h2h  # noqa: E402
from charts.builders import build_heatmap  # noqa: E402

DATA_DIR = ROOT / "data" / "processed"


def _load(name: str):
    with open(DATA_DIR / name, encoding="utf-8") as f:
        return json.load(f)


class TestHistoryUtils(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.history = _load("matches_history.json")
        cls.teams = _load("master_teams.json")

    def test_all_mens_stages_mapped(self):
        unmapped = collect_unmapped_stages(self.history)
        self.assertEqual(unmapped, set(), f"Unmapped stages: {unmapped}")

    def test_womens_rows_excluded_from_mens_iterator(self):
        women = sum(
            1 for m in self.history if "Women" in (m.get("tournament_name") or "")
        )
        men = sum(1 for _m, _y in iter_mens_matches(self.history))
        self.assertEqual(len(self.history), men + women)

    def test_alias_normalization(self):
        self.assertEqual(normalize_team_name("West Germany"), "Germany")
        self.assertEqual(normalize_team_name("Zaire"), "DR Congo")
        self.assertEqual(normalize_team_name("Czech Republic"), "Czechia")


class TestHeatmap(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.spec = build_heatmap()
        data_ref = cls.spec["data"]["name"]
        cls.rows = cls.spec["datasets"][data_ref]
        cls.teams = {t["name"] for t in _load("master_teams.json")}

    def _team_year(self, team: str, year: int) -> dict | None:
        for row in self.rows:
            if row["team"] == team and row["year"] == year:
                return row
        return None

    def test_row_count_matches_grid(self):
        years = {row["year"] for row in self.rows}
        self.assertEqual(len(self.rows), len(self.teams) * len(years))

    def test_germany_includes_west_germany_era(self):
        row = self._team_year("Germany", 1954)
        self.assertIsNotNone(row)
        self.assertNotEqual(row["stage"], "No appearance")
        self.assertGreater(row["matches"], 0)

    def test_dr_congo_via_zaire(self):
        row = self._team_year("DR Congo", 1974)
        self.assertIsNotNone(row)
        self.assertNotEqual(row["stage"], "No appearance")
        self.assertGreater(row["matches"], 0)

    def test_czechia_via_czech_republic(self):
        row = self._team_year("Czechia", 2006)
        self.assertIsNotNone(row)
        self.assertNotEqual(row["stage"], "No appearance")

    def test_first_time_teams_show_no_appearance(self):
        for team in ("Uzbekistan", "Jordan", "Curaçao"):
            appearances = [r for r in self.rows if r["team"] == team and r["stage"] != "No appearance"]
            self.assertEqual(appearances, [], f"{team} should have no historical appearances")

    def test_no_appearance_has_zero_matches(self):
        for row in self.rows:
            if row["stage"] == "No appearance":
                self.assertEqual(row["matches"], 0)
                self.assertEqual(row["w"], 0)
                self.assertEqual(row["d"], 0)
                self.assertEqual(row["l"], 0)

    def test_stage_labels_use_new_vocabulary(self):
        stages = {row["stage"] for row in self.rows}
        self.assertNotIn("DNQ", stages)
        self.assertIn("No appearance", stages)


class TestH2H(unittest.TestCase):
    def test_h2h_excludes_womens_tournaments(self):
        results = get_h2h("France", "Norway")
        for r in results:
            self.assertNotIn("Women", r.get("tournament", ""))

    def test_h2h_exact_team_match(self):
        results = get_h2h("Germany", "Argentina")
        self.assertTrue(all(r["year"] for r in results))


if __name__ == "__main__":
    unittest.main()
