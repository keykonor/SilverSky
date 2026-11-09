from __future__ import annotations

from fastapi.testclient import TestClient

from agent.interpreter import interpret
from backend.app import app
from backend.ground_reality import AmapGroundRealityProvider, ground_reference, ground_reference_by_ids


class FakeAmap(AmapGroundRealityProvider):
    def __init__(self, fail: bool = False):
        super().__init__("test-key")
        self.fail = fail

    def _request(self, path: str, **params: str) -> dict:
        if self.fail:
            raise RuntimeError("UPSTREAM_DOWN")
        if path.endswith("/place/text"):
            name = params["keywords"]
            if name == "天津大学":
                return {"status": "1", "pois": [
                    {"id": "a", "name": "天津大学卫津路校区", "address": "天津", "cityname": "天津市", "location": "117.17,39.10"},
                    {"id": "b", "name": "天津大学北洋园校区", "address": "天津", "cityname": "天津市", "location": "117.10,39.00"},
                ]}
            location = "117.17,39.10" if name == "天津大学卫津路校区" else "117.18,39.11"
            return {"status": "1", "pois": [{"id": "c", "name": name, "address": "天津", "cityname": "天津市", "location": location}]}
        if path.endswith("/place/detail"):
            return {"status": "1", "pois": [{"id": params["id"], "entr_location": "117.18,39.11"}]}
        return {"status": "1", "route": {"paths": [{"distance": "1800", "duration": "600", "steps": [{"polyline": "117.17,39.10;117.18,39.11"}]}]}}


def test_real_place_ambiguity_and_poi_precision():
    provider = FakeAmap()
    resolved = provider.resolve_place("天津大学", "TIANJIN")
    assert resolved["status"] == "NEEDS_SELECTION"
    assert len(resolved["candidates"]) == 2
    assert all(item["precision"] == "POI" for item in resolved["candidates"])
    assert resolved["coordinate_system"] == "GCJ-02"
    assert resolved["retrieved_at"]
    assert provider.resolve_place("天津大学卫津路校区", "TIANJIN")["status"] == "OK"
    details = provider.get_place_details("c")
    assert details["arrival_point"] == [117.18, 39.11]
    assert details["entrance_verified"] is False
    assert details["pickup_verified"] is False
    assert details["accessibility"] == "UNKNOWN"


def test_single_fuzzy_or_cross_city_result_cannot_be_resolved():
    class FuzzyAmap(FakeAmap):
        def _request(self, path: str, **params: str) -> dict:
            if path.endswith("/place/text"):
                return {"status": "1", "pois": [
                    {"id": "x", "name": "完全不同地点", "cityname": "天津市", "location": "117.18,39.11"},
                    {"id": "y", "name": params["keywords"], "cityname": "深圳市", "location": "114.05,22.54"},
                ]}
            return super()._request(path, **params)

    provider = FuzzyAmap()
    assert provider.resolve_place("天津医科大学总医院", "TIANJIN")["status"] == "NEEDS_SELECTION"
    result = ground_reference(provider, "TIANJIN", "天津医科大学总医院", "天津大学卫津路校区")
    assert result["status"] == "NEEDS_SELECTION"
    assert "driving" not in result

    class EmptyAmap(FakeAmap):
        def _request(self, path: str, **params: str) -> dict:
            if path.endswith("/place/text"):
                return {"status": "1", "pois": []}
            return super()._request(path, **params)

    assert ground_reference(EmptyAmap(), "TIANJIN", "不存在的地点", "天津大学卫津路校区")["status"] == "DATA_UNAVAILABLE"


def test_live_driving_walking_and_failure_do_not_forge_route():
    provider = FakeAmap()
    live = ground_reference(provider, "TIANJIN", "天津大学卫津路校区", "天津医科大学总医院")
    assert live["status"] == "OK"
    assert live["driving"]["distance_m"] == 1800
    assert live["walking"]["duration_min"] == 10
    assert live["driving"]["geometry"] == [[117.17, 39.10], [117.18, 39.11]]
    assert live["driving"]["complete_trip_time"] is None
    assert live["entrance"] == live["pickup"] == live["accessibility"] == "UNKNOWN"
    assert live["origin_detail"]["arrival_point"] == [117.18, 39.11]
    assert live["origin_detail"]["entrance_verified"] is False
    failed = ground_reference(FakeAmap(fail=True), "TIANJIN", "天津大学", "医院")
    assert failed["status"] == "DATA_UNAVAILABLE"
    assert "driving" not in failed


def test_r7_both_places_and_past_time_block_planning():
    r7 = interpret("从家里去医院", "2026-09-29T09:00:00+08:00")
    assert r7["planning_allowed"] is False
    assert {"origin", "destination"}.issubset(set(r7["uncertain_fields"]))
    assert "具体医院" in r7["follow_up_question"]
    past = interpret("从天津大学卫津路校区到天津医科大学总医院，2026年9月28日15:00出发", "2026-09-29T09:00:00+08:00")
    assert past["planning_allowed"] is False
    assert "已过去" in past["follow_up_question"]


