from agent.flight_simulation import simulate_flight


class Model:
    def __init__(self, middle=(8, 120, 1), origin=(6, 6, 0)):
        self.middle = middle
        self.origin = origin

    def window(self, point, radius):
        lon, _ = point
        if lon == 117:
            return {(0, 0): self.origin}
        if 117.004 < lon < 117.006:
            return {(1, 0): self.middle}
        return {(2, 0): (10, 10, 0)}


def run(model):
    return simulate_flight(model, (117, 39), (117.01, 39))


def test_overflies_a_known_roof_and_returns_separate_end_heights():
    result = run(Model())
    assert result['status'] == 'MODEL_CANDIDATE'
    assert result['origin_ground_m'] == 6 and result['destination_ground_m'] == 10
    assert result['geometry'][1][2] >= 120 + result['simulation_margin_m']
    assert result['geometry'][0] == [117, 39, 6]
    assert result['geometry'][-1] == [117.01, 39, 10]
    assert result['landing_site_status'] == 'DATA_UNAVAILABLE'


def test_unknown_roof_is_reported_and_does_not_become_a_height():
    result = run(Model(middle=(8, 8, 3)))
    assert result['status'] == 'PARTIAL_PREVIEW'
    assert result['unknown_building_cells'] == 1
    assert result['geometry']


def test_raster_estimates_influence_the_preview_but_remain_estimates():
    result = run(Model(middle=(8, 82, 5)))
    assert result['status'] == 'PARTIAL_PREVIEW'
    assert result['estimated_building_cells'] == 1
    assert result['geometry'][1][2] == 82 + result['simulation_margin_m']


def test_missing_terrain_or_an_occupied_endpoint_prevents_a_candidate():
    assert run(Model(middle=(None, None, 0)))['geometry'] == []
    assert run(Model(origin=(6, 30, 1)))['geometry'] == []
