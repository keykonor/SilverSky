import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  ArcType, BoundingSphere, Cartesian2, Cartesian3, Cartographic, Color, Credit, CustomDataSource,
  CustomHeightmapTerrainProvider, EllipsoidTerrainProvider, GeographicTilingScheme, HeadingPitchRange,
  HeightReference, Math as CesiumMath, PolygonHierarchy, PolylineDashMaterialProperty, Rectangle,
  ScreenSpaceEventHandler, ScreenSpaceEventType, type Viewer,
} from 'cesium';
import { api } from './api';

type Point = [number, number];
type Bounds = [number, number, number, number];
type Vertex = [number, number, number];
interface City {
  id: 'tianjin' | 'shenzhen'; name: string; regions: Bounds[]; buildings: number;
  known_heights: number; release: string; terrain_cells: number; estimated_height_records?: number;
  demo_points?: { origin: Point; destination: Point };
}
interface Building {
  geometry: { type: 'Polygon'; coordinates: Point[][] } | { type: 'MultiPolygon'; coordinates: Point[][][] };
  height_m: number | null;
  base_m: number | null;
  height_source?: 'CNBH_2020';
}
interface FlightResult {
  status: 'MODEL_CANDIDATE' | 'PARTIAL_PREVIEW' | 'DATA_UNAVAILABLE';
  origin_ground_m: number | null; destination_ground_m: number | null;
  highest_modeled_surface_m: number | null; simulation_margin_m: number;
  unknown_building_cells: number; estimated_building_cells: number; missing_terrain_cells: number;
  reason: string; geometry: Vertex[];
}
const CENTERS: Record<City['id'], Point> = { tianjin: [117.19, 39.12], shenzhen: [114.06, 22.55] };
const TILE_DEGREES = .02;

function parsePoint(value: string): Point | null {
  const fields = value.trim().split(/[,，\s]+/);
  if (fields.length !== 2 || fields.some((field) => !field)) return null;
  const [lon, lat] = fields.map(Number);
  return Number.isFinite(lon) && Number.isFinite(lat) && Math.abs(lon) <= 179.99 && Math.abs(lat) <= 85
    ? [lon, lat] : null;
}

function flyToCity(viewer: Viewer, city: City) {
  const center = Cartesian3.fromDegrees(...CENTERS[city.id]);
  viewer.camera.flyToBoundingSphere(new BoundingSphere(center, 400), {
    duration: 0, offset: new HeadingPitchRange(.2, -.8, 1450),
  });
}

function addBuilding(layer: CustomDataSource, building: Building) {
  const { geometry, base_m: base, height_m: height } = building;
  const known = base !== null && height !== null;
  const estimated = building.height_source === 'CNBH_2020';
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  for (const [outer, ...holes] of polygons) {
    const ring = (points: Point[]) => points.map(([lon, lat]) => Cartesian3.fromDegrees(lon, lat));
    layer.entities.add({
      name: known ? `${estimated ? '遥感估计高度' : '来源高度'} ${height} 米` : '建筑轮廓 · 高度未知',
      polygon: {
        hierarchy: new PolygonHierarchy(ring(outer), holes.map((hole) => new PolygonHierarchy(ring(hole)))),
        height: known ? base : undefined,
        extrudedHeight: known ? base + height : undefined,
        heightReference: known ? HeightReference.NONE : HeightReference.CLAMP_TO_GROUND,
        material: Color.fromCssColorString(known ? (estimated ? '#8eaabf' : '#dde6f1') : '#708591').withAlpha(known ? 1 : .58),
      },
    });
  }
}

