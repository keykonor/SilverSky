"""Prepare a local, tiled city bundle from public GIS exports.

Run from the repository root. Optional preparation packages are documented in
README.md and are not required by the running API.
"""
from __future__ import annotations

import argparse
from collections import defaultdict
from datetime import datetime, timezone
import json
import math
from pathlib import Path
import sys

import numpy as np
import rasterio
from rasterio.enums import Resampling
from rasterio.features import geometry_mask, rasterize
from rasterio.transform import from_bounds
from rasterio.windows import from_bounds as window_from_bounds
from shapely.geometry import box, shape, mapping
from shapely.prepared import prep

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from agent.flight_simulation import CELL_COUNT, MODEL_ROOT, TILE_DEGREES, OCCUPIED, UNKNOWN_HEIGHT

DTM = 'https://s3.opengeohub.org/global/dtm/v1.2/gedtm_rf_m_30m_s_20060101_20151231_go_epsg.4326.3855_v1.2.tif'
GEOID = 'https://cdn.proj.org/us_nga_egm08_25.tif'
CITY_NAMES = {'tianjin': '天津', 'shenzhen': '深圳'}


def keys(bounds):
    west, south, east, north = bounds
    for y in range(math.floor((south + 90) / TILE_DEGREES), math.ceil((north + 90) / TILE_DEGREES)):
        for x in range(math.floor((west + 180) / TILE_DEGREES), math.ceil((east + 180) / TILE_DEGREES)):
            yield x, y


def tile_bounds(x, y):
    west, south = x * TILE_DEGREES - 180, y * TILE_DEGREES - 90
    return west, south, west + TILE_DEGREES, south + TILE_DEGREES


def read_height(dataset, bounds):
    return dataset.read(1, window=window_from_bounds(*bounds, dataset.transform),
                        out_shape=(CELL_COUNT, CELL_COUNT), resampling=Resampling.bilinear,
                        masked=True, out_dtype='float32').filled(np.nan)


def polygon_only(geometry):
    if geometry.geom_type in ('Polygon', 'MultiPolygon') and geometry.area > 0:
        return geometry
    return None


def import_buildings(files, boundary, tiles):
    clip = prep(boundary)
    indexed = defaultdict(list)
    count, known, skipped = 0, 0, 0
    for path in files:
        with path.open('rb') as stream:
            for line in stream:
                feature = json.loads(line.lstrip(b'\x1e'))
                geometry = shape(feature['geometry'])
                if not clip.intersects(geometry):
                    continue
                if not geometry.is_valid or not polygon_only(geometry):
                    skipped += 1
                    continue
                height = feature['properties'].get('height')
                if not isinstance(height, (float, int)) or isinstance(height, bool) or not 0 < height <= 1000:
                    height = None
                geometry = geometry if clip.covers(geometry) else polygon_only(geometry.intersection(boundary))
                if geometry is None:
                    continue
                count += 1
                known += height is not None
                geometry_keys = list(keys(geometry.bounds))
                for key in geometry_keys:
                    if key not in tiles:
                        continue
                    part = geometry if len(geometry_keys) == 1 else polygon_only(geometry.intersection(box(*tile_bounds(*key))))
                    if part is not None:
                        indexed[key].append((part, height))
        print(f'建筑导入 {path.name}: 累计 {count:,} 条，{known:,} 条有来源高度', flush=True)
    return indexed, count, known, skipped


