import json

from fastapi.testclient import TestClient

from agent.flight_simulation import CELL, CELL_COUNT
from backend.app import app
from backend import flight_simulation


def test_city_api_uses_local_bundle_and_rejects_missing_coverage(tmp_path, monkeypatch):
    city = tmp_path / 'tianjin'
    city.mkdir()
    tile = '14850_6450'
    manifest = {'format_version': 1, 'id': 'tianjin', 'tiles': [tile],
                'building_tiles': [tile], 'source': {'terrain': 'test fixture'}, 'release': 'test'}
    (city / 'manifest.json').write_text(json.dumps(manifest), encoding='utf-8')
    (city / f'{tile}.grid').write_bytes(CELL.pack(8.0, 8.0, 0) * CELL_COUNT ** 2)
    (city / f'{tile}.json').write_text('[]', encoding='utf-8')
    monkeypatch.setattr(flight_simulation, 'MODEL_ROOT', tmp_path)
    client = TestClient(app)
    base = '/api/v2/flight-sim'
    cities = client.get(base + '/cities').json()
    assert [model['id'] for model in cities] == ['tianjin']
    assert 'tiles' not in cities[0]
    valid = client.post(base + '/tianjin/plan', json={'origin': [117.003, 39.006], 'destination': [117.015, 39.01]})
    assert valid.status_code == 200
    assert valid.json()['geometry'][1][2] == 38
    assert valid.json()['data_status'] == 'SIMULATED_DATA'
    missing = client.post(base + '/tianjin/plan', json={'origin': [117.003, 39.006], 'destination': [117.025, 39.01]})
    assert missing.json()['status'] == 'DATA_UNAVAILABLE' and missing.json()['geometry'] == []
    assert client.post(base + '/shenzhen/plan', json={'origin': [117, 39], 'destination': [117.01, 39]}).status_code == 404
    invalid = client.post(base + '/tianjin/plan', json={'origin': [39, 117], 'destination': [117.01, 39]})
    assert invalid.status_code == 422
    (city / f'{tile}.json').unlink()
    assert client.get(base + '/tianjin/buildings/14850/6450').status_code == 503
