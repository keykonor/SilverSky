import json
from contextlib import nullcontext

import httpx
import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from backend.app import app
from backend import v2
from backend.v2_geo import gcj02_to_wgs84, simulated_air_reference, wgs84_to_gcj02

client = TestClient(app)


def intent(**changes):
    return v2.TripIntent(**{**dict(origin="天津大学", destination="总医院", departure_time=None, age=None, mobility=None, preferences=None), **changes})


class Provider:
    key = "configured"

    def resolve_place(self, query, city):
        return {"status": "NEEDS_SELECTION", "candidates": [{"id": "POIA", "name": query, "location": [117.17, 39.1]}], "place": None}

    def get_place_details(self, ident):
        return {"id": ident, "name": ident, "location": [117.17 if ident == "POIA" else 117.19, 39.1], "city": "天津市"}

    def get_driving_route(self, a, b):
        return {"geometry": [a, [117.18, 39.105], b], "distance_m": 2000, "duration_min": 8, "source": "高德", "retrieved_at": "2026-10-08T10:00:00+00:00", "steps": []}


@pytest.fixture(autouse=True)
def fake_provider(monkeypatch):
    monkeypatch.setattr(v2, "AmapGroundRealityProvider", Provider)


def test_interpret_ambiguity_does_not_choose_first(monkeypatch):
    monkeypatch.setattr(v2, "extract_intent", lambda text: intent())
    response = client.post('/api/v2/interpret', json={"text": "从天津大学去总医院"})
    assert response.status_code == 200
    result = response.json()
    assert result["resolved"] == {"origin": None, "destination": None}
    assert result["origin_candidates"][0]["id"] == "POIA"


def test_missing_location_and_optional_fields(monkeypatch):
    monkeypatch.setattr(v2, "extract_intent", lambda text: intent(origin=None, age=76, mobility="轮椅"))
    result = client.post('/api/v2/interpret', json={"text": "我76岁，用轮椅，去总医院"}).json()
    assert result["missing_fields"] == ["origin"]
    assert result["origin_candidates"] == []
    assert result["intent"]["age"] == 76


def test_model_cannot_silently_expand_ambiguous_places(monkeypatch):
    monkeypatch.setattr(v2, "extract_intent", lambda text: intent(origin="天津大学卫津路校区"))
    monkeypatch.setattr(Provider, "resolve_place", lambda *args: pytest.fail("hallucinated place must not be searched"))
    response = client.post('/api/v2/interpret', json={"text": "从天津大学去总医院"})
    assert response.status_code == 502
    assert "原文不一致" in response.json()['detail']


@pytest.mark.parametrize('text,supplied,mode,time', [
    ('明天下午3点出发', '明天下午3点', 'EXACT', '2026-10-09T15:00:00+08:00'),
    ('明天上午九点半出发', '明天上午九点半', 'EXACT', '2026-10-09T09:30:00+08:00'),
    ('明天09:00出发', '明天09:00', 'EXACT', '2026-10-09T09:00:00+08:00'),
    ('明天下午出发', '明天下午', 'NEEDS_CONFIRMATION', None),
    ('从天津大学去总医院', None, 'NOW', None),
    ('明天25:99出发', '明天25:99', 'NEEDS_CONFIRMATION', None),
])
def test_departure_time_only_from_literal_text(text, supplied, mode, time):
    result = v2.departure_plan(text, supplied, '2026-10-08T12:00:00+08:00')
    assert result['mode'] == mode and result['departure_time'] == time


def test_past_departure_needs_edit_and_unrecognized_model_time_not_trusted():
    result = v2.departure_plan('今天09:00出发', '今天09:00', '2026-10-08T12:00:00+08:00')
    assert '已过去' in result['message']
    result = v2.departure_plan('去总医院', '明天09:00', '2026-10-08T12:00:00+08:00')
    assert result['departure_time'] is None and result['mode'] == 'NEEDS_CONFIRMATION'


@pytest.mark.parametrize('change', [{"coordinates": [117, 39]}, {"age": "76"}, {"age": 121}, {"age": True}, {"origin": "x"*81}])
def test_model_schema_rejects_coordinates_extra_and_wrong_types(change):
    with pytest.raises(ValidationError):
        intent(**change)


