"""Solution Synthesizer turns reviewed candidates into conservative user output."""

from __future__ import annotations

from .safety_reviewer import RANK


def synthesize(user_request: dict, candidates: list[dict], reviews: list[dict], warnings: list[str]) -> dict:
    if len(candidates) != len(reviews):
        raise ValueError("every candidate requires an independent safety review")
    has_ground = any(candidate["route_type"] == "GROUND_ONLY" for candidate in candidates)
    has_air = any(candidate["route_type"] == "GROUND_AIR_GROUND" for candidate in candidates)
    options = []
    for candidate, assessment in zip(candidates, reviews, strict=True):
        segment_statuses = {segment["evidence"]["data_status"] for segment in candidate["segments"]}
        has_air_segment = any(segment["segment_type"] == "AIR" for segment in candidate["segments"])
        if assessment["review_outcome"] == "PASS":
            if any(assessment[key] in {"HIGH", "UNKNOWN"} for key in ("weather", "mobility", "transfer", "operational", "data_uncertainty")) or candidate["route_type"] != "GROUND_ONLY" or has_air_segment or segment_statuses.intersection({"SIMULATED_DATA", "DATA_UNAVAILABLE"}):
                raise ValueError("unsafe PASS verdict cannot bypass safety review")
        if candidate["route_type"] == "GROUND_AIR_GROUND":
            labels = ["SIMULATED_SCENARIO", "UNRANKED"]
            intro = "生成原因：按已登记的虚拟低空情景展示地面接驳＋模拟飞行＋地面接驳，仅供对比，不能用于真实出行或预订。"
            comparison = "与纯地面方案相比，真实起降点、接驳、天气和运营均无依据，安全不确定性更高；两者均未达到真实推荐条件。" if has_ground else "缺少可比较的纯地面候选，且本模拟方案不能作为真实推荐。"
        else:
            labels = ["SAFETY_COMFORT"] if assessment["review_outcome"] == "PASS" else ["UNRANKED"]
            intro = "生成原因：已登记两处真实 POI 和公开 OSRM 驾车路线快照可提供初步地面比较。"
            comparison = "与模拟低空相比，本路线无需未经证实的飞行运营和虚拟起降点，安全不确定性较低；入口、车辆和无障碍仍未知，因此不能作为真实推荐。" if has_air else "本次没有可比较的低空候选；入口、车辆和无障碍仍未知，因此不能作为真实推荐。"
        status = next((item for item in ("DATA_UNAVAILABLE", "SIMULATED_DATA", "PUBLIC_DATA", "VERIFIED") if item in segment_statuses), candidate["data_status"])
        risk_level = max((assessment[key] for key in ("weather", "mobility", "transfer", "operational", "data_uncertainty")), key=RANK.__getitem__)
        explanation = " ".join([
            intro,
            "安全审查：" + assessment["review_outcome"] + "；" + "；".join(assessment["reasons"]),
            "老年适配：" + ("行动能力有限或轮椅条件需人工确认。" if user_request["elderly_profile"]["mobility"] == "LIMITED" else "行动条件尚不完整，不能据此确认无障碍。"),
            "步行：" + (f"{candidate['walking_distance_m']} 米。" if candidate["walking_distance_m"] is not None else "DATA_UNAVAILABLE，未知。"),
            "换乘：" + (f"{candidate['transfer_count']} 次。" if candidate["transfer_count"] is not None else "DATA_UNAVAILABLE，未知。"),
            "时间：" + (f"{candidate['total_time_min']} 分钟为驾驶快照，不含等待及步行。" if candidate["total_time_min"] is not None else "全程 DATA_UNAVAILABLE；空中模拟时长不能代表总耗时。"),
            "来源可信度：" + status + "；" + "；".join(candidate["limitations"]),
            "方案比较：" + comparison,
            "排序坚持安全、舒适、可达性、时间、成本；没有足够安全证据时不作推荐。",
        ])
        options.append({
            "route_id": candidate["route_id"],
            "route_type": candidate["route_type"],
            "display_labels": labels,
            "total_time_min": candidate["total_time_min"],
            "walking_distance_m": candidate["walking_distance_m"],
            "transfer_count": candidate["transfer_count"],
            "estimated_cost_cny": candidate["estimated_cost_cny"],
            "risk_level": risk_level,
            "comfort_score": None,
            "data_status": status,
            "segments": candidate["segments"],
            "risk_assessment": assessment,
            "explanation": explanation,
        })
    options.sort(key=lambda option: (
        {"PASS": 0, "DOWNGRADE": 1, "UNKNOWN": 2, "REJECT": 3}[option["risk_assessment"]["review_outcome"]],
        RANK[option["risk_level"]],
        option["total_time_min"] if option["total_time_min"] is not None else float("inf"),
    ))
    profile = user_request["elderly_profile"]
    summary = f"从{user_request['origin']['label']}到{user_request['destination']['label']}；老人年龄{profile.get('age') if profile.get('age') is not None else '未知'}；安全与舒适优先。"
    final_warnings = list(warnings)
    if options:
        final_warnings.append("路线是公开地图模型估计与模拟情景，实际出行前须核实入口、接送、天气及可达性。")
    if any(any(segment["evidence"]["data_status"] == "PUBLIC_DATA" for segment in option["segments"]) for option in options):
        final_warnings.append("地图与路线数据署名：© OpenStreetMap contributors；驾驶时间为 OSRM 模型快照。")
    if any(option["route_type"] == "GROUND_AIR_GROUND" for option in options):
        final_warnings.append("低空方案为 SIMULATED_DATA，真实运营、地面接驳、天气与价格均未证实；不可预订。")
    return {
        "schema_version": "0.1-proposal",
        "user_request": user_request,
        "needs_summary": summary,
        "route_options": options[:3],
        "warnings": final_warnings,
    }
