import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import AMapLoader from '@amap/amap-jsapi-loader';
import type { TripRoute } from './api';

const CityScene = lazy(() => import('./CityScene'));

export function MvpMap({ route, mode }: { route: TripRoute | null; mode: 'ground' | 'air' }) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<any>(null);
  const amap = useRef<any>(null);
  const overlays = useRef<any[]>([]);
  const currentRoute = useRef(route);
  currentRoute.current = route;
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState('正在加载高德地图…');
  const [view, setView] = useState<'2d' | '3d'>('2d');
  const [sceneOpened, setSceneOpened] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let disposed = false;
    let expired = false;
    const mapContainer = container.current;
    const labelAssets = () => {
      mapContainer?.querySelectorAll<HTMLIFrameElement>('iframe:not([title])').forEach((frame) => { frame.title = '高德地图键盘交互区域'; });
      mapContainer?.querySelectorAll<HTMLImageElement>('img:not([alt])').forEach((img) => { img.alt = '高德地图标识'; });
    };
    const observer = mapContainer ? new MutationObserver(labelAssets) : null;
    if (mapContainer) observer?.observe(mapContainer, { childList: true, subtree: true });
    setReady(false);
    setMessage('正在加载高德地图…');
    const timeout = setTimeout(() => {
      expired = true;
      if (!disposed) { map.current?.destroy(); map.current = null; setReady(false); setMessage('地图加载超时，请检查网络后重试。行程文字仍可使用。'); }
    }, 20000);
    async function load() {
      try {
        const response = await fetch('/__amap_config', { cache: 'no-store' });
        if (!response.ok) throw new Error('地图配置不完整，请联系本机维护者。');
        const config = await response.json();
        window._AMapSecurityConfig = { serviceHost: `${location.origin}/_AMapService` };
        const AMap = await AMapLoader.load({ key: config.key, version: '2.0', plugins: ['AMap.Geolocation', 'AMap.Scale', 'AMap.ToolBar'] });
        if (disposed || expired || !container.current) return;
        amap.current = AMap;
        const instance = new AMap.Map(container.current, { center: [117.18, 39.12], zoom: 12, viewMode: '2D', resizeEnable: true });
        map.current = instance;
        instance.addControl(new AMap.Scale());
        instance.addControl(new AMap.ToolBar({ position: 'RB' }));
        instance.on('complete', () => {
          if (disposed || expired) return;
          clearTimeout(timeout);
          setReady(true);
          setMessage('高德地图已加载。');
        });
        const locator = new AMap.Geolocation({ enableHighAccuracy: true, timeout: 8000, panToLocation: false, showMarker: false, showCircle: false });
        instance.addControl(locator);
        locator.getCurrentPosition((status: string, result: any) => {
          if (disposed || expired || currentRoute.current) return;
          if (status === 'complete' && result?.position) {
            instance.setZoomAndCenter(14, result.position);
            setMessage('已定位到当前位置，定位仅用于浏览地图。');
          } else setMessage('当前位置不可用，暂显示天津；您仍可输入出发地。');
        });
      } catch (error) {
        clearTimeout(timeout);
        if (!disposed) setMessage(error instanceof Error ? error.message : '高德地图暂不可用，请检查网络后重试。');
      }
    }
    void load();
    return () => { disposed = true; clearTimeout(timeout); observer?.disconnect(); map.current?.destroy(); map.current = null; };
  }, [attempt]);

  useEffect(() => {
    const instance = map.current;
    const AMap = amap.current;
    if (!ready || !instance || !AMap) return;
    instance.remove(overlays.current);
    overlays.current = [];
    if (!route) return;
    const path = mode === 'ground' ? route.ground.geometry : [route.origin.location, route.destination.location];
    if (path.length < 2 || !path.every((p) => p.length === 2 && p.every(Number.isFinite))) {
      setMessage('路线坐标不可用，未绘制路线。'); return;
    }
    const items = [new AMap.Polyline({ path, strokeWeight: 7, strokeColor: mode === 'ground' ? '#2563eb' : '#7c3aed', strokeStyle: mode === 'ground' ? 'solid' : 'dashed', showDir: mode === 'ground' }),
      new AMap.Marker({ position: route.origin.location, title: `出发地：${route.origin.name}`, label: { content: '起点' } }),
      new AMap.Marker({ position: route.destination.location, title: `目的地：${route.destination.name}`, label: { content: '终点' } })];
    instance.add(items);
    overlays.current = items;
    instance.setFitView(items, true, [80, 70, 90, 70]);
    setMessage(mode === 'ground' ? '已显示高德真实驾车道路参考。' : '模拟空中路线 · 紫色虚线，仅作空间参考。');
  }, [ready, route, mode]);

  useEffect(() => {
    if (view === '2d') requestAnimationFrame(() => { map.current?.resize(); });
  }, [view]);

  return <section className="v2-map" aria-label="行程地图">
    <div className="v2-map-controls">
      <button aria-pressed={view === '2d'} onClick={() => setView('2d')}>二维地图</button>
      <button aria-pressed={view === '3d'} onClick={() => { setSceneOpened(true); setView('3d'); }}>3D 城市</button>
      {view === '2d' && <button onClick={() => { if (overlays.current.length) map.current?.setFitView(overlays.current, true, [80, 70, 90, 70]); else { map.current?.setZoomAndCenter(12, [117.18, 39.12]); } }}>复位视角</button>}
    </div>
    <div className={`v2-map-layer ${view !== '2d' ? 'v2-hidden' : ''}`} aria-hidden={view !== '2d'}>
      <div ref={container} className="v2-amap" data-testid="amap-container" />
      <div className="v2-map-message" role="status">{message}{!ready && <button onClick={() => setAttempt((n) => n + 1)}>重新加载地图</button>}</div>
    </div>
    {sceneOpened && <div className={`v2-map-layer ${view !== '3d' ? 'v2-hidden' : ''}`} aria-hidden={view !== '3d'}>
      <Suspense fallback={<p className="v2-map-message">正在打开 3D 城市…</p>}><CityScene route={route} mode={mode} active={view === '3d'} /></Suspense>
    </div>}
    {mode === 'air' && route && <div className="v2-sim-badge">模拟空中路线 · 无飞行许可或运营含义</div>}
  </section>;
}