def test_emergency_blocks_before_model(monkeypatch):
    monkeypatch.setattr(v2, "extract_intent", lambda text: pytest.fail("must not send emergency to model"))
    response = client.post('/api/v2/interpret', json={"text": "胸痛，去总医院"})
    assert response.status_code == 422
    assert '120' in response.json()["detail"]


@pytest.mark.parametrize('text', ['', '  ', 'a'*2001])
def test_invalid_text(text):
    assert client.post('/api/v2/interpret', json={"text": text}).status_code == 422


def test_ground_geometry_preserved_and_air_labeled():
    result = client.post('/api/v2/route', json={"origin_id": "POIA", "destination_id": "POIB"}).json()
    assert result["ground"]["geometry"][1] == [117.18, 39.105]
    assert result["ground"]["data_status"] == 'PUBLIC_DATA'
    assert result["air"]["data_status"] == 'SIMULATED_DATA'
    assert result["air"]["label"] == '模拟空中路线'
    assert result["air"]["geometry"][0][2] == 0
    assert result["air"]["geometry"][16][2] > 0
    assert result["safety_review"] == 'NOT_PERFORMED'
    assert result["ground_wgs84"][0] == result["air"]["geometry"][0][:2]


@pytest.mark.parametrize('ids', [("POIA", "POIA"), ("../secret", "POIB"), ("", "POIB")])
def test_bad_ids(ids):
    assert client.post('/api/v2/route', json={"origin_id": ids[0], "destination_id": ids[1]}).status_code == 422


@pytest.mark.parametrize('failure', ['network', 'mismatch', 'missing'])
def test_upstream_route_failure_never_draws_fake_geometry(monkeypatch, failure):
    def bad(self, a, b):
        if failure == 'network': raise OSError('private URL with secret')
        return {"geometry": [[1, 2], [3, 4]] if failure == 'mismatch' else []}
    monkeypatch.setattr(Provider, 'get_driving_route', bad)
    response = client.post('/api/v2/route', json={"origin_id": "POIA", "destination_id": "POIB"})
    assert response.status_code == 502
    assert 'geometry' not in response.text
    assert 'secret' not in response.text


def test_poi_failure_is_actionable_and_secret_free(monkeypatch):
    monkeypatch.setattr(v2, 'extract_intent', lambda text: intent())
    monkeypatch.setattr(Provider, 'resolve_place', lambda *args: (_ for _ in ()).throw(RuntimeError('secret')))
    response = client.post('/api/v2/interpret', json={"text": "从天津大学去总医院"})
    assert response.status_code == 502
    assert '高德' in response.json()['detail'] and 'secret' not in response.text


@pytest.mark.parametrize('point', [[117.17,39.1], [114.06,22.54], [116.4,39.9], [121.47,31.23], [-73.9,40.7]])
def test_coordinate_roundtrip_and_air_endpoint_agreement(point):
    original = gcj02_to_wgs84(point)
    assert wgs84_to_gcj02(*original) == pytest.approx(point, abs=1e-8)
    assert simulated_air_reference(point, [117.2,39.12])['geometry'][0][:2] == original


def test_height_unknown_is_illustrative():
    assert v2.building_height({}) == (12, 'ILLUSTRATIVE')
    assert v2.building_height({'height': 'nan'}) == (12, 'ILLUSTRATIVE')
    assert v2.building_height({'building:levels': '30'}) == (12, 'ILLUSTRATIVE')
    assert v2.building_height({'height': '34 m'}) == (34, 'SOURCE_HEIGHT')


def test_building_service_failure_does_not_invent_blocks(monkeypatch):
    monkeypatch.setattr(httpx.Client, 'stream', lambda *args, **kwargs: (_ for _ in ()).throw(httpx.ConnectError('secret')))
    response = client.get('/api/v2/buildings?poi_id=POIA')
    assert response.status_code == 503
    assert 'features' not in response.text and 'secret' not in response.text


@pytest.mark.parametrize('limit', [0, 201, 'invalid'])
def test_building_budget_rejects_invalid_limit(monkeypatch, limit):
    monkeypatch.setattr(httpx.Client, 'stream', lambda *args, **kwargs: pytest.fail('invalid limit must not call OSM'))
    assert client.get(f'/api/v2/buildings?poi_id=POIA&limit={limit}').status_code == 422


