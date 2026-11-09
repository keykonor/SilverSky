"""Validate the core contract, safety regressions, and Sprint 1 datasets."""

import copy
import json
from pathlib import Path

from jsonschema import Draft202012Validator, FormatChecker


ROOT = Path(__file__).resolve().parents[1]
schema = json.loads((ROOT / "schemas/core.v0.1.schema.json").read_text(encoding="utf-8"))
request = json.loads((ROOT / "examples/user-request.v0.1.json").read_text(encoding="utf-8"))
result = json.loads((ROOT / "examples/planning-result.v0.1.json").read_text(encoding="utf-8"))

Draft202012Validator.check_schema(schema)
result_validator = Draft202012Validator(schema, format_checker=FormatChecker())
def validator_for(definition):
    return Draft202012Validator(
        {"$defs": schema["$defs"], "$ref": f"#/$defs/{definition}"},
        format_checker=FormatChecker(),
    )


request_validator = validator_for("UserRequest")
text_validator = validator_for("TextInterpretRequest")
interpretation_validator = validator_for("InterpretationResult")


def require_valid(validator, name, instance):
    errors = list(validator.iter_errors(instance))
    assert not errors, f"{name}: {errors[0].message if errors else ''}"


def require_invalid(name, instance):
    assert list(result_validator.iter_errors(instance)), f"{name}: expected rejection"


require_valid(request_validator, "UserRequest", request)
require_valid(result_validator, "PlanningResult", result)
require_valid(
    text_validator,
    "TextInterpretRequest",
    {"text": "明天下午三点从天津大学到医院", "reference_time": "2026-09-27T09:00:00+08:00"},
)
for fixture_path in sorted((ROOT / "examples").glob("*.interpret.json")):
    require_valid(text_validator, fixture_path.name, json.loads(fixture_path.read_text(encoding="utf-8")))
require_valid(
    interpretation_validator,
    "incomplete interpretation",
    {"user_request": None, "needs_summary": "待确认出发日期", "missing_fields": ["departure_time"], "assumptions": []},
)
require_valid(
    interpretation_validator,
    "complete interpretation",
    {"user_request": request, "needs_summary": "需核对行动需求", "missing_fields": [], "assumptions": []},
)
assert list(interpretation_validator.iter_errors({
    "user_request": request,
    "needs_summary": "日期缺失",
    "missing_fields": ["departure_time"],
    "assumptions": [],
})), "incomplete interpretation cannot contain a complete request"

window_request = copy.deepcopy(request)
window_request["departure_time"] = None
window_request["departure_window"] = {
    "start": "2026-09-28T12:00:00+08:00",
    "end": "2026-09-28T18:00:00+08:00",
    "precision": "AFTERNOON",
}
window_request["elderly_profile"]["mobility"] = "MODERATE"
window_request["preferences"]["focus"] = "TIME"
window_request["urgency"] = "TIME_SENSITIVE"
require_valid(request_validator, "Sprint 1.5 time-window request", window_request)
without_window = copy.deepcopy(window_request)
del without_window["departure_window"]
assert list(request_validator.iter_errors(without_window)), "null departure_time requires a window"
conflicting_time = copy.deepcopy(request)
conflicting_time["departure_window"] = window_request["departure_window"]
assert list(request_validator.iter_errors(conflicting_time)), "exact time and window cannot coexist"
require_valid(interpretation_validator, "Sprint 1.5 pending session", {
    "user_request": None, "needs_summary": "等待地点与时间", "missing_fields": ["origin", "departure_time"],
    "assumptions": [], "planning_allowed": False,
    "planning_state": {"location_candidate": {"label": "天津五大道"}, "city": "TIANJIN", "pending_clarifications": ["urgency"]},
    "structured_intent": {"location_candidate": {"label": "天津五大道"}, "city": "TIANJIN", "pending_clarifications": ["urgency"]},
    "uncertain_fields": ["location_role", "urgency"], "follow_up_question": "请确认地点角色与出发时间。",
})

unsafe = copy.deepcopy(result)
unsafe["route_options"][0]["risk_assessment"]["review_outcome"] = "PASS"
require_invalid("unknown/high risk cannot pass", unsafe)

unsafe = copy.deepcopy(result)
unsafe["route_options"][0]["risk_assessment"]["reasons"] = []
require_invalid("safety reason required", unsafe)

unsafe = copy.deepcopy(result)
unsafe["route_options"][0]["display_labels"] = ["RECOMMENDED"]
require_invalid("unreviewed route cannot be recommended", unsafe)

unsafe = copy.deepcopy(result)
unsafe["route_options"][1]["segments"][1]["evidence"]["data_status"] = "PUBLIC_DATA"
require_invalid("air cannot claim public data", unsafe)

unsafe = copy.deepcopy(result)
unsafe["route_options"][1]["data_status"] = "VERIFIED"
require_invalid("simulation cannot claim verified route", unsafe)

unsafe = copy.deepcopy(result)
unsafe["route_options"][1]["segments"][1]["evidence"].pop("observed_at")
require_invalid("available source requires time", unsafe)

unsafe = copy.deepcopy(result)
unsafe["route_options"][0]["segments"][0]["evidence"].pop("unavailable_reason")
require_invalid("unavailable data requires reason", unsafe)

unsafe = copy.deepcopy(result)
unsafe["route_options"].extend(copy.deepcopy(result["route_options"]))
require_invalid("at most three route options", unsafe)

unsafe = copy.deepcopy(result)
air_review = unsafe["route_options"][1]["risk_assessment"]
air_review["review_outcome"] = "PASS"
for risk_name in ("weather", "mobility", "transfer", "operational", "data_uncertainty"):
    air_review[risk_name] = "LOW"
require_invalid("simulation or unavailable route cannot pass", unsafe)

dataset_schema = json.loads((ROOT / "schemas/datasets.v0.1.schema.json").read_text(encoding="utf-8"))
Draft202012Validator.check_schema(dataset_schema)
dataset_validator = Draft202012Validator(dataset_schema, format_checker=FormatChecker())
dataset_paths = sorted((ROOT / "data").rglob("*.json"))
assert dataset_paths, "Sprint 1 datasets are missing"
for path in dataset_paths:
    require_valid(dataset_validator, str(path.relative_to(ROOT)), json.loads(path.read_text(encoding="utf-8")))
tampered_routes = json.loads((ROOT / "data/public/ground-routes.json").read_text(encoding="utf-8"))
tampered_routes["routes"][0]["data_status"] = "SIMULATED_DATA"
assert list(dataset_validator.iter_errors(tampered_routes)), "ground route status cannot be upgraded or relabeled"

print(f"Core contract valid: two examples, four interpretation cases, a time-window request, nine unsafe route variants, {len(dataset_paths)} datasets, one unsafe dataset variant.")
