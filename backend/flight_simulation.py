"""Same-origin API for the local city simulation Agent."""
from __future__ import annotations

from functools import lru_cache
import json
from typing import Annotated, Literal

from fastapi import APIRouter, HTTPException, Path
from pydantic import BaseModel, ConfigDict, Field

from agent.flight_simulation import CityModel, MODEL_ROOT, simulate_flight

router = APIRouter(prefix='/api/v2/flight-sim', tags=['city flight simulation'])
CityId = Literal['tianjin', 'shenzhen']
CITIES = ('tianjin', 'shenzhen')
Longitude = Annotated[float, Field(ge=-179.99, le=179.99, allow_inf_nan=False)]
Latitude = Annotated[float, Field(ge=-85, le=85, allow_inf_nan=False)]


class FlightRequest(BaseModel):
    model_config = ConfigDict(extra='forbid')
    origin: tuple[Longitude, Latitude]
    destination: tuple[Longitude, Latitude]


@lru_cache(maxsize=4)
def load_model(directory, version: int) -> CityModel:
    return CityModel(directory)


def city_model(city: CityId) -> CityModel:
    directory = MODEL_ROOT / city
    try:
        return load_model(directory, (directory / 'manifest.json').stat().st_mtime_ns)
    except (OSError, ValueError, KeyError):
        raise HTTPException(404, '该城市模型尚未导入或无法读取。') from None


@router.get('/cities')
def cities():
    ready = []
    for city in CITIES:
        try:
            manifest = city_model(city).manifest
        except HTTPException:
            continue
        ready.append({key: value for key, value in manifest.items() if key not in ('tiles', 'building_tiles')})
    return ready


@router.get('/{city}/buildings/{column}/{row}')
def buildings(city: CityId, column: Annotated[int, Path(ge=0, lt=18000)], row: Annotated[int, Path(ge=0, lt=9000)]):
    model = city_model(city)
    name = f'{column}_{row}'
    if name not in model.tiles:
        return []
    path = model.directory / f'{name}.json'
    try:
        if name in model.manifest.get('building_tiles', ()) and not path.is_file():
            raise OSError('Missing prepared building tile')
        return json.loads(path.read_text(encoding='utf-8')) if path.is_file() else []
    except (ValueError, OSError):
        raise HTTPException(503, '城市建筑分块暂不可用。') from None


@router.get('/{city}/terrain/{level}/{x}/{y}')
def terrain(city: CityId, level: Annotated[int, Path(ge=0, le=22)], x: int, y: int):
    span = 180 / (2 ** level)
    if not 0 <= x < 2 ** (level + 1) or not 0 <= y < 2 ** level:
        raise HTTPException(422, '地形分块编号超出范围。')
    model = city_model(city)
    west, north = -180 + x * span, 90 - y * span
    step = span / 32
    try:
        # The scene can display the ellipsoid beyond the data extent. Planning
        # queries retain missing data as None and never read this display fallback.
        return [model.ground(west + col * step, north - row * step) or 0
                for row in range(33) for col in range(33)]
    except (ValueError, OSError):
        raise HTTPException(503, '城市地形分块暂不可用。') from None


@router.post('/{city}/plan')
def plan(city: CityId, request: FlightRequest):
    model = city_model(city)
    try:
        result = simulate_flight(model, request.origin, request.destination)
    except (OSError, ValueError):
        raise HTTPException(503, '城市分析分块暂不可用。') from None
    return {**result, 'city': city, 'source': model.manifest['source'], 'release': model.manifest['release']}