def test_building_default_budget_compatible_and_extended_budget_bounded(monkeypatch):
    lon, lat = gcj02_to_wgs84([117.17, 39.1])
    nodes = f'<node id="1" lon="{lon}" lat="{lat}"/><node id="2" lon="{lon+.001}" lat="{lat}"/><node id="3" lon="{lon}" lat="{lat+.001}"/>'
    ways = ''.join(f'<way id="{i}"><nd ref="1"/><nd ref="2"/><nd ref="3"/><nd ref="1"/><tag k="building" v="yes"/></way>' for i in range(250))
    raw = f'<osm>{nodes}{ways}</osm>'.encode()
    def stream(self, method, url, **kwargs):
        assert url == 'https://api.openstreetmap.org/api/0.6/map'
        return nullcontext(httpx.Response(200, content=raw, request=httpx.Request(method, url)))
    monkeypatch.setattr(httpx.Client, 'stream', stream)
    default = client.get('/api/v2/buildings?poi_id=POIA').json()
    expanded = client.get('/api/v2/buildings?poi_id=POIA&limit=200').json()
    assert len(default['features']) == 100
    assert len(expanded['features']) == 200
    assert expanded['coordinate_system'] == 'WGS84'
    assert all(f['height_status'] == 'ILLUSTRATIVE' and f['height_m'] == 12 for f in expanded['features'])


def test_osm_real_footprints_only_and_missing_nodes_rejected():
    raw = b'''<osm><node id="1" lon="117" lat="39"/><node id="2" lon="117.001" lat="39"/>
    <node id="3" lon="117" lat="39.001"/><way id="10"><nd ref="1"/><nd ref="2"/><nd ref="3"/><nd ref="1"/><tag k="building" v="yes"/></way>
    <way id="11"><nd ref="1"/><nd ref="2"/><nd ref="9"/><nd ref="1"/><tag k="building" v="yes"/></way>
    <way id="12"><nd ref="1"/><nd ref="2"/><nd ref="3"/><nd ref="1"/><tag k="highway" v="residential"/></way></osm>'''
    buildings = v2.osm_buildings(raw)
    assert len(buildings) == 1 and buildings[0]['id'] == '10'
    assert buildings[0]['geometry'][0] == buildings[0]['geometry'][-1]
    assert v2.building_height(buildings[0]['tags']) == (12, 'ILLUSTRATIVE')


def test_city_buildings_without_poi_or_key(monkeypatch):
    monkeypatch.setattr(v2, 'AmapGroundRealityProvider', lambda: pytest.fail('city browsing must not need AMap'))
    raw = b'<osm><node id="1" lon="117.19" lat="39.12"/><node id="2" lon="117.191" lat="39.12"/><node id="3" lon="117.19" lat="39.121"/><way id="10"><nd ref="1"/><nd ref="2"/><nd ref="3"/><nd ref="1"/><tag k="building" v="yes"/><tag k="height" v="35"/></way></osm>'
    def stream(self, method, url, **kwargs):
        assert url == 'https://api.openstreetmap.org/api/0.6/map'
        bbox = [float(v) for v in kwargs['params']['bbox'].split(',')]
        assert bbox == pytest.approx([117.185, 39.116, 117.195, 39.124])
        return nullcontext(httpx.Response(200, content=raw, request=httpx.Request(method, url)))
    monkeypatch.setattr(httpx.Client, 'stream', stream)
    response = client.get('/api/v2/city-buildings?longitude=117.19&latitude=39.12')
    assert response.status_code == 200
    data = response.json()
    assert data['data_status'] == 'PUBLIC_DATA' and data['coordinate_system'] == 'WGS84'
    assert data['features'][0]['height_m'] == 35
    assert data['features'][0]['height_status'] == 'SOURCE_HEIGHT'
    assert 'ODbL' in data['source'] and data['retrieved_at']


@pytest.mark.parametrize('query', ['longitude=nan&latitude=39', 'longitude=inf&latitude=39',
    'longitude=180&latitude=39', 'longitude=117&latitude=90', 'latitude=39',
    'longitude=117&latitude=39&limit=501', 'longitude=117&latitude=39&limit=0'])
def test_city_buildings_invalid_request_never_calls_upstream(monkeypatch, query):
    monkeypatch.setattr(httpx.Client, 'stream', lambda *a, **kw: pytest.fail('invalid request'))
    assert client.get('/api/v2/city-buildings?' + query).status_code == 422


