"""D-011 Golden entity and geometry boundaries (G01-G10, G14)."""

import json
import copy
import shutil
from pathlib import Path

import pytest
from jsonschema import Draft202012Validator, FormatChecker
from jsonschema.exceptions import ValidationError

from agent.candidate_planner import candidates
from agent.data_access import LocalDataService
from agent.interpreter import interpret
from agent.pipeline import plan


ROOT = Path(__file__).resolve().parents[2]
SERVICE = LocalDataService()
SCHEMA = json.loads((ROOT / "schemas/core.v0.1.schema.json").read_text(encoding="utf-8"))


def request(city: str) -> dict:
    fixture = json.loads((ROOT / "examples" / f"{city}.interpret.json").read_text(encoding="utf-8"))
    return interpret(**fixture)["user_request"]


@pytest.mark.parametrize("alias", ["天津大学", "天大"])
def test_g01_g02_contextual_university_alias(alias: str) -> None:
    resolved = SERVICE.resolve(alias, city="TIANJIN", scenario_id="TJ-001")
    assert resolved and resolved[1]["poi_id"] == "tj-university-weijin"


def test_g03_g04_unscoped_and_home_are_not_resolved() -> None:
    assert SERVICE.resolve("天津大学") is None
    assert SERVICE.resolve("家里", city="TIANJIN", scenario_id="TJ-001") is None
    assert all(item["alias"] != "家里" for item in SERVICE.aliases()["aliases"])


def test_missing_alias_registry_fails_closed_without_breaking_canonical_poi(tmp_path: Path) -> None:
    (tmp_path / "data/public").mkdir(parents=True)
    for city in ("tianjin", "shenzhen"):
        shutil.copy2(ROOT / f"data/public/{city}-poi.json", tmp_path / f"data/public/{city}-poi.json")
    local = LocalDataService(tmp_path)
    assert local.resolve("天津大学", city="TIANJIN") is None
    assert local.resolve("天津大学卫津路校区")[1]["poi_id"] == "tj-university-weijin"


def test_g05_public_poi_has_provenance_and_no_verified_entrance() -> None:
    for dataset in SERVICE.pois():
        for poi in dataset["pois"]:
            assert poi["data_status"] == "PUBLIC_DATA"
            assert poi["official_source_url"] and poi["coordinate_source_url"]
            assert poi["source_ref"] == poi["coordinate_source_url"]
            assert poi["observed_at"] == dataset["fetched_at"]
            assert poi["coordinate_kind"] == "OSM_OBJECT_CENTROID_NOT_ENTRANCE"


def test_g06_simulated_vertiports_are_synthetic() -> None:
    for scenario in SERVICE.air_scenarios()["scenarios"]:
        assert len(scenario["simulated_vertiports"]) == 2
        for role, port in zip(("A", "B"), scenario["simulated_vertiports"]):
            assert port["id"] == f'{scenario["scenario_id"]}-SIM-VP-{role}'
            assert port["name"] == scenario[f"vertiport_{role.lower()}"]
            assert port["city"] == scenario["city"]
            assert port["data_status"] == "SIMULATED_DATA"
            assert port["coordinate_is_synthetic"] is True
            assert "模拟起降点" in port["name"]
        assert scenario["simulated_vertiports"][0]["coordinate"] != scenario["simulated_vertiports"][1]["coordinate"]


@pytest.mark.parametrize("damage", ["id", "swapped", "name", "city", "duplicate_coordinate", "out_of_bounds"])
def test_s3_16_mismatched_simulated_vertiports_fall_back_to_ground(tmp_path: Path, damage: str) -> None:
    public_dir = tmp_path / "data/public"
    public_dir.mkdir(parents=True)
    for filename in ("tianjin-poi.json", "shenzhen-poi.json", "ground-routes.json"):
        shutil.copy2(ROOT / "data/public" / filename, public_dir / filename)
    dataset = json.loads((ROOT / "data/simulated/air-scenarios.json").read_text(encoding="utf-8"))
    scenario = dataset["scenarios"][0]
    first, second = scenario["simulated_vertiports"]
    if damage == "id":
        first["id"] = second["id"]
    elif damage == "swapped":
        scenario["simulated_vertiports"] = [second, first]
    elif damage == "name":
        first["name"] = second["name"]
    elif damage == "city":
        first["city"] = "SHENZHEN"
    elif damage == "duplicate_coordinate":
        first["coordinate"] = second["coordinate"]
    else:
        first["coordinate"]["longitude"] = 181
    air_dir = tmp_path / "data/simulated"
    air_dir.mkdir(parents=True)
    (air_dir / "air-scenarios.json").write_text(json.dumps(dataset, ensure_ascii=False), encoding="utf-8")
    service = LocalDataService(tmp_path)
    with pytest.raises(ValidationError):
        service.air_scenarios()
    routes, warnings = candidates(request("tj-001"), service)
    assert [route["route_type"] for route in routes] == ["GROUND_ONLY"]
    assert any("DATA_UNAVAILABLE" in warning and "模拟低空数据" in warning for warning in warnings)


