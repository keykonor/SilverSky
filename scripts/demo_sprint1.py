"""Run one Golden Scenario against a locally started SilverSky API."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parents[1]


def post_json(base_url: str, path: str, payload: dict) -> dict:
    request = Request(
        f"{base_url.rstrip('/')}{path}",
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers={"Content-Type": "application/json; charset=utf-8"},
        method="POST",
    )
    with urlopen(request, timeout=15) as response:
        return json.load(response)


def main() -> None:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("scenario", choices=("tj-001", "sz-001"))
    parser.add_argument("--base-url", default="http://127.0.0.1:8000")
    args = parser.parse_args()

    fixture = json.loads((ROOT / "examples" / f"{args.scenario}.interpret.json").read_text(encoding="utf-8"))
    print("演示说明：完整出发日期和时间由 Golden 测试夹具补充，不是原始用户事实。")
    interpreted = post_json(args.base_url, "/api/v1/interpret", fixture)
    print("=== InterpretationResult ===")
    print(json.dumps(interpreted, ensure_ascii=False, indent=2))
    if interpreted["user_request"] is None:
        raise SystemExit("Cannot plan: interpreter requested missing fields")

    planned = post_json(args.base_url, "/api/v1/plan", interpreted["user_request"])
    print("=== PlanningResult ===")
    print(json.dumps(planned, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
