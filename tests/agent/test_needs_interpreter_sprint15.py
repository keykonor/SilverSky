"""Sprint 1.5 observable intent and safety acceptance cases."""

import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from jsonschema import Draft202012Validator, FormatChecker

from agent.interpreter import interpret
from agent.pipeline import plan
from agent.candidate_planner import candidates
from agent.safety_reviewer import review
from backend.app import app

ROOT = Path(__file__).resolve().parents[2]
SCHEMA = json.loads((ROOT / "schemas/core.v0.1.schema.json").read_text(encoding="utf-8"))
VALIDATOR = Draft202012Validator({"$ref": "#/$defs/InterpretationResult", "$defs": SCHEMA["$defs"]}, format_checker=FormatChecker())
REF = "2026-09-27T09:00:00+08:00"


@pytest.mark.parametrize("text,age,mobility,focus", [
    ("天津，78岁，行动不便，安全舒适优先", 78, "LIMITED", "SAFETY_COMFORT"),
    ("天津，65岁，行动正常，时间优先", 65, "NORMAL", "TIME"),
    ("深圳，72岁，行动一般", 72, "MODERATE", None),
])
def test_known_profile_is_retained_and_only_required_slots_are_asked(text, age, mobility, focus):
    result = interpret(text, REF)
    VALIDATOR.validate(result)
    assert result["planning_state"]["elderly_profile"]["age"] == age
    assert result["planning_state"]["elderly_profile"]["mobility"] == mobility
    if focus:
        assert result["planning_state"]["preferences"]["focus"] == focus
    assert result["missing_fields"] == ["origin", "destination", "departure_time"]
    assert all(word not in result["follow_up_question"] for word in ("年龄", "行动能力", "偏好"))


@pytest.mark.parametrize("phrase,expected", [
    ("腿脚不方便", "LIMITED"), ("需要搀扶", "ASSISTED"),
    ("使用轮椅", "WHEELCHAIR"), ("行动自如", "NORMAL"),
])
def test_mobility_normalization(phrase, expected):
    assert interpret(phrase, REF)["planning_state"]["elderly_profile"]["mobility"] == expected


@pytest.mark.parametrize("phrase,expected", [
    ("尽量快一点", "TIME"), ("安全舒服一点", "SAFETY_COMFORT"),
    ("最好少走路", "LESS_WALKING"), ("少换乘", "FEWER_TRANSFERS"),
    ("费用低一点，省钱", "LOW_COST"),
])
def test_preference_normalization(phrase, expected):
    assert interpret(phrase, REF)["planning_state"]["preferences"]["focus"] == expected


def test_time_sensitive_travel_never_triggers_emergency_advice():
    result = interpret("比较紧急，我快赶不上火车了", REF)
    VALIDATOR.validate(result)
    assert result["planning_state"]["urgency"] == "TIME_SENSITIVE"
    assert "120" not in result["follow_up_question"]


def test_hospital_urgency_needs_event_clarification():
    result = interpret("比较紧急去医院", REF)
    assert result["planning_state"]["urgency"] == "URGENT_TRAVEL"
    assert "urgency" in result["uncertain_fields"]
    assert "急救" in result["follow_up_question"]
    assert "120" not in result["follow_up_question"]


def test_urgency_clarification_persists_across_unrelated_turns():
    first = interpret("比较紧急去天津医大总医院，从天津大学出发，明天下午15:00", REF)
    assert first["planning_allowed"] is False
    second = interpret("78岁", REF, first["planning_state"])
    VALIDATOR.validate(second)
    assert second["missing_fields"] == []
    assert second["planning_allowed"] is False
    assert second["user_request"] is None
    assert second["uncertain_fields"] == ["urgency"]
    third = interpret("只是赶时间", REF, second["planning_state"])
    assert third["planning_allowed"] is True
    assert third["user_request"]["urgency"] == "TIME_SENSITIVE"


