"""Contract checks for the HTTP boundary."""

from __future__ import annotations

import json
from copy import deepcopy
from pathlib import Path

from fastapi.testclient import TestClient

from backend import app as service


ROOT = Path(__file__).resolve().parents[2]
client = TestClient(service.app)


def _example(name: str) -> dict:
    return json.loads((ROOT / "examples" / name).read_text(encoding="utf-8"))


def test_health() -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_interpret_validates_input_and_output(monkeypatch) -> None:
    user_request = _example("user-request.v0.1.json")
    result = {
        "user_request": user_request,
        "needs_summary": "测试需求摘要",
        "missing_fields": [],
        "assumptions": [],
    }
    observed = []

    def fake_interpret(text: str, reference_time: str) -> dict:
        observed.append((text, reference_time))
        return result

    monkeypatch.setattr(service, "_interpret", fake_interpret)
    payload = {"text": "明天下午去医院", "reference_time": "2026-09-26T10:00:00+08:00"}
    response = client.post("/api/v1/interpret", json=payload)
    assert response.status_code == 200
    assert response.json() == result
    assert observed == [(payload["text"], payload["reference_time"])]


def test_interpret_rejects_missing_timezone_before_agent(monkeypatch) -> None:
    monkeypatch.setattr(service, "_interpret", lambda *_: (_ for _ in ()).throw(AssertionError()))
    response = client.post(
        "/api/v1/interpret",
        json={"text": "明天下午去医院", "reference_time": "2026-09-26T10:00:00"},
    )
    assert response.status_code == 422
    assert response.json()["detail"]["message"] == "Request does not match the SilverSky contract"


def test_plan_returns_contract_result(monkeypatch) -> None:
    user_request = _example("user-request.v0.1.json")
    result = _example("planning-result.v0.1.json")
    observed = []

    def fake_plan(request: dict) -> dict:
        observed.append(request)
        return result

    monkeypatch.setattr(service, "_plan", fake_plan)
    response = client.post("/api/v1/plan", json=user_request)
    assert response.status_code == 200
    assert response.json() == result
    assert observed == [user_request]


def test_plan_rejects_incomplete_profile_before_agent(monkeypatch) -> None:
    monkeypatch.setattr(service, "_plan", lambda *_: (_ for _ in ()).throw(AssertionError()))
    user_request = _example("user-request.v0.1.json")
    del user_request["elderly_profile"]["mobility"]
    response = client.post("/api/v1/plan", json=user_request)
    assert response.status_code == 422


def test_plan_does_not_emit_unreviewed_recommendation(monkeypatch) -> None:
    result = deepcopy(_example("planning-result.v0.1.json"))
    result["route_options"][0]["display_labels"] = ["RECOMMENDED"]
    result["route_options"][0]["risk_assessment"]["review_outcome"] = "UNKNOWN"
    monkeypatch.setattr(service, "_plan", lambda *_: result)
    response = client.post("/api/v1/plan", json=_example("user-request.v0.1.json"))
    assert response.status_code == 500
    assert response.json() == {"detail": "Planning service produced an invalid response"}
