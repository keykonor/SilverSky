"""Behavioral tests for the first two-city planning loop and safety barriers."""

from __future__ import annotations

import copy
import json
import shutil
from pathlib import Path

import pytest
from jsonschema import Draft202012Validator, FormatChecker
from jsonschema.exceptions import ValidationError

from agent.candidate_planner import candidates
from agent.data_access import LocalDataService
from agent.interpreter import interpret
from agent.pipeline import plan
from agent.safety_reviewer import review
from agent.solution_synthesizer import synthesize


ROOT = Path(__file__).resolve().parents[2]
SCHEMA = json.loads((ROOT / "schemas/core.v0.1.schema.json").read_text(encoding="utf-8"))
INTERPRET_SCHEMA = {"$ref": "#/$defs/InterpretationResult", "$defs": SCHEMA["$defs"]}
FORMAT = FormatChecker()


def fixture(name: str) -> dict:
    return json.loads((ROOT / "examples" / f"{name}.interpret.json").read_text(encoding="utf-8"))


@pytest.mark.parametrize("name,age,mobility", [("tj-001", 78, "LIMITED"), ("sz-001", 72, "UNKNOWN")])
def test_golden_scenarios_are_schema_valid_and_conservative(name: str, age: int, mobility: str) -> None:
    interpretation = interpret(**fixture(name))
    Draft202012Validator(INTERPRET_SCHEMA, format_checker=FORMAT).validate(interpretation)
    request = interpretation["user_request"]
    assert interpretation["missing_fields"] == []
    assert request["departure_time"] == "2026-09-28T15:00:00+08:00"
    assert request["elderly_profile"]["age"] == age
    assert request["elderly_profile"]["mobility"] == mobility
    assert request["preferences"]["air_option"] == "UNSPECIFIED"
    if name == "tj-001":
        assert request["origin"]["label"] == "天津大学卫津路校区附近"
    result = plan(request)
    Draft202012Validator(SCHEMA, format_checker=FORMAT).validate(result)
    assert result["user_request"] == request
    assert [route["route_type"] for route in result["route_options"]] == ["GROUND_ONLY", "GROUND_AIR_GROUND"]
    assert result["route_options"][0]["risk_assessment"]["review_outcome"] == "DOWNGRADE"
    assert result["route_options"][1]["risk_assessment"]["review_outcome"] == "REJECT"
    assert all("步行" in route["explanation"] and "换乘" in route["explanation"] and "安全" in route["explanation"] for route in result["route_options"])
    assert "与模拟低空相比" in result["route_options"][0]["explanation"]
    assert "与纯地面方案相比" in result["route_options"][1]["explanation"]
    assert all("生成原因" in route["explanation"] for route in result["route_options"])
    assert any("© OpenStreetMap contributors" in warning for warning in result["warnings"])
    if name == "tj-001":
        assert any("实际出发位置" in warning and "OSM 对象中心点" in warning for warning in result["warnings"])
        origin = result["route_options"][0]["segments"][0]["origin"]
        assert origin["entity_precision"] == "POI"
        assert origin["entrance_verified"] is False
        assert origin["coordinate"] == LocalDataService().pois()[0]["pois"][0]["coordinate"]


def test_missing_age_is_unknown_without_error() -> None:
    source = fixture("sz-001")
    source["text"] = source["text"].replace("72岁老人", "老人")
    interpreted = interpret(**source)
    assert interpreted["user_request"]["elderly_profile"]["age"] is None
    Draft202012Validator(SCHEMA, format_checker=FORMAT).validate(plan(interpreted["user_request"]))


def test_missing_date_requires_clarification() -> None:
    source = fixture("tj-001")
    source["text"] = source["text"].replace("2026年9月28日下午15:00", "下午15:00")
    interpreted = interpret(**source)
    assert interpreted["user_request"] is None
    assert interpreted["missing_fields"] == ["departure_time"]


