"""Regression tests for Vega-Lite chart builders."""

from __future__ import annotations

import json
import math
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from charts import builders  # noqa: E402


def _iter_dataset_rows(spec: dict):
    datasets = spec.get("datasets") or {}
    if not datasets and isinstance(spec.get("data"), dict):
        values = spec["data"].get("values")
        if values is not None:
            datasets = {"inline": values}
    for rows in datasets.values():
        if isinstance(rows, list):
            for row in rows:
                if isinstance(row, dict):
                    yield row


def _assert_valid_spec(testcase, spec: dict, name: str) -> None:
    testcase.assertIsInstance(spec, dict, f"{name}: expected dict")
    testcase.assertTrue(
        spec.get("$schema") or spec.get("mark") or spec.get("layer"),
        f"{name}: missing $schema/mark/layer",
    )
    if spec.get("$schema"):
        testcase.assertIn(
            "vega-lite/v5",
            spec["$schema"],
            f"{name}: schema must be Vega-Lite v5 (got {spec['$schema']})",
        )
    json.dumps(spec)  # must be JSON-serializable
    for row in _iter_dataset_rows(spec):
        for key, val in row.items():
            if isinstance(val, float):
                testcase.assertFalse(math.isnan(val), f"{name}: NaN in {key}")
                testcase.assertFalse(math.isinf(val), f"{name}: Inf in {key}")


class TestChartBuilders(unittest.TestCase):
    def test_heatmap(self):
        _assert_valid_spec(self, builders.build_heatmap(), "heatmap")

    def test_heatmap_confederation_filter(self):
        _assert_valid_spec(self, builders.build_heatmap("UEFA"), "heatmap UEFA")

    def test_elo_chart(self):
        _assert_valid_spec(
            self,
            builders.build_elo_chart(["France", "Spain", "Brazil"]),
            "elo",
        )

    def test_wealth_chart(self):
        _assert_valid_spec(self, builders.build_wealth_chart(), "wealth")

    def test_age_pyramid(self):
        _assert_valid_spec(self, builders.build_age_pyramid("France"), "age")

    def test_league_chart(self):
        _assert_valid_spec(self, builders.build_league_chart("France"), "league")

    def test_model_vs_market(self):
        _assert_valid_spec(self, builders.build_model_vs_market(), "scatter")

    def test_upset_chart(self):
        _assert_valid_spec(self, builders.build_upset_chart(), "upsets")

    def test_fbref_chart(self):
        _assert_valid_spec(self, builders.build_fbref_chart(), "fbref")

    def test_credibility_gap(self):
        _assert_valid_spec(self, builders.build_credibility_gap(), "credibility")

    def test_performance_chart(self):
        _assert_valid_spec(self, builders.build_performance_chart(), "performance")


if __name__ == "__main__":
    unittest.main()