function useCityLayer(viewer: Viewer, city: City | undefined, visible: boolean) {
  const [message, setMessage] = useState('');
  const [terrainFailed, setTerrainFailed] = useState(false);
  useEffect(() => {
    if (!city || !visible || viewer.isDestroyed()) return;
    let disposed = false;
    let request: AbortController | undefined;
    let currentKey = '';
    const layer = new CustomDataSource('城市建筑');
    void viewer.dataSources.add(layer).then(() => {
      if (disposed && !viewer.isDestroyed()) viewer.dataSources.remove(layer, true);
    });
    const scheme = new GeographicTilingScheme();
    const terrainAbort = new AbortController();
    setTerrainFailed(false);
    viewer.terrainProvider = new CustomHeightmapTerrainProvider({
      width: 33, height: 33, tilingScheme: scheme, credit: new Credit('OpenGeoHub GEDTM30 · CC BY 4.0', true),
      callback: async (x, y, level) => {
        const rectangle = scheme.tileXYToRectangle(x, y, level);
        if (level > 22 || !city.regions.some((bounds) => Rectangle.intersection(rectangle, Rectangle.fromDegrees(...bounds)))) {
          return new Float32Array(33 * 33);
        }
        try {
          const response = await fetch(`/api/v2/flight-sim/${city.id}/terrain/${level}/${x}/${y}`, { signal: terrainAbort.signal });
          if (!response.ok) throw new Error('terrain unavailable');
          const heights = await response.json() as number[];
          if (heights.length !== 33 * 33) throw new Error('terrain size');
          return Float32Array.from(heights);
        } catch {
          if (!disposed) setTerrainFailed(true);
          return new Float32Array(33 * 33);
        }
      },
    });

    async function updateBuildings() {
      if (disposed || viewer.isDestroyed()) return;
      if (viewer.camera.positionCartographic.height > 7500) {
        request?.abort();
        currentKey = '';
        layer.entities.removeAll();
        setMessage('已打开城市概览，放大后加载视野内的建筑。');
        return;
      }
      const canvas = viewer.canvas;
      const center = viewer.camera.pickEllipsoid(new Cartesian2(canvas.clientWidth / 2, canvas.clientHeight / 2), viewer.scene.globe.ellipsoid);
      if (!center) return;
      const point = Cartographic.fromCartesian(center);
      const column = Math.floor((CesiumMath.toDegrees(point.longitude) + 180) / TILE_DEGREES);
      const row = Math.floor((CesiumMath.toDegrees(point.latitude) + 90) / TILE_DEGREES);
      const viewport = viewer.camera.computeViewRectangle();
      const tiles = [-1, 0, 1].flatMap((dy) => [-1, 0, 1].map((dx) => [column + dx, row + dy]))
        .filter(([x, y]) => {
          if (x < 0 || x >= 18000 || y < 0 || y >= 9000) return false;
          const west = x * TILE_DEGREES - 180;
          const south = y * TILE_DEGREES - 90;
          const tile = Rectangle.fromDegrees(west, south, west + TILE_DEGREES, south + TILE_DEGREES);
          return !viewport || Boolean(Rectangle.intersection(viewport, tile));
        })
        .sort(([ax, ay], [bx, by]) => Math.hypot(ax - column, ay - row) - Math.hypot(bx - column, by - row))
        .slice(0, 4);
      const key = tiles.map(([x, y]) => `${x}_${y}`).join('|');
      if (key === currentKey) return;
      currentKey = key;
      request?.abort();
      const controller = new AbortController();
      request = controller;
      setMessage('正在加载视野附近的建筑分块…');
      const responses = await Promise.allSettled(tiles.map(async ([x, y]) => {
        const response = await fetch(`/api/v2/flight-sim/${city!.id}/buildings/${x}/${y}`, { signal: controller.signal });
        if (!response.ok) throw new Error('buildings unavailable');
        return response.json() as Promise<Building[]>;
      }));
      if (disposed || controller.signal.aborted || viewer.isDestroyed()) return;
      layer.entities.suspendEvents();
      let count = 0;
      try {
        layer.entities.removeAll();
        for (const response of responses) {
          if (response.status !== 'fulfilled') continue;
          for (const building of response.value) addBuilding(layer, building);
          count += response.value.length;
        }
      } finally { layer.entities.resumeEvents(); }
      const failed = responses.some((response) => response.status === 'rejected');
      if (failed) currentKey = '';
      setMessage(`视野附近已加载 ${count.toLocaleString('zh-CN')} 条建筑记录${failed ? '，部分分块暂不可用' : ''}。`);
      viewer.scene.requestRender();
    }

    const remove = viewer.camera.moveEnd.addEventListener(() => void updateBuildings());
    flyToCity(viewer, city);
    void updateBuildings();
    return () => {
      disposed = true;
      request?.abort();
      terrainAbort.abort();
      remove();
      if (!viewer.isDestroyed()) {
        viewer.dataSources.remove(layer, true);
        viewer.terrainProvider = new EllipsoidTerrainProvider();
      }
    };
  }, [viewer, city, visible]);
  return { message, terrainFailed };
}

