"""HTTP-level Golden Scenario checks using the real runtime Agent pipeline."""

from __future__ import annotations

import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from jsonschema import Draft202012Validator, FormatChecker

from backend.app import app


ROOT = Path(__file__).resolve().parents[2]
SCHEMA = json.loads((ROOT / "schemas/core.v0.1.schema.json").read_text(encoding="utf-8"))
RESULT_VALIDATOR = Draft202012Validator(SCHEMA, format_checker=FormatChecker())
client = TestClient(app)


@pytest.mark.parametrize("scenario", ["tj-001", "sz-001"])
def test_golden_interpret_to_safe_planning_result(scenario: str) -> None:
    fixture = json.loads((ROOT / "examples" / f"{scenario}.interpret.json").read_text(encoding="utf-8"))

    interpret_response = client.post("/api/v1/interpret", json=fixture)
    assert interpret_response.status_code == 200, interpret_response.text
    interpreted = interpret_response.json()
    assert interpreted["missing_fields"] == []
    assert interpreted["user_request"] is not None

    plan_response = client.post("/api/v1/plan", json=interpreted["user_request"])
    assert plan_response.status_code == 200, plan_response.text
    planned = plan_response.json()
    assert not list(RESULT_VALIDATOR.iter_errors(planned))
    assert planned["user_request"] == interpreted["user_request"]
    assert 2 <= len(planned["route_options"]) <= 3
    assert {option["route_type"] for option in planned["route_options"]} == {
        "GROUND_ONLY",
        "GROUND_AIR_GROUND",
    }
    for option in planned["route_options"]:
        assert option["risk_assessment"]["reasons"]
        assert option["explanation"]
        if option["route_type"] == "GROUND_AIR_GROUND":
            assert "SIMULATED_SCENARIO" in option["display_labels"]
            assert "RECOMMENDED" not in option["display_labels"]
            assert option["data_status"] in ("SIMULATED_DATA", "DATA_UNAVAILABLE")
