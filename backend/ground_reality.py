"""Read-only Amap ground evidence. GCJ-02 values never enter core WGS84 routes."""

from __future__ import annotations

import json
import math
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Protocol
from urllib.parse import urlencode
from urllib.request import urlopen


CITY_NAMES = {"TIANJIN": "天津", "SHENZHEN": "深圳"}
ROOT = Path(__file__).resolve().parents[1]


def _key() -> str:
    key = os.environ.get("AMAP_WEB_SERVICE_KEY", "").strip()
    if key:
        return key
    path = ROOT / ".env"
    if path.exists():
        for line in path.read_text(encoding="utf-8").splitlines():
            if line.startswith("AMAP_WEB_SERVICE_KEY="):
                return line.partition("=")[2].strip().strip('"\'')
    return ""


def _point(value: object) -> list[float] | None:
    if not isinstance(value, str):
        return None
    try:
        lon, lat = (float(item) for item in value.split(","))
    except (ValueError, TypeError):
        return None
    return [lon, lat] if 70 <= lon <= 140 and 0 <= lat <= 60 else None


def _text(value: object, limit: int = 160) -> str:
    return value[:limit] if isinstance(value, str) else ""


def _polyline(steps: list[dict]) -> list[list[float]]:
    points: list[list[float]] = []
    for step in steps:
        polyline = step.get("polyline")
        if not isinstance(polyline, str) or not polyline.strip():
            return []
        for raw in polyline.split(";"):
            point = _point(raw)
            if point is None:
                return []
            if not points or point != points[-1]:
                points.append(point)
    return points if len(points) >= 2 else []


def _nearby(a: list[float], b: list[float], max_m: float = 750) -> bool:
    if not isinstance(a, list) or not isinstance(b, list) or len(a) != 2 or len(b) != 2:
        return False
    latitude = (a[1] + b[1]) / 2
    dx = (a[0] - b[0]) * 111_320 * math.cos(math.radians(latitude))
    dy = (a[1] - b[1]) * 110_540
    return math.hypot(dx, dy) <= max_m


def _route_matches(driving: dict, origin: list[float], destination: list[float]) -> bool:
    geometry = driving.get("geometry") or []
    return len(geometry) >= 2 and _nearby(geometry[0], origin) and _nearby(geometry[-1], destination)


class GroundRealityProvider(Protocol):
    def search_places(self, query: str, city: str) -> dict: ...
    def resolve_place(self, query: str, city: str) -> dict: ...
    def get_place_details(self, poi_id: str) -> dict: ...
    def get_driving_route(self, origin: list[float], destination: list[float]) -> dict: ...
    def get_walking_route(self, origin: list[float], destination: list[float]) -> dict: ...