def test_s3_16_legacy_air_scenario_without_coordinates_stays_compatible(tmp_path: Path) -> None:
    dataset = json.loads((ROOT / "data/simulated/air-scenarios.json").read_text(encoding="utf-8"))
    for scenario in dataset["scenarios"]:
        del scenario["simulated_vertiports"]
    air_dir = tmp_path / "data/simulated"
    air_dir.mkdir(parents=True)
    (air_dir / "air-scenarios.json").write_text(json.dumps(dataset, ensure_ascii=False), encoding="utf-8")
    assert len(LocalDataService(tmp_path).air_scenarios()["scenarios"]) == 2


@pytest.mark.parametrize("city,origin_alias,destination_alias,expected_id", [
    ("tj-001", "天津大学", "天津医大总医院", "tj-university-weijin"),
    ("sz-001", "深圳养老护理院", "北大深圳医院", "sz-elder-care"),
])
def test_g07_to_g10_and_g14_plan_has_typed_geometry_without_safety_change(city, origin_alias, destination_alias, expected_id) -> None:
    user_request = request(city)
    user_request["origin"] = {"label": origin_alias}
    user_request["destination"] = {"label": destination_alias}
    result = plan(user_request)
    Draft202012Validator(SCHEMA, format_checker=FormatChecker()).validate(result)
    assert len(result["route_options"]) == 2
    ground, air = result["route_options"]
    assert ground["risk_assessment"]["review_outcome"] == "DOWNGRADE"
    assert air["risk_assessment"]["review_outcome"] == "REJECT"
    assert ground["segments"][0]["origin"]["canonical_poi_id"] == expected_id
    assert ground["segments"][0]["origin"]["entity_precision"] == "POI"
    assert ground["segments"][0]["origin"]["entrance_verified"] is False
    road = ground["segments"][0]
    assert road["geometry_status"] == "PUBLIC_ROUTE_SNAPSHOT"
    assert road["geometry_evidence"]["data_status"] == "PUBLIC_DATA"
    assert len(road["geometry"]["coordinates"]) > 2
    assert [segment["geometry_status"] for segment in air["segments"]] == ["STRAIGHT_REFERENCE_LINE", "SIMULATED_AIR_CORRIDOR", "STRAIGHT_REFERENCE_LINE"]
    assert all(segment["geometry_evidence"]["data_status"] == "SIMULATED_DATA" for segment in air["segments"])
    assert air["segments"][1]["evidence"]["data_status"] == "SIMULATED_DATA"
    assert all("coordinate" in location for segment in air["segments"] for location in (segment["origin"], segment["destination"]))


def test_missing_geometry_remains_optional_and_source_status_independent() -> None:
    user_request = request("tj-001")
    ground = plan(user_request)["route_options"][0]["segments"][0]
    ground.pop("geometry")
    ground.pop("geometry_status")
    ground.pop("geometry_evidence")
    assert ground["evidence"]["data_status"] == "PUBLIC_DATA"
    Draft202012Validator({"$ref": "#/$defs/Segment", "$defs": SCHEMA["$defs"]}).validate(ground)


def test_geometry_contract_rejects_public_air_or_fake_public_reference() -> None:
    segment_schema = {"$ref": "#/$defs/Segment", "$defs": SCHEMA["$defs"]}
    air = plan(request("tj-001"))["route_options"][1]["segments"][1]
    invalid = copy.deepcopy(air)
    invalid["geometry_status"] = "PUBLIC_ROUTE_SNAPSHOT"
    invalid["geometry_evidence"]["data_status"] = "PUBLIC_DATA"
    assert not Draft202012Validator(segment_schema).is_valid(invalid)
    invalid = copy.deepcopy(air)
    invalid["geometry_status"] = "STRAIGHT_REFERENCE_LINE"
    assert not Draft202012Validator(segment_schema).is_valid(invalid)
