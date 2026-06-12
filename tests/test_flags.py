"""Regression tests for cross-platform flag asset mapping."""

from __future__ import annotations

import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from api.names import (  # noqa: E402
    TEAM_FLAG_CODES,
    flag_asset_url,
    flag_code_for,
    resolve_team_name,
)

DATA_DIR = ROOT / "data" / "processed"


class TestFlagAssets(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        with open(DATA_DIR / "master_teams.json", encoding="utf-8") as f:
            cls.teams = json.load(f)

    def test_all_master_teams_have_flag_codes(self):
        missing = [t["name"] for t in self.teams if t["name"] not in TEAM_FLAG_CODES]
        self.assertEqual(missing, [], f"Missing flag codes: {missing}")

    def test_master_teams_json_has_flag_urls(self):
        for team in self.teams:
            self.assertTrue(team.get("flag", "").startswith("https://flagcdn.com/"), team["name"])
            self.assertEqual(team.get("flag_code"), TEAM_FLAG_CODES[team["name"]])

    def test_flag_asset_url_format(self):
        url = flag_asset_url("France", width=40)
        self.assertEqual(url, "https://flagcdn.com/w40/fr.png")

    def test_special_subdivision_codes(self):
        self.assertEqual(flag_code_for("England"), "gb-eng")
        self.assertEqual(flag_code_for("Scotland"), "gb-sct")

    def test_alias_resolves_before_lookup(self):
        self.assertEqual(flag_code_for("USA"), "us")
        self.assertEqual(flag_code_for("Czech Republic"), "cz")
        self.assertEqual(resolve_team_name("USA"), "United States")


if __name__ == "__main__":
    unittest.main()
