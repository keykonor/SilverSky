import { useEffect, useRef, useState } from 'react';
import { ArcType, BoundingSphere, Cartesian2, Cartesian3, Cartographic, Color, Credit, EllipsoidTerrainProvider, HeadingPitchRange, HeadingPitchRoll, ImageryLayer, Math as CesiumMath, OpenStreetMapImageryProvider, PolygonHierarchy, PolylineDashMaterialProperty, TileMapServiceImageryProvider, Transforms, Viewer, buildModuleUrl } from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';
import { type TripRoute } from './api';
import { useCityBuildings } from './useCityBuildings';
import { FlightSimulation } from './FlightSimulation';

const CITY_CENTERS: Record<string, [number, number]> = { 天津: [117.19, 39.12], 深圳: [114.06, 22.55] };

export default function CityScene({ route, mode, active }: { route: TripRoute | null; mode: 'ground' | 'air'; active: boolean }) {
  const container = useRef<HTMLDivElement>(null);
  const viewer = useRef<Viewer | null>(null);
  const focus = useRef<BoundingSphere | null>(null);
  const [ready, setReady] = useState(false);
  const [citySimulation, setCitySimulation] = useState(false);
  const [message, setMessage] = useState('正在创建基础 3D 场景…');
  const tripKey = route ? `${route.origin.id}|${route.destination.id}` : '';
  const [browse, setBrowse] = useState<{ tripKey: string; center: [number, number]; label: string } | null>(null);
  const selected = browse?.tripKey === tripKey ? browse : null;
  const areaCenter = selected?.center ?? (route ? undefined : CITY_CENTERS.天津);
  const areaLabel = selected?.label ?? (route ? '起点与终点' : '天津');
  const { buildings, loading, errors: buildingErrors, retry } = useCityBuildings(route?.origin.id, route?.destination.id, areaCenter);
  const [showBuildings, setShowBuildings] = useState(true);
  const illustrative = buildings?.features.filter((f) => f.height_status === 'ILLUSTRATIVE').length ?? 0;
  const buildingMessage = loading ? `正在加载${areaLabel}街区的基础城市模型…` : buildings?.features.length
    ? `基础城市模型：${buildings.features.length} 栋真实位置建筑轮廓；其中 ${illustrative} 栋采用 12 米示意高度，非真实测量。`
    : '当前街区没有可用建筑模型，保留底图与路线，未补造楼块。';
  const [mapMessage, setMapMessage] = useState('正在加载道路与地名底图…');
  const streetLayer = useRef<ImageryLayer | null>(null);

  useEffect(() => {
    if (!container.current) return;
    let disposed = false;
    let mapTimeout: ReturnType<typeof setTimeout> | undefined;
    try {
      const instance = new Viewer(container.current, { animation: false, timeline: false, baseLayerPicker: false,
        geocoder: false, homeButton: false, navigationHelpButton: false, sceneModePicker: false,
        fullscreenButton: false, selectionIndicator: false, infoBox: false,
        terrainProvider: new EllipsoidTerrainProvider(),
        baseLayer: ImageryLayer.fromProviderAsync(TileMapServiceImageryProvider.fromUrl(buildModuleUrl('Assets/Textures/NaturalEarthII'))),
        requestRenderMode: true });
      viewer.current = instance;
      const streets = new OpenStreetMapImageryProvider({ url: 'https://tile.openstreetmap.org/', maximumLevel: 19,
        credit: new Credit('<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© OpenStreetMap contributors</a>', true) });
      const loadImage = streets.requestImage.bind(streets);
      let anyTile = false;
      mapTimeout = setTimeout(() => { if (!disposed && !anyTile) setMapMessage('道路底图加载超时，请切回二维地图；当前仅为基础地理概览。'); }, 18000);
      streets.requestImage = (...args) => {
        const request = loadImage(...args);
        request?.then(() => {
          if (disposed) return;
          anyTile = true;
          clearTimeout(mapTimeout);
          setMapMessage('道路与地名底图：© OpenStreetMap · 当前视口在线加载');
        }, () => { if (!disposed) setMapMessage('部分道路底图未能加载，请检查网络或使用二维地图。'); });
        return request;
      };
      streetLayer.current = instance.imageryLayers.addImageryProvider(streets);
      instance.scene.globe.baseColor = Color.fromCssColorString('#dce5df');
      instance.scene.renderError.addEventListener(() => { if (!disposed) setMessage('3D 绘制失败，请切换二维地图继续使用。'); });
      instance.scene.rethrowRenderErrors = false;
      setReady(true);
      setMessage('鼠标拖动移动，滚轮缩放，Ctrl+拖动旋转。地形为椭球平面。');
      instance.scene.globe.tileLoadProgressEvent.addEventListener(() => { if (!disposed) instance.scene.requestRender(); });
    } catch { setMessage('此设备无法打开 3D，请切换二维地图。行程仍保留。'); }
    return () => { disposed = true; clearTimeout(mapTimeout); viewer.current?.destroy(); viewer.current = null; streetLayer.current = null; };
  }, []);

  useEffect(() => {
    const instance = viewer.current;
    if (!ready || !instance) return;
    instance.entities.removeAll();
    focus.current = null;
    if (citySimulation) {
      instance.scene.requestRender();
      return;
    }
    if (route) {
      const line = mode === 'air' ? route.air.geometry.map(([lon, lat, height]) => Cartesian3.fromDegrees(lon, lat, height)) : route.ground_wgs84.map(([lon, lat]) => Cartesian3.fromDegrees(lon, lat, 3));
      instance.entities.add({ name: mode === 'air' ? '模拟空中路线' : '高德驾车道路参考', polyline: {
        positions: line, width: 6, arcType: ArcType.NONE,
        material: mode === 'air' ? new PolylineDashMaterialProperty({ color: Color.fromCssColorString('#ab79ff'), dashLength: 22 }) : Color.fromCssColorString('#2563eb'),
      } });
      const endpoints = [route.air.geometry[0], route.air.geometry.at(-1)!];
      endpoints.forEach(([lon, lat], i) => instance.entities.add({ position: Cartesian3.fromDegrees(lon, lat, 6),
        point: { pixelSize: 12, color: i === 0 ? Color.GREEN : Color.ORANGE, outlineColor: Color.WHITE, outlineWidth: 2 },
        label: { text: `${i === 0 ? '起点' : '终点'}：${i === 0 ? route.origin.name : route.destination.name}`, font: '16px sans-serif', fillColor: Color.WHITE, showBackground: true, pixelOffset: new Cartesian2(0, -20), disableDepthTestDistance: Number.POSITIVE_INFINITY } }));
      if (mode === 'air') {
        const [lon, lat, height] = route.air.geometry[16];
        const position = Cartesian3.fromDegrees(lon, lat, height);
        const [a, b] = endpoints;
        const heading = Math.atan2((b[0]-a[0])*Math.cos(lat*Math.PI/180), b[1]-a[1]);
        instance.entities.add({ name: '通用航空器示意模型（无性能/运营含义）', position,
          orientation: Transforms.headingPitchRollQuaternion(position, new HeadingPitchRoll(heading, 0, 0)),
          model: { uri: '/models/reference-aircraft.gltf', scale: 1.5, minimumPixelSize: 70, maximumScale: 12 },
          label: { text: '航空器示意 · 模拟空中路线', pixelOffset: new Cartesian2(0, -50), font: '15px sans-serif', fillColor: Color.WHITE, showBackground: true, disableDepthTestDistance: Number.POSITIVE_INFINITY } });
      }
      focus.current = BoundingSphere.fromPoints(line);
    }
    for (const building of showBuildings ? buildings?.features ?? [] : []) {
      instance.entities.add({ name: `OSM建筑 ${building.id} · ${building.height_status === 'ILLUSTRATIVE' ? '12米示意高度' : '来源高度（未实测核验）'}`, polygon: {
        hierarchy: new PolygonHierarchy(building.footprint.map(([lon, lat]) => Cartesian3.fromDegrees(lon, lat))),
        height: 0, extrudedHeight: building.height_m,
        material: Color.fromCssColorString(building.height_status === 'ILLUSTRATIVE' ? '#d4dde3' : '#b6c6d2'),
        outline: true, outlineColor: Color.fromCssColorString('#536879'),
      } });
    }
    instance.scene.requestRender();
  }, [ready, route, mode, buildings, showBuildings, citySimulation]);

  useEffect(() => {
    // Loading/toggling buildings must not move a camera the user is exploring with.
    if (ready && !citySimulation && !areaCenter && route && focus.current) viewer.current?.camera.flyToBoundingSphere(focus.current,
      { duration: 0, offset: new HeadingPitchRange(0, -.85, Math.max(700, focus.current.radius*2.5)) });
  }, [ready, route, mode, areaCenter, citySimulation]);

  useEffect(() => {
    if (!ready || citySimulation || !areaCenter) return;
    const sphere = new BoundingSphere(Cartesian3.fromDegrees(...areaCenter), 350);
    viewer.current?.camera.flyToBoundingSphere(sphere, { duration: 0, offset: new HeadingPitchRange(.3, -.65, 1250) });
  }, [ready, areaCenter, citySimulation]);

  useEffect(() => { if (streetLayer.current) streetLayer.current.show = active; if (active) { viewer.current?.resize(); viewer.current?.scene.requestRender(); } }, [active, ready]);

  return <div className="v2-scene">
    <div ref={container} className="v2-cesium" />
    {citySimulation && viewer.current && <FlightSimulation viewer={viewer.current} visible={active} />}
    {!citySimulation && <div className="v2-scene-info" role="status"><span>{message}</span><span className="v2-street-status">{mapMessage}</span><span className="v2-building-status">{buildingMessage}</span>
      {buildingErrors.length > 0 && <span>{buildingErrors.join(' ')}<button onClick={retry} disabled={loading}>重试建筑加载</button></span>}
      {buildings && <small><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© OpenStreetMap contributors · ODbL</a> · 采集于 {new Date(buildings.retrieved_at).toLocaleString('zh-CN')}</small>}
      <small>{areaLabel}街区 · 开放数据库建筑轮廓；每次约 1 公里范围，最多 {areaCenter ? 500 : 400} 栋，非整城或实景纹理。高度相对椭球，未知高度为示意。</small>
    </div>}
    <div className="v2-scene-controls">
      <button disabled={!ready} aria-pressed={citySimulation} onClick={() => setCitySimulation((open) => !open)}>
        {citySimulation ? '关闭全城模型' : '全城模型与飞行 Agent'}
      </button>
      {!citySimulation && <>
      {Object.entries(CITY_CENTERS).map(([label, center]) => <button key={label} disabled={!ready || loading} onClick={() => setBrowse({ tripKey, center, label })}>{label}街区</button>)}
      <button disabled={!ready || loading} onClick={() => {
        const instance = viewer.current;
        if (!instance) return;
        const point = instance.camera.pickEllipsoid(new Cartesian2(instance.canvas.clientWidth / 2, instance.canvas.clientHeight / 2), instance.scene.globe.ellipsoid);
        if (!point) { setMessage('请将镜头朝向地面，再加载当前街区。'); return; }
        const position = Cartographic.fromCartesian(point);
        const center: [number, number] = [Number(CesiumMath.toDegrees(position.longitude).toFixed(5)), Number(CesiumMath.toDegrees(position.latitude).toFixed(5))];
        if (Math.abs(center[0]) > 179.99 || Math.abs(center[1]) > 85) { setMessage('当前视野超出街区模型支持范围，请选择天津或深圳。'); return; }
        setBrowse({ tripKey, center, label: '当前视野' });
      }}>加载当前街区</button>
      {route && areaCenter && <button onClick={() => setBrowse(null)}>返回行程模型</button>}
      <label><input type="checkbox" checked={showBuildings} onChange={(event) => setShowBuildings(event.target.checked)} />显示建筑</label>
      {route && !areaCenter && <button disabled={!ready} onClick={() => {
        if (!route) return;
        const [lon, lat] = route.air.geometry[0];
        viewer.current?.camera.flyToBoundingSphere(new BoundingSphere(Cartesian3.fromDegrees(lon, lat, 0), 250), { duration: .5, offset: new HeadingPitchRange(.3, -.6, 900) });
      }}>起点街区</button>}
      {route && !areaCenter && <button disabled={!ready} onClick={() => {
        if (!route) return;
        const [lon, lat] = route.air.geometry.at(-1)!;
        viewer.current?.camera.flyToBoundingSphere(new BoundingSphere(Cartesian3.fromDegrees(lon, lat, 0), 250), { duration: .5, offset: new HeadingPitchRange(.3, -.6, 900) });
      }}>终点街区</button>}
      <button disabled={!ready} onClick={() => {
        const sphere = areaCenter ? new BoundingSphere(Cartesian3.fromDegrees(...areaCenter), 350) : focus.current;
        if (sphere) viewer.current?.camera.flyToBoundingSphere(sphere, { duration: .5, offset: new HeadingPitchRange(.3, -.65, areaCenter ? 1250 : Math.max(700, sphere.radius*2.5)) });
      }}>复位 3D 视角</button>
      </>}
      <button onClick={() => { viewer.current?.camera.rotateRight(.3); viewer.current?.scene.requestRender(); }}>旋转</button>
      <button onClick={() => { viewer.current?.camera.zoomIn(250); viewer.current?.scene.requestRender(); }}>放大</button>
      <button onClick={() => { viewer.current?.camera.zoomOut(250); viewer.current?.scene.requestRender(); }}>缩小</button>
    </div>
  </div>;
}
