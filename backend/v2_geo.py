"""Display-only coordinate conversion and simulated air reference. No airspace solver."""
from __future__ import annotations

import math


def wgs84_to_gcj02(lon: float, lat: float) -> list[float]:
    if not (72.004 <= lon <= 137.8347 and 0.8293 <= lat <= 55.8271):
        return [lon, lat]
    x, y = lon - 105, lat - 35
    dlat = -100 + 2*x + 3*y + .2*y*y + .1*x*y + .2*math.sqrt(abs(x))
    dlat += (20*math.sin(6*x*math.pi) + 20*math.sin(2*x*math.pi))*2/3
    dlat += (20*math.sin(y*math.pi) + 40*math.sin(y*math.pi/3))*2/3
    dlat += (160*math.sin(y*math.pi/12) + 320*math.sin(y*math.pi/30))*2/3
    dlon = 300 + x + 2*y + .1*x*x + .1*x*y + .1*math.sqrt(abs(x))
    dlon += (20*math.sin(6*x*math.pi) + 20*math.sin(2*x*math.pi))*2/3
    dlon += (20*math.sin(x*math.pi) + 40*math.sin(x*math.pi/3))*2/3
    dlon += (150*math.sin(x*math.pi/12) + 300*math.sin(x*math.pi/30))*2/3
    rad = math.radians(lat)
    magic = 1 - .00669342162296594323 * math.sin(rad)**2
    dlat = dlat*180 / ((6378245*(1-.00669342162296594323))/(magic*math.sqrt(magic))*math.pi)
    dlon = dlon*180 / (6378245/math.sqrt(magic)*math.cos(rad)*math.pi)
    return [lon + dlon, lat + dlat]


def gcj02_to_wgs84(point: list[float]) -> list[float]:
    """Iterative numerical inverse; display approximation, not a survey guarantee."""
    target_lon, target_lat = point
    lon, lat = point
    for _ in range(8):
        converted = wgs84_to_gcj02(lon, lat)
        lon -= converted[0] - target_lon
        lat -= converted[1] - target_lat
    return [lon, lat]


def simulated_air_reference(origin: list[float], destination: list[float]) -> dict:
    # Future constrained airspace planner can replace this independent interface.
    a, b = gcj02_to_wgs84(origin), gcj02_to_wgs84(destination)
    return {
        "label": "模拟空中路线", "data_status": "SIMULATED_DATA",
        "coordinate_system": "WGS84", "height_reference": "ELLIPSOID_VISUAL_ONLY",
        "geometry": [[a[0]+(b[0]-a[0])*t/32, a[1]+(b[1]-a[1])*t/32,
                      round(180*math.sin(math.pi*t/32), 2)] for t in range(33)],
        "notice": "仅为空间参考，示意高度；未核验空域许可、飞行可行性或运营能力。两端不是起降设施。",
    }
