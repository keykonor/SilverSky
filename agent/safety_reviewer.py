"""Independent Safety Reviewer: evaluates candidates and never creates segments."""

from __future__ import annotations


RANK = {"LOW": 0, "MEDIUM": 1, "UNKNOWN": 2, "HIGH": 3}


def review(candidate: dict, user_request: dict) -> dict:
    profile = user_request["elderly_profile"]
    preferences = user_request["preferences"]
    segments = candidate["segments"]
    statuses = [segment["evidence"]["data_status"] for segment in segments]
    has_air_segment = any(segment["segment_type"] == "AIR" for segment in segments)
    air = candidate["route_type"] == "GROUND_AIR_GROUND" or has_air_segment
    simulated = "SIMULATED_DATA" in statuses
    unavailable = "DATA_UNAVAILABLE" in statuses
    mismatch = (candidate["route_type"] == "GROUND_ONLY" and has_air_segment) or (candidate["route_type"] == "GROUND_AIR_GROUND" and not has_air_segment)
    reasons: list[str] = []
    weather = "UNKNOWN"  # No real weather observation is in the local datasets.
    if air:
        weather_scenario = candidate.get("air_scenario", {}).get("weather")
        if weather_scenario == "ADVERSE_SCENARIO":
            weather = "HIGH"
            reasons.append("模拟天气情景为不利条件；同时缺少真实天气与可飞性证据。")
        elif weather_scenario == "CLEAR_SCENARIO":
            reasons.append("模拟天气设为晴朗情景，但真实天气与可飞性未知。")
        else:
            reasons.append("模拟天气情景未知，真实天气与可飞性也未知。")
    else:
        reasons.append("没有实时天气来源，实际出行天气未知。")
    mobility = "UNKNOWN"
    if profile["mobility"] in {"LIMITED", "ASSISTED", "WHEELCHAIR"}:
        mobility = "MEDIUM"
        reasons.append("行动能力或辅助需求受限，出入口和无障碍路径须人工核实。")
    elif profile["mobility"] in {"INDEPENDENT", "NORMAL", "MODERATE"}:
        mobility = "MEDIUM"  # Actual walking distance remains unknown.
    if profile.get("wheelchair_requirement") is True or profile["mobility"] == "WHEELCHAIR":
        mobility = "HIGH"
        reasons.append("需要轮椅，但上下车及无障碍接驳尚无证据。")
    tolerance = profile.get("walking_tolerance_m")
    distance = candidate["walking_distance_m"]
    if tolerance is not None and distance is not None and distance > tolerance:
        mobility = "HIGH"
        reasons.append("候选步行距离超过用户明确的容忍上限。")
    elif distance is None:
        mobility = "UNKNOWN" if mobility != "HIGH" else "HIGH"
        reasons.append("真实步行距离未知，无法核对老人步行耐受度。")
    transfer = "UNKNOWN" if candidate["transfer_count"] is None else "LOW" if candidate["transfer_count"] == 0 else "MEDIUM"
    max_transfers = preferences.get("max_transfers")
    if max_transfers is not None and candidate["transfer_count"] is not None and candidate["transfer_count"] > max_transfers:
        transfer = "HIGH"
        reasons.append("换乘次数超过用户明确上限。")
    if air:
        transfer = "HIGH" if profile["mobility"] in {"LIMITED", "ASSISTED", "WHEELCHAIR"} else "UNKNOWN"
        reasons.append("虚拟起降点的地面接驳和换乘负担不可核实。")
        reasons.append("无真实天气、空域、航班及运营依据，模拟方案不可执行。")
    operational = "HIGH" if air or simulated else "UNKNOWN"
    data_uncertainty = "HIGH" if simulated else "UNKNOWN"
    if unavailable:
        reasons.append("路段证据包含 DATA_UNAVAILABLE，缺失数据不能被路线级状态覆盖。")
    if simulated:
        reasons.append("路段证据包含 SIMULATED_DATA，不代表真实可运营服务。")
    if mismatch:
        reasons.append("路线类型与 AIR 路段不一致，无法通过安全审查。")
    if not air:
        reasons.append("公开驾驶快照不证明实际车辆、道路通行、医院入口或接送服务可用。")
    if air or simulated or mismatch:
        outcome = "REJECT"
    elif mobility == "HIGH" or transfer == "HIGH":
        outcome = "REJECT"
    elif any(level == "UNKNOWN" for level in (weather, mobility, transfer, operational, data_uncertainty)):
        outcome = "DOWNGRADE"
    else:
        outcome = "DOWNGRADE" if any(level == "HIGH" for level in (weather, mobility, transfer, operational, data_uncertainty)) else "PASS"
    return {
        "weather": weather,
        "mobility": mobility,
        "transfer": transfer,
        "operational": operational,
        "data_uncertainty": data_uncertainty,
        "review_outcome": outcome,
        "reasons": reasons or ["已按当前已知条件完成安全审查。"],
    }