class AmapGroundRealityProvider:
    source = "高德 Web 服务"

    def __init__(self, key: str | None = None) -> None:
        self.key = key if key is not None else _key()

    def _request(self, path: str, **params: str) -> dict:
        if not self.key:
            raise RuntimeError("AMAP_KEY_UNAVAILABLE")
        url = "https://restapi.amap.com" + path + "?" + urlencode({"key": self.key, "output": "json", **params})
        with urlopen(url, timeout=8) as response:
            if response.status != 200:
                raise RuntimeError("AMAP_HTTP_ERROR")
            raw = response.read(2_000_000)
        data = json.loads(raw)
        if data.get("status") != "1":
            raise RuntimeError("AMAP_UPSTREAM_UNAVAILABLE")
        return data

    def search_places(self, query: str, city: str) -> dict:
        if city not in (*CITY_NAMES, "ALL") or not 1 <= len(query.strip()) <= 80:
            raise ValueError("INVALID_PLACE_QUERY")
        search_scope = {"city": CITY_NAMES[city], "citylimit": "true"} if city in CITY_NAMES else {}
        data = self._request("/v3/place/text", keywords=query.strip(), offset="20", page="1", extensions="base", **search_scope)
        candidates = []
        for item in data.get("pois", []):
            location = _point(item.get("location"))
            city_name = _text(item.get("cityname"))
            in_scope = city == "ALL" and isinstance(city_name, str) and bool(city_name.strip()) or city in CITY_NAMES and city_name in (CITY_NAMES[city], CITY_NAMES[city] + "市")
            if location and isinstance(item.get("id"), str) and in_scope:
                candidates.append({"id": item["id"], "name": _text(item.get("name")), "address": _text(item.get("address")), "city": city_name, "location": location, "precision": "POI", "source": self.source})
        return {"status": "OK", "source": self.source, "retrieved_at": datetime.now(timezone.utc).isoformat(), "coordinate_system": "GCJ-02", "candidates": candidates}

    def resolve_place(self, query: str, city: str) -> dict:
        search = self.search_places(query, city)
        exact = [item for item in search["candidates"] if item["name"] == query.strip()]
        candidates = search["candidates"] if query.strip() in ("天津大学", "天大") else exact or search["candidates"]
        unique_exact = len(exact) == 1 and query.strip() not in ("天津大学", "天大")
        return {**search, "status": "OK" if unique_exact else "NEEDS_SELECTION" if candidates else "DATA_UNAVAILABLE", "candidates": candidates, "place": exact[0] if unique_exact else None}

    def get_place_details(self, poi_id: str) -> dict:
        if not poi_id.isalnum() or len(poi_id) > 40:
            raise ValueError("INVALID_POI_ID")
        data = self._request("/v3/place/detail", id=poi_id, extensions="all")
        item = (data.get("pois") or [{}])[0]
        return {"status": "OK", "source": self.source, "retrieved_at": datetime.now(timezone.utc).isoformat(), "coordinate_system": "GCJ-02", "id": item.get("id"), "name": _text(item.get("name")), "address": _text(item.get("address")), "city": _text(item.get("cityname")), "location": _point(item.get("location")), "precision": "POI", "arrival_point": _point(item.get("entr_location")), "arrival_point_label": "高德到达点（未核验具体入口）", "entrance_verified": False, "pickup_verified": False, "accessibility": "UNKNOWN"}

    def _route(self, mode: str, origin: list[float], destination: list[float]) -> dict:
        if mode not in ("driving", "walking") or not all(isinstance(p, list) and len(p) == 2 and _point(f"{p[0]},{p[1]}") for p in (origin, destination)):
            raise ValueError("INVALID_ROUTE_POINTS")
        data = self._request(f"/v3/direction/{mode}", origin=f"{origin[0]:.6f},{origin[1]:.6f}", destination=f"{destination[0]:.6f},{destination[1]:.6f}", **({"strategy": "0"} if mode == "driving" else {}))
        path = (data.get("route", {}).get("paths") or [{}])[0]
        if not isinstance(path, dict) or not isinstance(path.get("steps"), list) or not all(isinstance(step, dict) for step in path["steps"]):
            raise RuntimeError("AMAP_ROUTE_DATA_UNAVAILABLE")
        geometry = _polyline(path["steps"])
        if not geometry:
            raise RuntimeError("AMAP_ROUTE_GEOMETRY_UNAVAILABLE")
        try:
            distance = float(path["distance"])
            duration = float(path["duration"]) / 60
        except (KeyError, TypeError, ValueError) as exc:
            raise RuntimeError("AMAP_ROUTE_METRICS_UNAVAILABLE") from exc
        if not math.isfinite(distance) or not math.isfinite(duration) or distance <= 0 or duration <= 0:
            raise RuntimeError("AMAP_ROUTE_METRICS_UNAVAILABLE")
        steps = [{"instruction": str(step.get("instruction", ""))[:180], "road": str(step.get("road", ""))[:100]} for step in path["steps"] if isinstance(step.get("instruction"), str) and step["instruction"].strip()]
        return {"mode": mode, "distance_m": distance, "duration_min": duration, "geometry": geometry, "steps": steps[:100], "coordinate_system": "GCJ-02", "source": self.source, "retrieved_at": datetime.now(timezone.utc).isoformat(), "complete_trip_time": None, "accessibility": "UNKNOWN"}

    def get_driving_route(self, origin: list[float], destination: list[float]) -> dict:
        return self._route("driving", origin, destination)

    def get_walking_route(self, origin: list[float], destination: list[float]) -> dict:
        return self._route("walking", origin, destination)