def test_severe_mobility_and_transfers_trigger_reject() -> None:
    request = interpret(**fixture("tj-001"))["user_request"]
    request["elderly_profile"]["walking_tolerance_m"] = 100
    request["preferences"]["max_transfers"] = 1
    ground = candidates(request)[0][0]
    overloaded = copy.deepcopy(ground)
    overloaded["walking_distance_m"] = 2000
    overloaded["transfer_count"] = 3
    verdict = review(overloaded, request)
    assert verdict["mobility"] == "HIGH"
    assert verdict["transfer"] == "HIGH"
    assert verdict["review_outcome"] == "REJECT"


def test_missing_air_dataset_falls_back_to_ground() -> None:
    class NoAirService(LocalDataService):
        def air_scenarios(self) -> dict:
            return {"scenarios": []}

    request = interpret(**fixture("tj-001"))["user_request"]
    routes, warnings = candidates(request, NoAirService())
    assert [route["route_type"] for route in routes] == ["GROUND_ONLY"]
    assert any("实际出发位置" in warning for warning in warnings)


@pytest.mark.parametrize("air_payload", [None, "{not valid json"])
def test_missing_or_corrupt_air_file_keeps_ground_candidate(tmp_path: Path, air_payload: str | None) -> None:
    public_dir = tmp_path / "data" / "public"
    public_dir.mkdir(parents=True)
    for name in ("tianjin-poi.json", "shenzhen-poi.json", "ground-routes.json"):
        shutil.copyfile(ROOT / "data" / "public" / name, public_dir / name)
    if air_payload is not None:
        air_dir = tmp_path / "data" / "simulated"
        air_dir.mkdir(parents=True)
        (air_dir / "air-scenarios.json").write_text(air_payload, encoding="utf-8")
    request = interpret(**fixture("tj-001"))["user_request"]
    routes, warnings = candidates(request, LocalDataService(tmp_path))
    assert [route["route_type"] for route in routes] == ["GROUND_ONLY"]
    assert any("DATA_UNAVAILABLE" in warning and "模拟低空数据" in warning for warning in warnings)


def test_mutated_ground_source_status_cannot_be_upgraded() -> None:
    class SimulatedGroundService(LocalDataService):
        def ground_routes(self) -> dict:
            data = copy.deepcopy(super().ground_routes())
            data["routes"][0]["data_status"] = "SIMULATED_DATA"
            return data

    request = interpret(**fixture("tj-001"))["user_request"]
    routes, warnings = candidates(request, SimulatedGroundService())
    assert routes == []
    assert any("DATA_UNAVAILABLE" in warning and "不是 PUBLIC_DATA" in warning for warning in warnings)


def test_dataset_reader_rejects_mutated_ground_status(tmp_path: Path) -> None:
    public_dir = tmp_path / "data" / "public"
    public_dir.mkdir(parents=True)
    dataset = json.loads((ROOT / "data" / "public" / "ground-routes.json").read_text(encoding="utf-8"))
    dataset["routes"][0]["data_status"] = "SIMULATED_DATA"
    (public_dir / "ground-routes.json").write_text(json.dumps(dataset, ensure_ascii=False), encoding="utf-8")
    with pytest.raises(ValidationError, match="not valid under any of the given schemas"):
        LocalDataService(tmp_path).ground_routes()


def test_simulated_air_keeps_segment_status_and_never_recommended() -> None:
    request = interpret(**fixture("sz-001"))["user_request"]
    air = plan(request)["route_options"][1]
    assert air["data_status"] == "DATA_UNAVAILABLE"
    assert "SIMULATED_SCENARIO" in air["display_labels"]
    assert "RECOMMENDED" not in air["display_labels"]
    assert air["segments"][1]["evidence"]["data_status"] == "SIMULATED_DATA"
    assert air["total_time_min"] is None
    assert air["estimated_cost_cny"] is None
    assert "不可预订" in air["explanation"]


def test_ground_only_preference_excludes_air() -> None:
    request = interpret(**fixture("tj-001"))["user_request"]
    request["preferences"]["air_option"] = "GROUND_ONLY"
    result = plan(request)
    assert [route["route_type"] for route in result["route_options"]] == ["GROUND_ONLY"]


