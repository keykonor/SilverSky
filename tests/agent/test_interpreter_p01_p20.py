"""User supplied conversational acceptance examples P01–P20."""

import json
from pathlib import Path

import pytest
from jsonschema import Draft202012Validator, FormatChecker

from agent.interpreter import interpret


REF = "2026-09-27T09:00:00+08:00"
CORE = json.loads((Path(__file__).resolve().parents[2] / "schemas/core.v0.1.schema.json").read_text(encoding="utf-8"))
VALIDATOR = Draft202012Validator({"$ref": "#/$defs/InterpretationResult", "$defs": CORE["$defs"]}, format_checker=FormatChecker())


@pytest.mark.parametrize("text,mobility,focus,urgency", [
    ("天津，65岁，行动正常，时间优先", "NORMAL", "TIME", "UNKNOWN"),
    ("深圳，72岁，行动一般，最好少走路", "MODERATE", "LESS_WALKING", "UNKNOWN"),
    ("我爸腿脚还行，就是走多了容易累，别让我来回换车", "MODERATE", "FEWER_TRANSFERS", "UNKNOWN"),
    ("老人身体挺好的，我主要想快一点", "NORMAL", "TIME", "UNKNOWN"),
    ("我妈走不了太远，有电梯最好，贵一点没关系", "LIMITED", "LESS_WALKING", "UNKNOWN"),
    ("比较急，我快赶不上高铁了", "UNKNOWN", "BALANCED", "TIME_SENSITIVE"),
    ("比较急，要去医院复诊，人现在没什么不舒服", "UNKNOWN", "BALANCED", "TIME_SENSITIVE"),
    ("老人突然胸口很痛，还有点喘不上气", "UNKNOWN", "BALANCED", "MEDICAL_EMERGENCY"),
    ("老人腿脚不方便，但赶时间", "LIMITED", "TIME", "UNKNOWN"),
    ("我妈72，在深圳，正常能走，不过今天时间有点赶", "NORMAL", "BALANCED", "TIME_SENSITIVE"),
])
def test_profile_preference_and_urgency(text, mobility, focus, urgency):
    result = interpret(text, REF)
    VALIDATOR.validate(result)
    state = result["planning_state"]
    assert state.get("elderly_profile", {}).get("mobility", "UNKNOWN") == mobility
    assert state.get("preferences", {}).get("focus", "BALANCED") == focus
    assert state.get("urgency", "UNKNOWN") == urgency
    if urgency == "MEDICAL_EMERGENCY":
        assert result["planning_allowed"] is False
        assert "120" in result["follow_up_question"]
    else:
        assert "120" not in result["follow_up_question"]


def test_wheelchair_and_secondary_preferences():
    wheelchair = interpret("80岁，用轮椅，但是平时也能自己走一点", REF)
    assert wheelchair["planning_state"]["elderly_profile"]["wheelchair_requirement"] is True
    assert wheelchair["planning_state"]["elderly_profile"]["mobility"] == "WHEELCHAIR"
    assert "elderly_profile.mobility" in wheelchair["uncertain_fields"]
    assert interpret("我爸腿脚还行，就是走多了容易累，别让我来回换车", REF)["planning_state"]["elderly_profile"]["preferences"] == ["LESS_WALKING"]
    safety_time = interpret("安全第一，但是我希望越快越好", REF)["planning_state"]
    assert safety_time["preferences"]["focus"] == "TIME"
    assert "SAFETY_COMFORT" in safety_time["elderly_profile"]["preferences"]


def test_ambiguity_conflicts_and_places():
    place = interpret("天津五大道，明天下午，78岁", REF)
    assert place["planning_state"]["location_candidate"] == {"label": "天津五大道"}
    assert place["planning_state"]["departure_window"]["precision"] == "AFTERNOON"
    assert "location_role" in place["uncertain_fields"]
    route = interpret("从天津大学去天津医大总医院，明天下午，78岁，腿脚不方便", REF)
    assert route["user_request"]["departure_time"] is None
    assert route["user_request"]["departure_window"]["precision"] == "AFTERNOON"
    home = interpret("从家里去天津站，下午三点", REF)
    assert home["planning_state"]["origin"] == {"label": "家里"}
    assert "departure_time" in home["missing_fields"]
    assert "origin" in home["uncertain_fields"]
    conflict = interpret("不着急，但是二十分钟必须到", REF)
    assert "urgency" in conflict["uncertain_fields"]
    assistance = interpret("老人不需要陪同，不过最好有人陪着", REF)
    VALIDATOR.validate(assistance)
    assert "elderly_profile.assistance_requirement" in assistance["uncertain_fields"]
    assert assistance["planning_allowed"] is False
    vague = interpret("七十多岁吧，腿脚不是特别方便，明天下午从天大去医院，别太折腾", REF)
    assert vague["planning_state"]["elderly_profile"]["age"] is None
    assert vague["assumptions"]
    assert vague["planning_state"]["departure_window"]["precision"] == "AFTERNOON"


def test_two_short_conversations_retain_prior_turns():
    state = None
    for text in ("我爸明天下午去医院", "从天津大学走", "78岁，腿脚不方便", "天津医大总医院"):
        result = interpret(text, REF, state)
        state = result["planning_state"]
    assert result["user_request"] is not None
    assert result["user_request"]["origin"]["label"] == "天津大学"
    assert result["user_request"]["destination"]["label"] == "天津医大总医院"
    assert result["user_request"]["elderly_profile"]["age"] == 78

    state = None
    for text in ("我妈去医院", "深圳南山区", "72岁", "行动一般，少走点", "明天上午十点"):
        result = interpret(text, REF, state)
        state = result["planning_state"]
    assert state["destination"] == {"label": "医院"}
    assert state["location_candidate"] == {"label": "深圳南山区"}
    assert state["elderly_profile"]["age"] == 72
    assert state["elderly_profile"]["mobility"] == "MODERATE"
    assert state["departure_time"] == "2026-09-28T10:00:00+08:00"