def write_tile(directory, key, tile_shape, terrain, geoid, buildings):
    bounds = tile_bounds(*key)
    grid_shape = (CELL_COUNT, CELL_COUNT)
    transform = from_bounds(*bounds, CELL_COUNT, CELL_COUNT)
    # GEDTM30 is orthometric (EGM2008). Cesium and the Agent use h = H + N.
    ground = read_height(terrain, bounds) + read_height(geoid, bounds)
    ground[geometry_mask([tile_shape], grid_shape, transform)] = np.nan
    top = ground.copy()
    occupied = []
    uncertain = []
    roofs = []
    objects = []
    for geometry, height in buildings:
        window = window_from_bounds(*geometry.bounds, transform)
        row0, col0 = max(0, math.floor(window.row_off)), max(0, math.floor(window.col_off))
        row1 = min(CELL_COUNT, math.ceil(window.row_off + window.height))
        col1 = min(CELL_COUNT, math.ceil(window.col_off + window.width))
        neighborhood = ground[row0:row1, col0:col1]
        valid_ground = neighborhood[np.isfinite(neighborhood)]
        base = float(valid_ground.max()) if len(valid_ground) else None
        occupied.append(geometry)
        if height is None or base is None:
            uncertain.append(geometry)
        else:
            roofs.append((geometry, base + height))
        objects.append({'geometry': mapping(geometry), 'height_m': height, 'base_m': base})
    options = {'out_shape': grid_shape, 'transform': transform, 'all_touched': True}
    flags = rasterize(occupied, default_value=OCCUPIED, dtype='uint8', **options) if occupied else np.zeros(grid_shape, dtype='uint8')
    if uncertain:
        flags |= rasterize(uncertain, default_value=UNKNOWN_HEIGHT, dtype='uint8', **options)
    if roofs:
        roofs.sort(key=lambda value: value[1])
        surface = rasterize(roofs, fill=-np.inf, dtype='float32', **options)
        top = np.maximum(top, surface)
    name = f'{key[0]}_{key[1]}'
    grid = np.empty(grid_shape, dtype=[('ground', '<f4'), ('top', '<f4'), ('flags', 'u1')])
    grid['ground'], grid['top'], grid['flags'] = ground[::-1], top[::-1], flags[::-1]
    (directory / f'{name}.grid').write_bytes(grid.tobytes())
    if objects:
        (directory / f'{name}.json').write_text(json.dumps(objects, separators=(',', ':'), allow_nan=False), encoding='utf-8')
    return int(np.isfinite(ground).sum())


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('city', choices=CITY_NAMES)
    parser.add_argument('--boundary', type=Path, required=True, help='WGS84 Polygon/MultiPolygon GeoJSON geometry')
    parser.add_argument('--boundary-source', required=True, help='public source URL or record identifier')
    parser.add_argument('--buildings', type=Path, nargs='+', required=True, help='complete Overture GeoJSONSeq exports for the boundary, including building parts')
    parser.add_argument('--release', required=True, help='release used to export buildings')
    parser.add_argument('--output-root', type=Path, default=MODEL_ROOT)
    parser.add_argument('--terrain', default=DTM, help='GEDTM30 v1.2 EGM2008 raster (public COG URL or local copy)')
    parser.add_argument('--geoid', default=GEOID, help='EGM2008 undulation raster (public PROJ URL or local copy)')
    args = parser.parse_args()
    boundary = shape(json.loads(args.boundary.read_text(encoding='utf-8-sig')))
    if not polygon_only(boundary) or not boundary.is_valid:
        parser.error('Boundary must be a valid WGS84 polygon or multipolygon')
    parts = [boundary] if boundary.geom_type == 'Polygon' else list(boundary.geoms)
    candidates = set(key for part in parts for key in keys(part.bounds))
    if len(candidates) > 10_000:
        parser.error('Boundary exceeds city import budget')
    tiles = {}
    for key in sorted(candidates):
        tile = polygon_only(boundary.intersection(box(*tile_bounds(*key))))
        if tile is not None:
            tiles[key] = tile
    indexed, count, known, skipped = import_buildings(args.buildings, boundary, tiles)
    if not count:
        parser.error('No building records intersect the boundary')
    destination = args.output_root / args.city
    if destination.exists():
        parser.error(f'Bundle already exists: {destination}')
    staging = destination.with_name(f'{destination.name}.staging')
    staging.mkdir(parents=True, exist_ok=False)
    valid_terrain = 0
    with rasterio.Env(GDAL_DISABLE_READDIR_ON_OPEN='EMPTY_DIR', GDAL_HTTP_TIMEOUT='40'), \
            rasterio.open(args.terrain) as terrain, rasterio.open(args.geoid) as geoid:
        for i, (key, tile) in enumerate(tiles.items(), 1):
            valid_terrain += write_tile(staging, key, tile, terrain, geoid, indexed.pop(key, ()))
            if i % 100 == 0:
                print(f'城市瓦片 {i}/{len(tiles)}', flush=True)
    if not valid_terrain:
        raise ValueError('No valid terrain inside the boundary')
    manifest = {'format_version': 1, 'id': args.city, 'name': CITY_NAMES[args.city],
                'bounds': list(boundary.bounds), 'regions': [list(p.bounds) for p in parts],
                'tiles': [f'{x}_{y}' for x, y in tiles], 'buildings': count,
                'known_heights': known, 'skipped_features': skipped, 'terrain_cells': valid_terrain,
                'prepared_at': datetime.now(timezone.utc).isoformat(), 'release': args.release,
                'source': {'buildings': 'Overture Maps Foundation / © OpenStreetMap contributors (ODbL)',
                           'terrain': 'OpenGeoHub GEDTM30 v1.2 (CC BY 4.0)',
                           'geoid': 'NGA EGM2008 via PROJ-data', 'boundary': args.boundary_source}}
    (staging / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')
    staging.rename(destination)
    print(f'{args.city}: {len(tiles):,} tiles, {count:,} footprints, {known:,} source heights, {valid_terrain:,} terrain cells', flush=True)


if __name__ == '__main__':
    main()
