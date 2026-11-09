"""Add explicitly estimated CNBH-10m roof heights to an existing city bundle."""
from __future__ import annotations

import argparse
from contextlib import ExitStack
from datetime import datetime, timezone
import json
from pathlib import Path
import shutil

import numpy as np
import orjson
import rasterio
from rasterio.features import rasterize
from rasterio.merge import merge
from rasterio.transform import from_bounds, rowcol
from rasterio.vrt import WarpedVRT
from shapely import from_geojson, get_x, get_y, point_on_surface

from prepare_flight_city import CELL_COUNT, TILE_DEGREES, tile_bounds
from agent.flight_simulation import ESTIMATED_HEIGHT, OCCUPIED, UNKNOWN_HEIGHT

GRID_DTYPE = np.dtype([('ground', '<f4'), ('top', '<f4'), ('flags', 'u1')])
SOURCE = 'Wu et al. CNBH-10m, 2020 model estimate, CC BY 4.0 · https://doi.org/10.5281/zenodo.7923866'


def estimate_tile(source_grid, records, rasters, bounds):
    target_grid = np.fromfile(source_grid, dtype=GRID_DTYPE).reshape((CELL_COUNT, CELL_COUNT))[::-1].copy()
    ground = target_grid['ground']
    top = ground.copy()
    flags = np.zeros(ground.shape, dtype='uint8')
    selected = [item for item in rasters if not (item.bounds.right <= bounds[0] or item.bounds.left >= bounds[2]
                or item.bounds.top <= bounds[1] or item.bounds.bottom >= bounds[3])]
    missing = [record for record in records if record['height_m'] is None and record['base_m'] is not None]
    if selected and missing:
        heightmap, transform = merge(selected, bounds=bounds, res=TILE_DEGREES / 216,
                                     dtype='float32', nodata=np.nan, method='max')
        polygons = from_geojson([orjson.dumps(record['geometry']) for record in missing])
        points = point_on_surface(polygons)
        rows, columns = rowcol(transform, get_x(points), get_y(points))
        for record, row, column in zip(missing, rows, columns):
            if 0 <= row < heightmap.shape[1] and 0 <= column < heightmap.shape[2]:
                height = float(heightmap[0, row, column])
                if 0 < height <= 1000:
                    record['height_m'] = round(height, 2)
                    record['height_source'] = 'CNBH_2020'
    modeled, estimated, unknown = [], [], []
    for record in records:
        geometry = record['geometry']
        if record['height_m'] is None or record['base_m'] is None:
            unknown.append(geometry)
        else:
            modeled.append((geometry, record['height_m'] + record['base_m']))
            if record.get('height_source') == 'CNBH_2020':
                estimated.append(geometry)
    options = {'out_shape': ground.shape, 'transform': from_bounds(*bounds, CELL_COUNT, CELL_COUNT), 'all_touched': True}
    for shapes, value in [([record['geometry'] for record in records], OCCUPIED),
                          (unknown, UNKNOWN_HEIGHT), (estimated, ESTIMATED_HEIGHT)]:
        if shapes:
            flags |= rasterize(shapes, default_value=value, dtype='uint8', **options)
    if modeled:
        modeled.sort(key=lambda item: item[1])
        top = np.maximum(top, rasterize(modeled, fill=-np.inf, dtype='float32', **options))
    target_grid['top'], target_grid['flags'] = top, flags
    return target_grid[::-1].tobytes(), len(estimated), len(unknown)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path)
    parser.add_argument('output', type=Path)
    parser.add_argument('rasters', type=Path, nargs='+')
    args = parser.parse_args()
    manifest = json.loads((args.source / 'manifest.json').read_text(encoding='utf-8'))
    staging = args.output.with_name(args.output.name + '.staging')
    if args.output.exists():
        parser.error('Output bundle already exists')
    staging.mkdir(parents=True, exist_ok=False)
    estimates, unknown = 0, 0
    building_tiles = []
    with ExitStack() as stack:
        sources = [stack.enter_context(rasterio.open(path)) for path in args.rasters]
        rasters = [stack.enter_context(WarpedVRT(source, crs='EPSG:4326', src_nodata=0, nodata=0))
                   for source in sources]
        for index, name in enumerate(manifest['tiles'], 1):
            grid = args.source / f'{name}.grid'
            buildings = args.source / f'{name}.json'
            if buildings.is_file():
                bounds = tile_bounds(*(int(value) for value in name.split('_')))
                records = orjson.loads(buildings.read_bytes())
                updated, count, missing = estimate_tile(grid, records, rasters, bounds)
                (staging / grid.name).write_bytes(updated)
                (staging / buildings.name).write_bytes(orjson.dumps(records))
                building_tiles.append(name)
                estimates += count
                unknown += missing
            else:
                shutil.copyfile(grid, staging / grid.name)
            if index % 250 == 0:
                print(f'高度估计 {index}/{len(manifest["tiles"])}，已补 {estimates:,} 条分块记录', flush=True)
    manifest.update(estimated_height_records=estimates, unknown_height_records=unknown, building_tiles=building_tiles,
                    prepared_at=datetime.now(timezone.utc).isoformat())
    manifest['source']['height_estimates'] = SOURCE
    (staging / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')
    staging.rename(args.output)
    print(f'估计高度 {estimates:,} 条，未知 {unknown:,} 条（分块记录）', flush=True)


if __name__ == '__main__':
    main()