export function FlightSimulation({ viewer, visible }: { viewer: Viewer; visible: boolean }) {
  const [cities, setCities] = useState<City[] | null>(null);
  const [cityId, setCityId] = useState('');
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [picking, setPicking] = useState<'origin' | 'destination' | null>(null);
  const [result, setResult] = useState<FlightResult | null>(null);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const revision = useRef(0);
  const resultCard = useRef<HTMLDivElement>(null);
  const city = cities?.find((item) => item.id === cityId);
  const layer = useCityLayer(viewer, city, visible);

  useEffect(() => {
    let stale = false;
    api<City[]>('flight-sim/cities').then((items) => {
      if (stale) return;
      setCities(items);
      setCityId(items[0]?.id ?? '');
    }, () => { if (!stale) { setCities([]); setNotice('无法读取城市模型清单。'); } });
    return () => { stale = true; revision.current += 1; };
  }, []);

  useEffect(() => {
    if (visible && result) resultCard.current?.scrollIntoView({ block: 'nearest' });
  }, [result, visible]);

  function clearResult() {
    revision.current += 1;
    setBusy(false);
    setResult(null);
    setNotice('');
  }

  useEffect(() => {
    if (!visible || !picking || viewer.isDestroyed()) return;
    const handler = new ScreenSpaceEventHandler(viewer.canvas);
    handler.setInputAction((event: { position: Cartesian2 }) => {
      const ray = viewer.camera.getPickRay(event.position);
      const point = ray && viewer.scene.globe.pick(ray, viewer.scene);
      if (!point) return;
      const coordinates = Cartographic.fromCartesian(point);
      const text = `${CesiumMath.toDegrees(coordinates.longitude).toFixed(6)}, ${CesiumMath.toDegrees(coordinates.latitude).toFixed(6)}`;
      if (picking === 'origin') setOrigin(text);
      else setDestination(text);
      clearResult();
      setPicking(null);
    }, ScreenSpaceEventType.LEFT_CLICK);
    return () => { handler.destroy(); };
  }, [picking, viewer, visible]);

  useEffect(() => {
    if (!visible || !result?.geometry.length || viewer.isDestroyed()) return;
    const path = result.geometry.map(([lon, lat, height]) => Cartesian3.fromDegrees(lon, lat, height));
    const drawing = new CustomDataSource('模拟飞行轨迹');
    const partial = result.status === 'PARTIAL_PREVIEW';
    drawing.entities.add({ name: '模拟飞行轨迹', polyline: {
      positions: path, arcType: ArcType.NONE, width: 6,
      material: new PolylineDashMaterialProperty({ color: Color.fromCssColorString(partial ? '#ffad2e' : '#b589ff'), dashLength: 20 }),
    } });
    [path[0], path.at(-1)!].forEach((position, i) => drawing.entities.add({ position,
      point: { color: i ? Color.ORANGE : Color.LIME, pixelSize: 12, outlineColor: Color.WHITE, outlineWidth: 2, disableDepthTestDistance: Number.POSITIVE_INFINITY },
    }));
    let disposed = false;
    void viewer.dataSources.add(drawing).then(() => {
      if (viewer.isDestroyed()) return;
      if (disposed) viewer.dataSources.remove(drawing, true);
      else {
        const bounds = BoundingSphere.fromPoints(path);
        viewer.camera.flyToBoundingSphere(bounds, { duration: .5, offset: new HeadingPitchRange(.15, -.7, Math.max(800, bounds.radius * 3.3)) });
        viewer.scene.requestRender();
      }
    });
    return () => { disposed = true; if (!viewer.isDestroyed()) viewer.dataSources.remove(drawing, true); };
  }, [result, viewer, visible]);

  async function plan(event: FormEvent) {
    event.preventDefault();
    clearResult();
    const a = parsePoint(origin), b = parsePoint(destination);
    if (!city || !a || !b) { setNotice('请填写两个 WGS84 坐标，顺序为经度、纬度。'); return; }
    const generation = revision.current;
    setPicking(null);
    setBusy(true);
    try {
      const response = await api<FlightResult>(`flight-sim/${city.id}/plan`, { origin: a, destination: b });
      if (revision.current === generation) setResult(response);
    } catch (error) {
      if (revision.current === generation) setNotice(error instanceof Error ? error.message : '无法完成模拟。');
    } finally {
      if (revision.current === generation) setBusy(false);
    }
  }

  if (!visible) return null;
  const height = (value: number | null) => value === null ? '未知' : `${value.toFixed(1)} 米`;
  return <section className="v2-flight-panel" aria-label="模拟飞行 Agent">
    <h2>模拟飞行 Agent</h2>
    {!cities ? <p role="status">正在读取城市模型…</p> : cities.length === 0 ? <p role="status">{notice || '尚未导入城市数据包。'}</p> : <>
      <label>城市模型 <select value={cityId} onChange={(event) => {
        setCityId(event.target.value); setOrigin(''); setDestination(''); setPicking(null); clearResult();
      }}>{cities.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      {city && <p>{city.buildings.toLocaleString('zh-CN')} 条建筑记录，{city.known_heights.toLocaleString('zh-CN')} 条有来源高度。
        {city.estimated_height_records ? `另有 ${city.estimated_height_records.toLocaleString('zh-CN')} 条分块记录使用遥感估计高度。` : ''}
        {layer.message}</p>}
      {layer.terrainFailed && <p role="status">部分显示地形未加载，已回落到椭球。</p>}
      {city && <div className="v2-flight-actions">
        <button type="button" onClick={() => viewer.camera.flyTo({ destination: Rectangle.fromDegrees(...city.regions[0]) })}>城市概览</button>
        <button type="button" onClick={() => flyToCity(viewer, city)}>街区近景</button>
      </div>}
      {city?.demo_points && <button type="button" onClick={() => {
        const points = city.demo_points;
        if (!points) return;
        setOrigin(points.origin.join(', '));
        setDestination(points.destination.join(', '));
        setPicking(null);
        clearResult();
      }}>填入模拟示例</button>}
      <form onSubmit={(event) => void plan(event)}>
        <div className="v2-flight-point">
          <label>起点坐标 <input value={origin} placeholder="经度, 纬度" onChange={(event) => { setOrigin(event.target.value); clearResult(); }} /></label>
          <button type="button" aria-pressed={picking === 'origin'} onClick={() => setPicking('origin')}>地图选起点</button>
        </div>
        <div className="v2-flight-point">
          <label>终点坐标 <input value={destination} placeholder="经度, 纬度" onChange={(event) => { setDestination(event.target.value); clearResult(); }} /></label>
          <button type="button" aria-pressed={picking === 'destination'} onClick={() => setPicking('destination')}>地图选终点</button>
        </div>
        {picking && <span role="status">请在地图上点选{picking === 'origin' ? '起点' : '终点'}。</span>}
        <button type="submit" disabled={busy}>{busy ? '正在分析…' : '生成模拟轨迹'}</button>
      </form>
      {notice && <p role="status">{notice}</p>}
      {result && <div ref={resultCard} className="v2-flight-result" role="status">
        <strong>{result.status === 'DATA_UNAVAILABLE' ? '无法生成' : result.status === 'PARTIAL_PREVIEW' ? '含缺口的模拟轨迹' : '模拟候选轨迹'}</strong>
        <p>{result.reason}</p>
        <p>起点模型地面 {height(result.origin_ground_m)} · 终点模型地面 {height(result.destination_ground_m)}</p>
        <p>模型地形与障碍最高 {height(result.highest_modeled_surface_m)}{result.geometry.length > 0 && ` · 模拟跨越高度 ${height(result.geometry[1][2])}`}</p>
        {result.geometry.length > 0 && <p>模拟起升 {height(result.geometry[1][2] - result.geometry[0][2])} · 模拟下降 {height(result.geometry[1][2] - result.geometry.at(-1)![2])}</p>}
        <p>估计楼高格 {result.estimated_building_cells} · 未知楼高格 {result.unknown_building_cells} · 缺地形格 {result.missing_terrain_cells}。标高为 WGS84 椭球米。</p>
      </div>}
      <small>模拟用途。真实起降场地、空域与飞行器性能待核验。</small>
      <small><a href="https://docs.overturemaps.org/attribution/" target="_blank" rel="noreferrer">Overture Maps Foundation · © OpenStreetMap contributors</a> · {city?.release}。<a href="https://portal.opentopography.org/datasetMetadata?otCollectionID=OT.082025.4326.1" target="_blank" rel="noreferrer">地形 GEDTM30（CC BY 4.0）</a>。</small>
      {Boolean(city?.estimated_height_records) && <small><a href="https://doi.org/10.5281/zenodo.7923866" target="_blank" rel="noreferrer">建筑高度估计 CNBH-10m（2020，CC BY 4.0）</a>。</small>}
    </>}
  </section>;
}