def ground_reference(provider: GroundRealityProvider, city: str, origin_query: str, destination_query: str) -> dict:
    if city not in CITY_NAMES or not all(isinstance(q, str) and 1 <= len(q.strip()) <= 80 for q in (origin_query, destination_query)):
        raise ValueError("INVALID_GROUND_QUERY")
    try:
        origin = provider.resolve_place(origin_query, city)
        destination = provider.resolve_place(destination_query, city)
        if origin["status"] == "DATA_UNAVAILABLE" or destination["status"] == "DATA_UNAVAILABLE":
            return {"status": "DATA_UNAVAILABLE", "message": "在线地点没有可靠匹配；请提供更具体的地点名称。"}
        if origin["status"] != "OK" or destination["status"] != "OK":
            return {"status": "NEEDS_SELECTION", "origin_candidates": origin["candidates"], "destination_candidates": destination["candidates"], "message": "请先选择具体地点；不能根据首条搜索结果猜测。"}
        a, b = origin["place"], destination["place"]
        driving = provider.get_driving_route(a["location"], b["location"])
        if not _route_matches(driving, a["location"], b["location"]):
            raise RuntimeError("AMAP_ROUTE_ENDPOINT_MISMATCH")
        try:
            walking = provider.get_walking_route(a["location"], b["location"])
        except (RuntimeError, OSError, ValueError, TypeError, AttributeError, KeyError, json.JSONDecodeError):
            walking = None
        details = []
        for place in (a, b):
            try:
                details.append(provider.get_place_details(place["id"]))
            except (RuntimeError, OSError, ValueError, TypeError, AttributeError, KeyError, json.JSONDecodeError):
                details.append(None)
        return {"status": "OK", "origin": a, "destination": b, "driving": driving, "walking": walking, "origin_detail": details[0], "destination_detail": details[1], "source": "高德 Web 服务", "retrieved_at": driving["retrieved_at"], "coordinate_system": "GCJ-02", "entrance": "UNKNOWN", "pickup": "UNKNOWN", "accessibility": "UNKNOWN"}
    except (RuntimeError, OSError, ValueError, TypeError, AttributeError, KeyError, json.JSONDecodeError):
        return {"status": "DATA_UNAVAILABLE", "message": "高德在线地点或路线暂不可用；请查看静态道路模型，并核实实际出行信息。"}


def ground_reference_by_ids(provider: GroundRealityProvider, origin_id: str, destination_id: str) -> dict:
    """Use explicitly selected POI IDs. This is route evidence, not a Safety decision."""
    if not all(isinstance(value, str) and value.isalnum() and 1 <= len(value) <= 40 for value in (origin_id, destination_id)):
        raise ValueError("INVALID_POI_ID")
    try:
        origin = provider.get_place_details(origin_id)
        destination = provider.get_place_details(destination_id)
        if origin.get("id") != origin_id or destination.get("id") != destination_id or origin.get("city") not in ("天津", "天津市") or not isinstance(destination.get("city"), str) or not destination["city"].strip() or not origin.get("location") or not destination.get("location"):
            return {"status": "DATA_UNAVAILABLE", "message": "起点必须是天津已选定的具体地点；请重新搜索并确认起终点。"}
        driving = provider.get_driving_route(origin["location"], destination["location"])
        if not _route_matches(driving, origin["location"], destination["location"]):
            raise RuntimeError("AMAP_ROUTE_ENDPOINT_MISMATCH")
        try:
            walking = provider.get_walking_route(origin["location"], destination["location"])
        except (RuntimeError, OSError, ValueError, TypeError, AttributeError, KeyError, json.JSONDecodeError):
            walking = None
        return {"status": "OK", "origin": origin, "destination": destination, "driving": driving, "walking": walking, "source": "高德 Web 服务", "retrieved_at": driving["retrieved_at"], "coordinate_system": "GCJ-02", "entrance": "UNKNOWN", "pickup": "UNKNOWN", "accessibility": "UNKNOWN", "safety_review": "NOT_PERFORMED"}
    except (RuntimeError, OSError, ValueError, TypeError, AttributeError, KeyError, json.JSONDecodeError):
        return {"status": "DATA_UNAVAILABLE", "message": "在线地点或驾车路线暂不可用；请核对地点并稍后重试。"}
