"""Candidate Planner generates evidence-preserving routes without safety verdicts."""

from __future__ import annotations

import json

from jsonschema.exceptions import ValidationError

from .data_access import LocalDataService


def _location(poi: dict) -> dict:
    # Coordinates are object centroids, not verified pickup or entrance points.
    return {"label": poi["name"], "coordinate": poi["coordinate"], "canonical_poi_id": poi["poi_id"], "entity_precision": "POI", "entrance_verified": False}


def _line(origin: dict, destination: dict) -> dict:
    return {"type": "LineString", "coordinates": [[origin["coordinate"]["longitude"], origin["coordinate"]["latitude"]], [destination["coordinate"]["longitude"], destination["coordinate"]["latitude"]]]}


def _segment(kind: str, origin: dict, destination: dict, distance: float | None, duration: float | None, evidence: dict) -> dict:
    return {
        "segment_type": kind,
        "origin": origin,
        "destination": destination,
        "distance_m": distance,
        "duration_min": duration,
        "evidence": evidence,
    }


def candidates(user_request: dict, service: LocalDataService | None = None) -> tuple[list[dict], list[str]]:
    service = service or LocalDataService()
    city = user_request.get("city")
    destination = service.resolve(user_request["destination"]["label"], city=city)
    origin = service.resolve(user_request["origin"]["label"], city=city, scenario_id=destination[0]["scenario_id"] if destination else None)
    if destination is None and origin is not None:
        destination = service.resolve(user_request["destination"]["label"], city=origin[0]["city"], scenario_id=origin[0]["scenario_id"])
    if origin is None or destination is None:
        return [], ["起点或终点未匹配已登记 POI，或简称缺少明确城市/场景上下文；请确认具体地点。"]
    origin_set, origin_poi = origin
    destination_set, destination_poi = destination
    for role, supplied, registered in (
        ("起点", user_request["origin"], origin_poi),
        ("终点", user_request["destination"], destination_poi),
    ):
        coordinate = supplied.get("coordinate")
        if coordinate is not None and any(abs(coordinate[axis] - registered["coordinate"][axis]) > 1e-7 for axis in ("longitude", "latitude")):
            return [], [f"{role}提供的坐标与登记 POI 中心点不同；Sprint 1 无该坐标的路线快照，不能替换为登记中心点。"]
    if origin_set["scenario_id"] != destination_set["scenario_id"]:
        return [], ["跨城市或未登记 POI 组合没有可信路线快照。"]
    scenario_id = origin_set["scenario_id"]
    try:
        ground_set = service.ground_routes()
    except (FileNotFoundError, json.JSONDecodeError, UnicodeDecodeError, ValidationError):
        return [], ["DATA_UNAVAILABLE：公开地面路线数据缺失、损坏或契约校验失败；未生成路线候选。"]
    if ground_set.get("data_status") != "PUBLIC_DATA":
        return [], ["DATA_UNAVAILABLE：地面数据集来源状态不是 PUBLIC_DATA；拒绝将其标记为公开路线。"]
    route = next((item for item in ground_set["routes"] if item["scenario_id"] == scenario_id and item["origin_poi_id"] == origin_poi["poi_id"] and item["destination_poi_id"] == destination_poi["poi_id"]), None)
    if route is None:
        return [], ["该方向没有公开驾驶路线快照；未反用逆向路程。"]
    if route.get("data_status") != "PUBLIC_DATA":
        return [], ["DATA_UNAVAILABLE：该地面路线来源状态不是 PUBLIC_DATA；拒绝将其标记为公开路线。"]
    start = _location(origin_poi)
    end = _location(destination_poi)
    proximity_warnings = [
        f"{role}“{location['label']}”表示范围而非精确地址；本次仅以登记 POI 的 OSM 对象中心点作模型路线代理，实际出发位置、入口与门到门路程未知。"
        for role, location in (("起点", user_request["origin"]), ("终点", user_request["destination"]))
        if "附近" in location["label"]
    ]
    ground_segment = _segment("CAR", start, end, route["distance_m"], route["duration_min"], {
        "data_status": "PUBLIC_DATA", "source_ref": route["source_url"], "observed_at": ground_set["fetched_at"]
    })
    if route.get("geometry") and route.get("geometry_captured_at"):
        ground_segment.update({"geometry": route["geometry"], "geometry_status": "PUBLIC_ROUTE_SNAPSHOT", "geometry_evidence": {"data_status": "PUBLIC_DATA", "source_ref": route["source_url"], "observed_at": route["geometry_captured_at"]}})
    ground = {
        "route_id": f"{scenario_id}-GROUND",
        "route_type": "GROUND_ONLY",
        "segments": [ground_segment],
        "total_time_min": route["duration_min"],
        "walking_distance_m": None,
        "transfer_count": 0,
        "estimated_cost_cny": None,
        "data_status": "PUBLIC_DATA",
        "limitations": [
            "驾驶时间仅为 OSRM 模型快照，不含等待、实时路况或实际上下车时间。",
            "POI 坐标为 OSM 对象中心点，不是已核实入口；步行距离与无障碍可达性未知。",
            "车辆与接送服务是否可用、费用均未知。",
        ] + proximity_warnings,
    }
    result = [ground]
    warnings = list(proximity_warnings)
    if user_request["preferences"]["air_option"] != "GROUND_ONLY":
        try:
            air_set = service.air_scenarios()
        except (FileNotFoundError, json.JSONDecodeError, UnicodeDecodeError, ValidationError):
            air_set = None
            warnings.append("DATA_UNAVAILABLE：模拟低空数据文件缺失或损坏；仅保留公开地面候选。")
        if air_set is not None and (not isinstance(air_set, dict) or not isinstance(air_set.get("scenarios"), list)):
            air_set = None
            warnings.append("DATA_UNAVAILABLE：模拟低空数据结构无效；仅保留公开地面候选。")
        air = next((item for item in air_set["scenarios"] if item["scenario_id"] == scenario_id), None) if air_set else None
        if air_set and air is None:
            warnings.append("DATA_UNAVAILABLE：当前城市没有可用的模拟低空场景；仅保留公开地面候选。")
        if air is not None:
            vertiports = air.get("simulated_vertiports", [])
            a = {"label": air["vertiport_a"], **({"coordinate": vertiports[0]["coordinate"], "entity_precision": "UNKNOWN", "entrance_verified": False} if len(vertiports) == 2 else {})}
            b = {"label": air["vertiport_b"], **({"coordinate": vertiports[1]["coordinate"], "entity_precision": "UNKNOWN", "entrance_verified": False} if len(vertiports) == 2 else {})}
            unavailable = {"data_status": "DATA_UNAVAILABLE", "unavailable_reason": "模拟起降点并非真实设施；地面接驳距离、时间与可达性无法确定"}
            access_a = _segment("CAR", start, a, None, None, unavailable)
            access_b = _segment("CAR", b, end, None, None, unavailable)
            air_segment = _segment("AIR", a, b, None, air["air_duration_min"], {"data_status": "SIMULATED_DATA", "source_ref": "data/simulated/air-scenarios.json#" + scenario_id, "observed_at": air_set["generated_at"]})
            if len(vertiports) == 2:
                for segment in (access_a, access_b):
                    segment.update({"geometry": _line(segment["origin"], segment["destination"]), "geometry_status": "STRAIGHT_REFERENCE_LINE", "geometry_evidence": {"data_status": "SIMULATED_DATA", "source_ref": "data/simulated/air-scenarios.json#" + scenario_id, "observed_at": air_set["generated_at"]}})
                air_segment.update({"geometry": _line(a, b), "geometry_status": "SIMULATED_AIR_CORRIDOR", "geometry_evidence": {"data_status": "SIMULATED_DATA", "source_ref": "data/simulated/air-scenarios.json#" + scenario_id, "observed_at": air_set["generated_at"]}})
            result.append({
                "route_id": f"{scenario_id}-AIR-SIM",
                "route_type": "GROUND_AIR_GROUND",
                "segments": [access_a, air_segment, access_b],
                "total_time_min": None,
                "walking_distance_m": None,
                "transfer_count": None,
                "estimated_cost_cny": None,
                "data_status": "DATA_UNAVAILABLE",
                "limitations": [
                    "模拟低空情景，不存在已核实的起降点、航班、空域或真实运营服务；不可预订。",
                    "模拟空中时长不等于全程时长；地面接驳距离、时间、换乘与步行量未知。",
                    "地面接驳直线仅为示意连接，不代表实际道路导航路线。",
                    "真实天气、可飞条件、运营状态和费用均为 DATA_UNAVAILABLE。",
                    "用户是否愿意考虑模拟低空方案需确认。" if user_request["preferences"]["air_option"] == "UNSPECIFIED" else "仅按用户允许的模拟情景展示，不构成真实出行建议。",
                ] + proximity_warnings,
                "air_scenario": air,
            })
    return result, warnings
