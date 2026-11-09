"""Local city data and a deterministic trajectory tool for simulation."""
from __future__ import annotations

import json
import math
import struct
from functools import lru_cache
from pathlib import Path

TILE_DEGREES = 0.02
CELL_COUNT = 72
CELL_DEGREES = TILE_DEGREES / CELL_COUNT
CELL = struct.Struct('<ffB')  # ellipsoid ground, known modeled top, building flags
OCCUPIED, UNKNOWN_HEIGHT, ESTIMATED_HEIGHT = 1, 2, 4
METRES_PER_DEGREE = 111_320
MARGIN_M = 30
MODEL_ROOT = Path(__file__).resolve().parents[1] / 'artifacts' / 'flight-models'


@lru_cache(maxsize=192)
def read_grid(path: Path, model_version: int) -> bytes:
    grid = path.read_bytes()
    if len(grid) != CELL.size * CELL_COUNT ** 2:
        raise ValueError('Invalid city grid size')
    return grid


class CityModel:
    def __init__(self, directory: Path):
        self.directory = directory
        manifest_path = directory / 'manifest.json'
        self.version = manifest_path.stat().st_mtime_ns
        self.manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
        if self.manifest['format_version'] != 1:
            raise ValueError('Unsupported city bundle format')
        self.tiles = frozenset(self.manifest['tiles'])

    def cell(self, column: int, row: int) -> tuple[float | None, float | None, int]:
        tile_x, cell_x = divmod(column, CELL_COUNT)
        tile_y, cell_y = divmod(row, CELL_COUNT)
        tile = f'{tile_x}_{tile_y}'
        if tile not in self.tiles:
            return None, None, 0
        grid = read_grid(self.directory / f'{tile}.grid', self.version)
        ground, top, flags = CELL.unpack_from(grid, (cell_y * CELL_COUNT + cell_x) * CELL.size)
        return ground if math.isfinite(ground) else None, top if math.isfinite(top) else None, flags

    def window(self, point: tuple[float, float], radius_m: float) -> dict:
        lon, lat = point
        lat_delta = radius_m / METRES_PER_DEGREE
        lon_delta = lat_delta / math.cos(math.radians(lat))
        west = math.floor((lon + 180 - lon_delta) / CELL_DEGREES)
        east = math.floor((lon + 180 + lon_delta) / CELL_DEGREES)
        south = math.floor((lat + 90 - lat_delta) / CELL_DEGREES)
        north = math.floor((lat + 90 + lat_delta) / CELL_DEGREES)
        return {(x, y): self.cell(x, y) for y in range(south, north + 1) for x in range(west, east + 1)}

    def ground(self, lon: float, lat: float) -> float | None:
        return self.cell(math.floor((lon + 180) / CELL_DEGREES), math.floor((lat + 90) / CELL_DEGREES))[0]


def simulate_flight(model, origin: tuple[float, float], destination: tuple[float, float]) -> dict:
    """Construct a vertical rise, straight crossing, and vertical descent in model space."""
    lon_a, lat_a = origin
    lon_b, lat_b = destination
    distance = METRES_PER_DEGREE * math.hypot(
        (lon_b - lon_a) * math.cos(math.radians((lat_a + lat_b) / 2)), lat_b - lat_a)
    start_ground = next(iter(model.window(origin, 0).values()))[0]
    end_ground = next(iter(model.window(destination, 0).values()))[0]
    result = {
        'status': 'DATA_UNAVAILABLE', 'data_status': 'SIMULATED_DATA',
        'height_reference': 'WGS84_ELLIPSOID_M', 'landing_site_status': 'DATA_UNAVAILABLE',
        'airspace_status': 'DATA_UNAVAILABLE', 'origin_ground_m': start_ground,
        'destination_ground_m': end_ground, 'highest_modeled_surface_m': None,
        'simulation_margin_m': MARGIN_M, 'unknown_building_cells': 0,
        'estimated_building_cells': 0, 'missing_terrain_cells': 0, 'geometry': [], 'phases': [], 'reason': '',
    }
    if not 100 <= distance <= 150_000:
        return {**result, 'reason': '模拟走廊长度需在 100 米至 150 公里之间。'}
    if start_ground is None or end_ground is None:
        return {**result, 'reason': '端点地形缺失或超出导入范围。'}
    for label, point in [('起点', origin), ('终点', destination)]:
        if any(flags & OCCUPIED for _, _, flags in model.window(point, MARGIN_M).values()):
            return {**result, 'reason': f'{label}附近模型格网与建筑重叠，请另选模拟点。'}

    # The extra half-step covers the space between samples. A square window
    # overcovers the circular corridor and conservatively retains edge cells.
    steps = math.ceil(distance / 12)
    cells = {}
    for i in range(steps + 1):
        fraction = i / steps
        point = (lon_a + (lon_b - lon_a) * fraction, lat_a + (lat_b - lat_a) * fraction)
        cells.update(model.window(point, MARGIN_M + 6))
    missing = sum(ground is None for ground, _, _ in cells.values())
    unknown = sum(bool(flags & UNKNOWN_HEIGHT) for _, _, flags in cells.values())
    estimated = sum(bool(flags & ESTIMATED_HEIGHT) for _, _, flags in cells.values())
    highest = max((top for _, top, _ in cells.values() if top is not None), default=None)
    result.update(missing_terrain_cells=missing, unknown_building_cells=unknown,
                  estimated_building_cells=estimated, highest_modeled_surface_m=highest)
    if missing or highest is None:
        return {**result, 'reason': '走廊存在缺失地形，无法计算模拟轨迹。'}

    crossing = math.ceil(max(highest, start_ground, end_ground) + MARGIN_M)
    geometry = [[lon_a, lat_a, start_ground], [lon_a, lat_a, crossing]]
    # Cesium renders adjacent WGS84 vertices as chords. Subdivide the crossing
    # to keep the display close to constant ellipsoid height over long routes.
    segments = math.ceil(distance / 500)
    geometry.extend([lon_a + (lon_b - lon_a) * i / segments,
                     lat_a + (lat_b - lat_a) * i / segments, crossing]
                    for i in range(1, segments))
    geometry.extend([[lon_b, lat_b, crossing], [lon_b, lat_b, end_ground]])
    partial = bool(unknown or estimated)
    if unknown:
        reason = '未知建筑高度未计入，轨迹仅供推演。'
    elif estimated:
        reason = '走廊包含遥感估计楼高，轨迹仅供推演。'
    else:
        reason = '已按模型中的地形和来源高度生成候选。'
    return {**result, 'geometry': geometry, 'phases': ['ASCENT', 'CROSSING', 'DESCENT'],
            'status': 'PARTIAL_PREVIEW' if partial else 'MODEL_CANDIDATE', 'reason': reason}