def test_city_buildings_failure_sanitized(monkeypatch):
    monkeypatch.setattr(httpx.Client, 'stream', lambda *a, **kw: (_ for _ in ()).throw(httpx.ConnectError('secret')))
    response = client.get('/api/v2/city-buildings?longitude=117.19&latitude=39.12')
    assert response.status_code == 503
    assert 'secret' not in response.text and 'features' not in response.text


@pytest.mark.parametrize('count,expected', [(0, 0), (550, 500)])
def test_city_buildings_empty_and_bounded(monkeypatch, count, expected):
    nodes = '<node id="1" lon="117.19" lat="39.12"/><node id="2" lon="117.191" lat="39.12"/><node id="3" lon="117.19" lat="39.121"/>'
    ways = ''.join(f'<way id="{i}"><nd ref="1"/><nd ref="2"/><nd ref="3"/><nd ref="1"/><tag k="building" v="yes"/></way>' for i in range(count))
    raw = f'<osm>{nodes}{ways}</osm>'.encode()
    monkeypatch.setattr(httpx.Client, 'stream', lambda self, method, url, **kw:
        nullcontext(httpx.Response(200, content=raw, request=httpx.Request(method, url))))
    data = client.get('/api/v2/city-buildings?longitude=117.19&latitude=39.12').json()
    assert len(data['features']) == expected
    assert all(f['height_status'] == 'ILLUSTRATIVE' and f['height_m'] == 12 for f in data['features'])


@pytest.mark.parametrize('kind', ['invalid_json', 'extra', 'truncated', 'unauthorized', 'timeout'])
def test_model_failure_is_sanitized(monkeypatch, kind):
    monkeypatch.setattr(v2, 'setting', lambda name, default='': 'test-key' if name == 'DEEPSEEK_API_KEY' else default)
    def respond(self, url, **kwargs):
        assert kwargs['json']['response_format'] == {'type':'json_object'}
        if kind == 'timeout': raise httpx.ReadTimeout('secret')
        content = '{' if kind == 'invalid_json' else json.dumps({**intent().model_dump(), **({'coordinate':[1,2]} if kind == 'extra' else {})})
        return httpx.Response(401 if kind == 'unauthorized' else 200, request=httpx.Request('POST',url), json={"choices":[{"finish_reason": 'length' if kind == 'truncated' else 'stop', "message":{"content":content}}]})
    monkeypatch.setattr(httpx.Client, 'post', respond)
    # Use request so the provider's httpx.Client.post stub cannot intercept TestClient.post.
    response = client.request('POST', '/api/v2/interpret', json={'text':'从天津大学去总医院'})
    assert response.status_code in (502,503)
    assert 'test-key' not in response.text and 'secret' not in response.text


@pytest.mark.parametrize(('statuses', 'expected', 'calls'), [
    ([500, 200], 200, 2),
    ([500, 503, 200], 502, 2),
    ([429, 200], 502, 1),
])
def test_deepseek_upstream_recovery(monkeypatch, statuses, expected, calls):
    monkeypatch.setattr(v2, 'setting', lambda name, default='': 'test-key' if name == 'DEEPSEEK_API_KEY' else default)
    seen = []

    def respond(self, url, **kwargs):
        code = statuses[len(seen)]
        seen.append(kwargs)
        payload = {'choices': [{'finish_reason': 'stop', 'message': {'content': intent().model_dump_json()}}]}
        return httpx.Response(code, request=httpx.Request('POST', url),
                              json=payload if code == 200 else {'error': {'message': 'secret'}})

    monkeypatch.setattr(httpx.Client, 'post', respond)
    result = client.request('POST', '/api/v2/interpret', json={'text': '从天津大学去总医院'})
    assert result.status_code == expected
    assert len(seen) == calls
    if expected == 200:
        assert result.json()['intent']['origin'] == '天津大学'
        assert result.json()['resolved'] == {'origin': None, 'destination': None}
        assert 0 < seen[1]['timeout'].read < 40
    elif calls == 2:
        assert '服务暂时异常' in result.json()['detail']
        assert '文字已保留' in result.json()['detail']
    assert 'secret' not in result.text and 'test-key' not in result.text