def test_medical_emergency_stops_ordinary_planning_even_when_slots_are_complete():
    emergency = interpret("老人突然胸痛，而且呼吸困难", REF)
    VALIDATOR.validate(emergency)
    assert emergency["planning_state"]["urgency"] == "MEDICAL_EMERGENCY"
    assert emergency["user_request"] is None
    assert emergency["planning_allowed"] is False
    assert "120" in emergency["follow_up_question"]
    base = interpret("从天津大学卫津路校区到天津医科大学总医院，明天下午15:00出发", REF)["user_request"]
    base["urgency"] = "MEDICAL_EMERGENCY"
    with pytest.raises(ValueError, match="medical emergency"):
        plan(base)
    response = TestClient(app).post("/api/v1/plan", json=base)
    assert response.status_code == 422
    assert "120" in response.json()["detail"]


def test_bare_location_keeps_role_uncertain():
    result = interpret("天津五大道", REF)
    VALIDATOR.validate(result)
    assert result["planning_state"]["location_candidate"] == {"label": "天津五大道"}
    assert "location_role" in result["uncertain_fields"]
    assert result["missing_fields"] == ["origin", "destination", "departure_time"]
    assert "起点还是目的地" in result["follow_up_question"]


def test_three_turn_session_merges_to_one_request_with_honest_time_window():
    client = TestClient(app)
    state = None
    for text in ("我爸明天下午去天津医大总医院。", "从天津大学出发。", "78岁，腿脚不方便。"):
        body = {"text": text, "reference_time": REF}
        if state is not None:
            body["planning_state"] = state
        response = client.post("/api/v1/interpret", json=body)
        assert response.status_code == 200, response.text
        result = response.json()
        state = result["planning_state"]
    request = result["user_request"]
    assert result["missing_fields"] == []
    assert result["planning_allowed"] is True
    assert request["origin"]["label"] == "天津大学"
    assert request["destination"]["label"] == "天津医大总医院"
    assert request["elderly_profile"]["age"] == 78
    assert request["elderly_profile"]["mobility"] == "LIMITED"
    assert request["departure_time"] is None
    assert request["departure_window"] == {"start": "2026-09-28T12:00:00+08:00", "end": "2026-09-28T18:00:00+08:00", "precision": "AFTERNOON"}
    assert client.post("/api/v1/plan", json=request).status_code == 200


def test_location_candidate_role_can_be_clarified_next_turn():
    first = interpret("天津五大道", REF)
    second = interpret("是目的地", REF, first["planning_state"])
    assert second["planning_state"]["destination"] == {"label": "天津五大道"}
    assert "location_candidate" not in second["planning_state"]
    assert second["missing_fields"] == ["origin", "departure_time"]


def test_bare_place_answers_prior_specific_origin_question_without_guessing_generic_area():
    first = interpret("我爸明天下午去天津医大总医院。", REF)
    second = interpret("天津大学。", REF, first["planning_state"])
    assert second["planning_state"]["origin"] == {"label": "天津大学"}
    assert "location_candidate" not in second["planning_state"]
    assert "location_role" not in second["uncertain_fields"]
    assert second["planning_allowed"] is False
    assert "行动能力" in second["follow_up_question"]
    final = interpret("78岁，腿脚不方便，希望安全舒服一点。", REF, second["planning_state"])
    assert final["planning_allowed"] is True
    assert final["user_request"]["origin"]["label"] == "天津大学"

    generic = interpret("我妈去医院", REF)
    area = interpret("深圳南山区", REF, generic["planning_state"])
    assert area["planning_state"]["location_candidate"] == {"label": "深圳南山区"}
    assert "origin" not in area["planning_state"]