def test_explicit_negations_preserve_user_needs() -> None:
    source = fixture("tj-001")
    source["text"] = source["text"].replace("需要陪同", "无需陪同，不需要轮椅")
    interpreted = interpret(**source)
    profile = interpreted["user_request"]["elderly_profile"]
    assert profile["assistance_requirement"] is False
    assert profile["wheelchair_requirement"] is False


def test_safety_review_cannot_be_bypassed_by_synthesizer() -> None:
    request = interpret(**fixture("tj-001"))["user_request"]
    proposed, _ = candidates(request)
    with pytest.raises(ValueError, match="independent safety review"):
        synthesize(request, proposed, [], [])
    verdict = review(proposed[0], request)
    assert verdict["weather"] == "UNKNOWN"
    assert verdict["review_outcome"] != "PASS"
    forged = {**verdict, "review_outcome": "PASS"}
    with pytest.raises(ValueError, match="unsafe PASS"):
        synthesize(request, [proposed[0]], [forged], [])
    all_low = {key: "LOW" for key in ("weather", "mobility", "transfer", "operational", "data_uncertainty")}
    forged_air = {**all_low, "review_outcome": "PASS", "reasons": ["forged"]}
    with pytest.raises(ValueError, match="unsafe PASS"):
        synthesize(request, [proposed[1]], [forged_air], [])
    forged_missing = copy.deepcopy(proposed[0])
    forged_missing["segments"][0]["evidence"] = {"data_status": "DATA_UNAVAILABLE", "unavailable_reason": "missing"}
    with pytest.raises(ValueError, match="unsafe PASS"):
        synthesize(request, [forged_missing], [forged_air], [])


def test_safety_reads_segment_evidence_even_when_route_is_mislabeled() -> None:
    request = interpret(**fixture("tj-001"))["user_request"]
    ground = candidates(request)[0][0]
    tampered = copy.deepcopy(ground)
    tampered["segments"][0]["evidence"] = {"data_status": "SIMULATED_DATA", "source_ref": "test", "observed_at": "2026-09-27T00:00:00Z"}
    tampered["data_status"] = "PUBLIC_DATA"
    verdict = review(tampered, request)
    assert verdict["data_uncertainty"] == "HIGH"
    assert verdict["review_outcome"] == "REJECT"
    assert any("SIMULATED_DATA" in reason for reason in verdict["reasons"])
    tampered["segments"][0]["evidence"] = {"data_status": "DATA_UNAVAILABLE", "unavailable_reason": "source missing"}
    verdict = review(tampered, request)
    assert verdict["review_outcome"] != "PASS"
    assert any("DATA_UNAVAILABLE" in reason for reason in verdict["reasons"])


def test_adverse_simulated_weather_escalates_independently() -> None:
    request = interpret(**fixture("tj-001"))["user_request"]
    air = copy.deepcopy(candidates(request)[0][1])
    air["air_scenario"]["weather"] = "ADVERSE_SCENARIO"
    verdict = review(air, request)
    assert verdict["weather"] == "HIGH"
    assert verdict["review_outcome"] == "REJECT"
    assert any("不利条件" in reason for reason in verdict["reasons"])


def test_unregistered_location_has_no_fabricated_route() -> None:
    request = interpret(**fixture("tj-001"))["user_request"]
    request["origin"]["label"] = "未知地址"
    result = plan(request)
    assert result["route_options"] == []
    assert result["warnings"]


def test_supplied_nonmatching_coordinate_cannot_be_silently_substituted() -> None:
    request = interpret(**fixture("tj-001"))["user_request"]
    request["origin"]["coordinate"] = {"longitude": 117.2, "latitude": 39.1}
    result = plan(request)
    assert result["route_options"] == []
    assert any("坐标与登记 POI 中心点不同" in warning for warning in result["warnings"])


def test_exact_registered_centroid_is_only_an_estimate() -> None:
    request = interpret(**fixture("tj-001"))["user_request"]
    request["origin"]["coordinate"] = {"longitude": 117.1647280, "latitude": 39.1087675}
    result = plan(request)
    assert len(result["route_options"]) == 2
    assert any("OSM 对象中心点" in warning and "实际出发位置" in warning for warning in result["warnings"])
