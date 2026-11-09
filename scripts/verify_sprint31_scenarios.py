"""Record bounded, synthetic Sprint 3.1 scenario behavior without user data."""

import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from agent.interpreter import interpret
from agent.pipeline import plan


OUTPUT = ROOT / "docs/experiments/sprint3.1-3d-ux-validation/SCENARIO_RESULTS.json"
REFERENCE = "2026-09-29T09:00:00+08:00"
CASES = {
    "R1": "78岁老人行动不便，需要陪同，从天津大学卫津路校区到天津医科大学总医院，2026年9月30日下午15:00出发，普通出行，安全舒适优先。",
    "R2": "65岁老人行动正常，从天津大学卫津路校区到天津医科大学总医院，2026年9月30日下午15:00出发，普通出行，时间优先。",
    "R3": "72岁老人行动一般，少步行，从深圳市养老护理院到北京大学深圳医院，2026年9月30日下午15:00出发，普通出行。",
    "R4": "80岁老人使用轮椅，从天津大学卫津路校区到天津医科大学总医院，2026年9月30日下午15:00出发，普通出行，安全舒适优先。",
    "R5": "72岁老人行动一般，从深圳市养老护理院到北京大学深圳医院，2026年9月30日下午15:00出发，赶高铁，时间优先。",
    "R6": "老人突然胸痛，而且呼吸困难。",
    "R7": "从家里去医院。",
    "R8": "72岁老人行动一般，从北京大学深圳医院到深圳市养老护理院，2026年9月30日下午15:00出发，普通出行。",
}


def main() -> None:
    results = {}
    for case_id, text in CASES.items():
        reply = interpret(text, REFERENCE)
        state = reply["planning_state"]
        profile = state.get("elderly_profile") or {}
        preferences = state.get("preferences") or {}
        result = {
            "input": text,
            "planningAllowed": reply["planning_allowed"],
            "missingFields": reply["missing_fields"],
            "uncertainFields": reply["uncertain_fields"],
            "followUp": reply.get("follow_up_question"),
            "mobility": profile.get("mobility"),
            "wheelchairRequirement": profile.get("wheelchair_requirement"),
            "focus": preferences.get("focus"),
            "urgency": state.get("urgency"),
            "routes": [],
        }
        if reply["planning_allowed"] and reply["user_request"]:
            planned = plan(reply["user_request"])
            result["routes"] = [
                {
                    "type": route["route_type"],
                    "review": route["risk_assessment"]["review_outcome"],
                    "dataStatus": route["data_status"],
                    "reasons": route["risk_assessment"]["reasons"],
                }
                for route in planned["route_options"]
            ]
            result["warnings"] = planned.get("warnings", [])
        results[case_id] = result
        print(f'{case_id}: allowed={result["planningAllowed"]}, mobility={result["mobility"]}, focus={result["focus"]}, urgency={result["urgency"]}, routes={[(item["type"], item["review"]) for item in result["routes"]]}')
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps({"referenceTime": REFERENCE, "evidenceType": "AUTOMATED_EVIDENCE", "cases": results}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
