"""Sprint 1 HTTP boundary for the SilverSky planning pipeline."""

from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from typing import Any

from fastapi import Body, FastAPI, HTTPException
from jsonschema import Draft202012Validator, FormatChecker


_SCHEMA_PATH = Path(__file__).resolve().parents[1] / "schemas" / "core.v0.1.schema.json"
_CORE_SCHEMA = json.loads(_SCHEMA_PATH.read_text(encoding="utf-8"))
Draft202012Validator.check_schema(_CORE_SCHEMA)
_VALIDATORS = {
    name: Draft202012Validator(
        {
            "$schema": _CORE_SCHEMA["$schema"],
            "$ref": f"#/$defs/{name}",
            "$defs": _CORE_SCHEMA["$defs"],
        },
        format_checker=FormatChecker(),
    )
    for name in ("TextInterpretRequest", "InterpretationResult", "UserRequest", "PlanningResult")
}

app = FastAPI(title="SilverSky AI", version="0.1-proposal")

from backend.v2 import router as v2_router
from backend.flight_simulation import router as flight_simulation_router
app.include_router(v2_router)
app.include_router(flight_simulation_router)


def _validate_request(contract: str, payload: dict[str, Any]) -> None:
    error = next(_VALIDATORS[contract].iter_errors(payload), None)
    if error is not None:
        raise HTTPException(
            status_code=422,
            detail={
                "message": "Request does not match the SilverSky contract",
                "path": ["body", *error.absolute_path],
                "reason": error.message,
            },
        )
    window = payload.get("departure_window") if contract == "UserRequest" else payload.get("planning_state", {}).get("departure_window") if contract == "TextInterpretRequest" else None
    if window and datetime.fromisoformat(window["start"]) >= datetime.fromisoformat(window["end"]):
        raise HTTPException(status_code=422, detail="Departure window must end after it starts")


def _validate_response(contract: str, payload: Any) -> None:
    if not _VALIDATORS[contract].is_valid(payload):
        raise HTTPException(
            status_code=500,
            detail="Planning service produced an invalid response",
        )


def _interpret(text: str, reference_time: str, planning_state: dict | None = None) -> dict[str, Any]:
    from agent.interpreter import interpret

    return interpret(text, reference_time, planning_state)


def _plan(user_request: dict[str, Any]) -> dict[str, Any]:
    from agent.pipeline import plan

    return plan(user_request)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/v1/interpret")
def interpret_request(payload: dict[str, Any] = Body(...)) -> dict[str, Any]:
    _validate_request("TextInterpretRequest", payload)
    result = _interpret(payload["text"], payload["reference_time"], payload["planning_state"]) if "planning_state" in payload else _interpret(payload["text"], payload["reference_time"])
    _validate_response("InterpretationResult", result)
    return result


@app.post("/api/v1/plan")
def plan_request(payload: dict[str, Any] = Body(...)) -> dict[str, Any]:
    _validate_request("UserRequest", payload)
    if payload["urgency"] == "MEDICAL_EMERGENCY":
        raise HTTPException(status_code=422, detail="请优先联系 120 或当地紧急医疗服务；SilverSky 不能替代急救系统。")
    result = _plan(payload)
    _validate_response("PlanningResult", result)
    return result


@app.get("/api/v1/reality/places")
def reality_places(query: str, city: str) -> dict[str, Any]:
    from backend.ground_reality import AmapGroundRealityProvider, CITY_NAMES

    if city not in (*CITY_NAMES, "ALL") or not 1 <= len(query.strip()) <= 80:
        raise HTTPException(status_code=422, detail="请提供具体地点名称。")
    try:
        return AmapGroundRealityProvider().search_places(query, city)
    except (RuntimeError, OSError, ValueError, TypeError, AttributeError, KeyError, json.JSONDecodeError):
        return {"status": "DATA_UNAVAILABLE", "candidates": [], "message": "在线地点搜索暂不可用，请提供具体地点并核实。"}


@app.post("/api/v1/reality/ground")
def reality_ground(payload: dict[str, Any] = Body(...)) -> dict[str, Any]:
    from backend.ground_reality import AmapGroundRealityProvider, ground_reference

    try:
        return ground_reference(AmapGroundRealityProvider(), payload.get("city"), payload.get("origin_query"), payload.get("destination_query"))
    except ValueError:
        raise HTTPException(status_code=422, detail="请提供天津或深圳的具体起终点。")


@app.post("/api/v1/reality/route-by-id")
def reality_route_by_id(payload: dict[str, Any] = Body(...)) -> dict[str, Any]:
    from backend.ground_reality import AmapGroundRealityProvider, ground_reference_by_ids

    try:
        return ground_reference_by_ids(AmapGroundRealityProvider(), payload.get("origin_id"), payload.get("destination_id"))
    except ValueError:
        raise HTTPException(status_code=422, detail="请先从搜索结果中选择具体的天津起点和目的地。")