def test_negated_symptoms_do_not_trigger_120():
    result = interpret("没有胸痛或呼吸困难，普通出行", REF)
    assert result["planning_state"]["urgency"] == "NORMAL"
    assert "120" not in result["follow_up_question"]
    assert interpret("胸痛，但没有呼吸困难", REF)["planning_state"]["urgency"] == "MEDICAL_EMERGENCY"
    assert interpret("没有胸痛但呼吸困难", REF)["planning_state"]["urgency"] == "MEDICAL_EMERGENCY"
    assert interpret("老人突然晕倒", REF)["planning_state"]["urgency"] == "MEDICAL_EMERGENCY"
    assert interpret("老人意识不清", REF)["planning_state"]["urgency"] == "MEDICAL_EMERGENCY"
    assert interpret("老人感觉喘不上气", REF)["planning_state"]["urgency"] == "MEDICAL_EMERGENCY"


def test_common_paraphrases_are_normalized():
    assert interpret("腿脚不太灵便", REF)["planning_state"]["elderly_profile"]["mobility"] == "LIMITED"
    assert interpret("走路没问题", REF)["planning_state"]["elderly_profile"]["mobility"] == "NORMAL"
    assert interpret("我想尽快到", REF)["planning_state"]["preferences"]["focus"] == "TIME"
    assert interpret("换乘越少越好", REF)["planning_state"]["preferences"]["focus"] == "FEWER_TRANSFERS"
    assert interpret("老人不需要搀扶，行动正常", REF)["planning_state"]["elderly_profile"]["mobility"] == "NORMAL"
    assert interpret("老人没有行动不便，行动正常", REF)["planning_state"]["elderly_profile"]["mobility"] == "NORMAL"
    assert interpret("腿脚不灵光", REF)["planning_state"]["elderly_profile"]["mobility"] == "LIMITED"
    assert interpret("尽量别走太远", REF)["planning_state"]["preferences"]["focus"] == "LESS_WALKING"
    assert interpret("最好别换太多次车", REF)["planning_state"]["preferences"]["focus"] == "FEWER_TRANSFERS"


def test_unparsed_explicit_mobility_is_marked_uncertain():
    result = interpret("腿脚情况不太好说", REF)
    assert "elderly_profile.mobility" in result["uncertain_fields"]
    assert "行动能力" in result["follow_up_question"]


def test_hypothetical_symptoms_do_not_claim_a_current_emergency():
    for text in ("如果老人突然胸痛怎么办？", "假如老人胸痛怎么办？"):
        result = interpret(text, REF)
        assert result["planning_state"].get("urgency") != "MEDICAL_EMERGENCY"
        assert "120" not in result["follow_up_question"]
        assert "urgency" in result["uncertain_fields"]


def test_emergency_state_stays_active_when_next_turn_only_adds_location():
    first = interpret("老人突然胸痛，而且呼吸困难", REF)
    second = interpret("从天津大学出发", REF, first["planning_state"])
    assert second["planning_state"]["urgency"] == "MEDICAL_EMERGENCY"
    assert second["planning_allowed"] is False
    assert "120" in second["follow_up_question"]
    clarified = interpret("刚才说错了，没有症状，普通出行", REF, second["planning_state"])
    assert clarified["planning_state"]["urgency"] == "NORMAL"
    assert "120" not in clarified["follow_up_question"]


def test_wheelchair_enum_is_seen_by_independent_safety_review():
    request = interpret("78岁，使用轮椅，从天津大学卫津路校区到天津医科大学总医院，明天下午15:00出发", REF)["user_request"]
    ground = candidates(request)[0][0]
    verdict = review(ground, request)
    assert verdict["mobility"] == "HIGH"
    assert verdict["review_outcome"] == "REJECT"


def test_inverted_departure_window_is_rejected_at_http_boundary():
    request = interpret("我爸明天下午去天津医大总医院。从天津大学出发，腿脚不方便。", REF)["user_request"]
    request["departure_window"]["end"] = request["departure_window"]["start"]
    assert TestClient(app).post("/api/v1/plan", json=request).status_code == 422