def test_reality_api_missing_key_returns_unavailable(monkeypatch):
    monkeypatch.setattr("backend.ground_reality._key", lambda: "")
    client = TestClient(app)
    search = client.get("/api/v1/reality/places", params={"query": "天津大学", "city": "TIANJIN"})
    assert search.status_code == 200
    assert search.json()["status"] == "DATA_UNAVAILABLE"
    ground = client.post("/api/v1/reality/ground", json={"city": "TIANJIN", "origin_query": "天津大学卫津路校区", "destination_query": "天津医科大学总医院"})
    assert ground.status_code == 200
    assert ground.json()["status"] == "DATA_UNAVAILABLE"
    assert "driving" not in ground.json()


def test_selected_tianjin_pois_support_non_golden_and_cross_city_routes():
    class SelectedPlaces(FakeAmap):
        def _request(self, path: str, **params: str) -> dict:
            if path.endswith("/place/text"):
                city = "北京市" if params["keywords"] == "北京南站" else "天津市"
                point = "116.38,39.86" if city == "北京市" else "117.19,39.13"
                return {"status": "1", "pois": [{"id": params["keywords"].encode().hex(), "name": params["keywords"], "cityname": city, "location": point}]}
            if path.endswith("/place/detail"):
                city = "北京市" if params["id"] == "beijing" else "天津市"
                point = "116.38,39.86" if city == "北京市" else "117.19,39.13"
                return {"status": "1", "pois": [{"id": params["id"], "name": "北京南站" if city == "北京市" else "天津站", "cityname": city, "location": point, "address": "车站周边"}]}
            if path.endswith("/direction/driving") or path.endswith("/direction/walking"):
                return {"status": "1", "route": {"paths": [{"distance": "100000", "duration": "6000", "steps": [{"polyline": f"{params['origin']};{params['destination']}"}]}]}}
            return super()._request(path, **params)

    provider = SelectedPlaces()
    assert provider.search_places("北京南站", "ALL")["candidates"][0]["city"] == "北京市"
    assert provider.search_places("北京南站", "TIANJIN")["candidates"] == []
    reference = ground_reference_by_ids(provider, "tianjin", "beijing")
    assert reference["status"] == "OK"
    assert reference["origin"]["id"] == "tianjin"
    assert reference["destination"]["id"] == "beijing"
    assert reference["safety_review"] == "NOT_PERFORMED"
    assert reference["accessibility"] == "UNKNOWN"
    assert reference["driving"]["geometry"]
    assert ground_reference_by_ids(provider, "beijing", "tianjin")["status"] == "DATA_UNAVAILABLE"

    class WrongCityGeometry(SelectedPlaces):
        def get_driving_route(self, origin, destination):
            route = super().get_driving_route(origin, destination)
            route["geometry"] = [[114.05, 22.54], [114.06, 22.55]]
            return route

    assert ground_reference_by_ids(WrongCityGeometry(), "tianjin", "beijing")["status"] == "DATA_UNAVAILABLE"


def test_selected_route_missing_data_never_becomes_a_route():
    assert ground_reference_by_ids(FakeAmap(fail=True), "one", "two")["status"] == "DATA_UNAVAILABLE"
    try:
        ground_reference_by_ids(FakeAmap(), "invalid id", "two")
        assert False, "invalid IDs must be rejected"
    except ValueError:
        pass
    client = TestClient(app)
    assert client.post("/api/v1/reality/route-by-id", json={"origin_id": "invalid id", "destination_id": "two"}).status_code == 422

    class NullDuration(FakeAmap):
        def _request(self, path: str, **params: str) -> dict:
            if path.endswith("/place/detail"):
                point = "117.17,39.10" if params["id"] == "one" else "117.18,39.11"
                return {"status": "1", "pois": [{"id": params["id"], "name": params["id"], "cityname": "天津市", "location": point}]}
            if path.endswith("/direction/driving"):
                return {"status": "1", "route": {"paths": [{"distance": "1800", "duration": None, "steps": [{"polyline": "117.17,39.10;117.18,39.11"}]}]}}
            return super()._request(path, **params)

    assert ground_reference_by_ids(NullDuration(), "one", "two")["status"] == "DATA_UNAVAILABLE"

    class BrokenGeometry(NullDuration):
        def _request(self, path: str, **params: str) -> dict:
            if path.endswith("/direction/driving"):
                return {"status": "1", "route": {"paths": [{"distance": "1800", "duration": "600", "steps": [{"polyline": "117.17,39.10;broken-point;117.18,39.11"}]}]}}
            return super()._request(path, **params)

    assert ground_reference_by_ids(BrokenGeometry(), "one", "two")["status"] == "DATA_UNAVAILABLE"
