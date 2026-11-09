import { useEffect, useRef, useState } from 'react'
import {
  ArcType,
  BoundingSphere,
  Cartesian2,
  Cartesian3,
  Cesium3DTileset,
  Color,
  DistanceDisplayCondition,
  EllipsoidTerrainProvider,
  HeadingPitchRange,
  ImageryLayer,
  Ion,
  LabelStyle,
  PolylineDashMaterialProperty,
  TileMapServiceImageryProvider,
  Viewer,
  buildModuleUrl,
  createOsmBuildingsAsync,
  createWorldTerrainAsync,
} from 'cesium'
import 'cesium/Build/Cesium/Widgets/widgets.css'
import type { DirectGroundReference, LocationRef, RouteOption, Segment } from '../types/contracts'
import { reviewText } from '../presentation'
import { AmapRouteMap } from './AmapRouteMap'
import './RouteMap.css'

type RouteMapProps = {
  route: RouteOption | null
  directGround?: DirectGroundReference | null
  origin?: LocationRef | null
  destination?: LocationRef | null
  city?: 'TIANJIN' | 'SHENZHEN' | null
}

type CesiumRouteMapProps = RouteMapProps & { onUnavailable?: () => void }

type Coordinate = { longitude: number; latitude: number }

const COLORS = {
  origin: Color.fromCssColorString('#146f68'),
  destination: Color.fromCssColorString('#b04d32'),
  vertiport: Color.fromCssColorString('#75499c'),
  ground: Color.fromCssColorString('#087f78'),
  air: Color.fromCssColorString('#75499c'),
}

// A display parameter on the WGS84 ellipsoid, never an operating or approved altitude.
const SIMULATED_VISUAL_ALTITUDE_M = 800
const ION_TOKEN = import.meta.env.VITE_CESIUM_ION_TOKEN?.trim()

type MapDetail = { title: string; body: string }

function shortMarkerLabel(location: LocationRef, role: string): string {
  if (role !== '模拟起降点') return role
  const suffix = location.label.match(/(?:起降点|Vertiport)\s*([A-Z])\s*$/i)?.[1]?.toUpperCase()
  return suffix ? `模拟起降点 ${suffix}` : '模拟起降点'
}

export function simulatedAirPositions(coordinates: [number, number][]): Cartesian3[] {
  // Interpolate only within supplied geometry. No missing segment is inferred.
  const lengths = coordinates.slice(1).map(([lon, lat], index) => {
    const [prevLon, prevLat] = coordinates[index]
    return Math.hypot(lon - prevLon, lat - prevLat)
  })
  const total = lengths.reduce((sum, length) => sum + length, 0)
  if (total === 0) return []
  const result: Cartesian3[] = []
  for (let step = 0; step <= 32; step += 1) {
    const progress = step / 32
    let remaining = progress * total
    let index = 0
    while (index < lengths.length - 1 && remaining > lengths[index]) remaining -= lengths[index++]
    const fraction = lengths[index] === 0 ? 0 : Math.min(1, remaining / lengths[index])
    const [lonA, latA] = coordinates[index]
    const [lonB, latB] = coordinates[index + 1]
    const heightFactor = Math.min(1, progress / 0.2, (1 - progress) / 0.2)
    result.push(Cartesian3.fromDegrees(
      lonA + (lonB - lonA) * fraction,
      latA + (latB - latA) * fraction,
      SIMULATED_VISUAL_ALTITUDE_M * heightFactor,
    ))
  }
  return result
}

function usableCoordinate(location: LocationRef | null | undefined): Coordinate | null {
  const coordinate = location?.coordinate
  if (
    !coordinate ||
    !Number.isFinite(coordinate.longitude) ||
    !Number.isFinite(coordinate.latitude) ||
    Math.abs(coordinate.longitude) > 180 ||
    Math.abs(coordinate.latitude) > 90
  ) {
    return null
  }
  return coordinate
}

function addMarker(viewer: Viewer, location: LocationRef, role: string, color: Color, details: Map<string, MapDetail>): Cartesian3 | null {
  const coordinate = usableCoordinate(location)
  if (!coordinate) return null

  // The contract supplies WGS84 location coordinates, not verified entrances.
  const position = Cartesian3.fromDegrees(coordinate.longitude, coordinate.latitude)
  const entity = viewer.entities.add({
    name: role === '模拟起降点' ? shortMarkerLabel(location, role) : `${role}：${location.label}`,
    position,
    point: {
      pixelSize: 13,
      color,
      outlineColor: Color.WHITE,
      outlineWidth: 3,
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
    },
    label: {
      text: shortMarkerLabel(location, role),
      font: '600 16px system-ui, sans-serif',
      style: LabelStyle.FILL_AND_OUTLINE,
      fillColor: Color.WHITE,
      outlineColor: Color.fromCssColorString('#173245'),
      outlineWidth: 4,
      pixelOffset: new Cartesian2(role === '模拟起降点' ? 38 : -30, role === '模拟起降点' ? 16 : -29),
      distanceDisplayCondition: new DistanceDisplayCondition(0, 80000),
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
    },
  })
  details.set(entity.id, role === '模拟起降点'
    ? { title: shortMarkerLabel(location, role), body: '仅用于 SilverSky 场景演示，非真实运营设施；位置为模拟坐标。' }
    : { title: role, body: `${location.label}。公开 POI 坐标是中心点，具体入口和上下车位置未核验。` })
  return position
}

function routeName(route: RouteOption): string {
  return route.route_type === 'GROUND_AIR_GROUND' ? '模拟低空情景' : '纯地面方案'
}

function drawable(segment: Segment): boolean {
  if (!segment.geometry || !segment.geometry_status || !segment.geometry_evidence || segment.geometry.type !== 'LineString' || segment.geometry.coordinates.length < 2) return false
  if (!segment.geometry.coordinates.every(([lon, lat]) => Number.isFinite(lon) && Number.isFinite(lat) && Math.abs(lon) <= 180 && Math.abs(lat) <= 90)) return false
  if (segment.geometry_status === 'PUBLIC_ROUTE_SNAPSHOT') return segment.segment_type !== 'AIR' && segment.geometry_evidence.data_status === 'PUBLIC_DATA'
  if (segment.geometry_status === 'SIMULATED_AIR_CORRIDOR') return segment.segment_type === 'AIR' && segment.geometry_evidence.data_status === 'SIMULATED_DATA'
  return segment.segment_type !== 'AIR' && segment.geometry_evidence.data_status === 'SIMULATED_DATA'
}

export function CesiumRouteMap({ route, origin, destination, onUnavailable }: CesiumRouteMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewerRef = useRef<Viewer | null>(null)
  const buildingsRef = useRef<Cesium3DTileset | null>(null)
  const buildingsEnabledRef = useRef(true)
  const markerDetailsRef = useRef(new Map<string, MapDetail>())
  const framingRef = useRef<Cartesian3[]>([])
  const [mapError, setMapError] = useState(false)
  const [sceneStatus, setSceneStatus] = useState<'local' | 'loading' | 'enhanced' | 'fallback'>(ION_TOKEN ? 'loading' : 'local')
  const [buildingsEnabled, setBuildingsEnabled] = useState(true)
  const [selectedDetail, setSelectedDetail] = useState<MapDetail | null>(null)
  const [frameReady, setFrameReady] = useState(false)

  useEffect(() => {
    if (!containerRef.current) return

    try {
      // An untextured globe avoids an Ion token and third-party tile requests.
      const viewer = new Viewer(containerRef.current, {
        baseLayer: ImageryLayer.fromProviderAsync(
          TileMapServiceImageryProvider.fromUrl(buildModuleUrl('Assets/Textures/NaturalEarthII')),
        ),
        animation: false,
        baseLayerPicker: false,
        fullscreenButton: false,
        geocoder: false,
        homeButton: false,
        infoBox: false,
        navigationHelpButton: false,
        sceneModePicker: false,
        selectionIndicator: false,
        timeline: false,
      })
      viewer.scene.backgroundColor = Color.fromCssColorString('#dceaf0')
      viewer.scene.globe.baseColor = Color.fromCssColorString('#e6e7da')
      viewer.scene.globe.enableLighting = false
      // A fit request must not be displaced by the tail of a wheel gesture.
      viewer.scene.screenSpaceCameraController.inertiaZoom = 0
      viewer.selectedEntityChanged.addEventListener((entity) => {
        setSelectedDetail(entity ? markerDetailsRef.current.get(entity.id) ?? null : null)
      })
      viewerRef.current = viewer
      setMapError(false)
    } catch {
      // Cesium may insert an error dialog before its constructor throws.
      containerRef.current?.replaceChildren()
      setMapError(true)
      onUnavailable?.()
    }

    return () => {
      const viewer = viewerRef.current
      viewerRef.current = null
      buildingsRef.current = null
      if (viewer && !viewer.isDestroyed()) viewer.destroy()
    }
  }, [])

  useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer || viewer.isDestroyed() || !ION_TOKEN) return
    let cancelled = false
    let failed = false
    let removeTerrainError: (() => void) | undefined
    let removeBuildingsError: (() => void) | undefined
    Ion.defaultAccessToken = ION_TOKEN

    function fallBackToLocalScene() {
      if (!viewer || cancelled || viewer.isDestroyed() || failed) return
      failed = true
      if (buildingsRef.current) {
        viewer.scene.primitives.remove(buildingsRef.current)
        buildingsRef.current = null
      }
      viewer.terrainProvider = new EllipsoidTerrainProvider()
      setSceneStatus('fallback')
    }

    async function loadOptionalScene() {
      if (!viewer) return
      setSceneStatus('loading')
      try {
        const terrain = await createWorldTerrainAsync()
        if (cancelled || viewer.isDestroyed()) return
        removeTerrainError = terrain.errorEvent.addEventListener(fallBackToLocalScene)
        viewer.terrainProvider = terrain
        if (failed) return
        const buildings = await createOsmBuildingsAsync()
        if (cancelled || viewer.isDestroyed() || failed) {
          if (!buildings.isDestroyed()) buildings.destroy()
          return
        }
        buildingsRef.current = buildings
        buildings.show = buildingsEnabledRef.current
        removeBuildingsError = buildings.tileFailed.addEventListener(fallBackToLocalScene)
        viewer.scene.primitives.add(buildings)
        if (!failed) setSceneStatus('enhanced')
      } catch {
        fallBackToLocalScene()
      }
    }
    void loadOptionalScene()
    return () => {
      cancelled = true
      removeTerrainError?.()
      removeBuildingsError?.()
    }
  }, [])

  useEffect(() => {
    buildingsEnabledRef.current = buildingsEnabled
    if (buildingsRef.current) buildingsRef.current.show = buildingsEnabled
  }, [buildingsEnabled])

  function showFullRoute() {
    const viewer = viewerRef.current
    if (!viewer || viewer.isDestroyed() || framingRef.current.length === 0) return
    frameJourney(viewer, framingRef.current)
  }

  function frameJourney(viewer: Viewer, positions: Cartesian3[]) {
    const sphere = BoundingSphere.fromPoints(positions)
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false
    viewer.camera.flyToBoundingSphere(sphere, {
      duration: reducedMotion ? 0 : 0.65,
      offset: new HeadingPitchRange(0, -0.45, Math.max(3500, sphere.radius * 2.5)),
    })
  }

  const segments = route?.segments ?? []
  const drawableCount = segments.filter(drawable).length
  const missingSegmentCount = segments.length - drawableCount
  const shownOrigin = segments[0]?.origin ?? origin
  const shownDestination = segments.at(-1)?.destination ?? destination
  const hasPublicPoi = shownOrigin?.entity_precision === 'POI' || shownDestination?.entity_precision === 'POI'
  const missingEndpoint = Boolean(
    (shownOrigin && !usableCoordinate(shownOrigin)) ||
      (shownDestination && !usableCoordinate(shownDestination)),
  )
  const airSegments = segments.filter((segment) => segment.segment_type === 'AIR')
  const hasPublicRoad = segments.some((segment) => drawable(segment) && segment.geometry_status === 'PUBLIC_ROUTE_SNAPSHOT')
  const hasReferenceGround = segments.some((segment) => drawable(segment) && segment.geometry_status === 'STRAIGHT_REFERENCE_LINE')
  const hasSimulatedAir = segments.some((segment) => drawable(segment) && segment.geometry_status === 'SIMULATED_AIR_CORRIDOR')
  const missingVertiport = airSegments.some(
    (segment) => !usableCoordinate(segment.origin) || !usableCoordinate(segment.destination),
  )

  useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer || viewer.isDestroyed()) return

    viewer.entities.removeAll()
    markerDetailsRef.current.clear()
    setSelectedDetail(null)
    const positions: Cartesian3[] = []
    const first = route?.segments[0]?.origin ?? origin
    const last = route?.segments.at(-1)?.destination ?? destination

    if (first) {
      const position = addMarker(viewer, first, '出发地', COLORS.origin, markerDetailsRef.current)
      if (position) positions.push(position)
    }
    if (last) {
      const position = addMarker(viewer, last, '目的地', COLORS.destination, markerDetailsRef.current)
      if (position) positions.push(position)
    }

    const seenVertiports = new Set<string>()
    for (const segment of route?.segments ?? []) {
      if (segment.segment_type === 'AIR') {
        for (const location of [segment.origin, segment.destination]) {
          const coordinate = usableCoordinate(location)
          if (!coordinate) continue
          const key = `${location.label}:${coordinate.longitude}:${coordinate.latitude}`
          if (seenVertiports.has(key)) continue
          seenVertiports.add(key)
          const position = addMarker(viewer, location, '模拟起降点', COLORS.vertiport, markerDetailsRef.current)
          if (position) positions.push(position)
        }
      }

      if (!drawable(segment)) continue
      const coordinates = segment.geometry!.coordinates
      if (!coordinates.every(([lon, lat]) => Number.isFinite(lon) && Number.isFinite(lat) && Math.abs(lon) <= 180 && Math.abs(lat) <= 90)) continue
      const isAir = segment.geometry_status === 'SIMULATED_AIR_CORRIDOR'
      const isReference = segment.geometry_status === 'STRAIGHT_REFERENCE_LINE'
      const path = isAir
        ? simulatedAirPositions(coordinates)
        : coordinates.map(([lon, lat]) => Cartesian3.fromDegrees(lon, lat))
      if (path.length < 2) continue
      positions.push(...path)
      viewer.entities.add({
        name: `${isAir ? '未来低空模拟航线' : isReference ? '地面示意连接' : 'OSRM 静态道路快照'}：${segment.origin.label} 至 ${segment.destination.label}`,
        polyline: {
          positions: path,
          width: isAir ? 5 : 4,
          arcType: isAir ? ArcType.NONE : ArcType.GEODESIC,
          material: isAir || isReference ? new PolylineDashMaterialProperty({ color: isAir ? COLORS.air : COLORS.ground }) : COLORS.ground,
          clampToGround: !isAir,
        },
      })
    }

    framingRef.current = positions
    setFrameReady(positions.length > 0)

    // A route without coordinates must not leave the previous route's camera framing.
    if (positions.length === 0) {
      viewer.camera.flyHome(0)
    } else {
      frameJourney(viewer, positions)
    }
  }, [route, origin, destination])

  return (
    <section className="route-map" aria-label="路线地图">
      <div ref={containerRef} className="route-map__globe" role="group" aria-label={mapError ? '三维地图不可用；请阅读路线文字说明' : 'Cesium 地理概览；路线详情见地图文字说明'} />
      <div className="route-map__header" aria-live="polite">
        <span className="route-map__eyebrow">地面 + 未来低空场景</span>
        <h2>{route ? routeName(route) : '路线位置概览'}</h2>
        {route?.route_type === 'GROUND_AIR_GROUND' && (
          <p className="route-map__simulation">仅供情景演示，不代表真实航线或可乘坐服务。</p>
        )}
        {route && <p>当前查看的方案</p>}
        <div className="route-map__actions">
          <button type="button" onClick={showFullRoute} disabled={!frameReady || mapError}>查看完整路线</button>
          {ION_TOKEN && sceneStatus !== 'fallback' && (
            <label><input type="checkbox" checked={buildingsEnabled} onChange={(event) => setBuildingsEnabled(event.target.checked)} />显示 3D 建筑</label>
          )}
        </div>
        <p className="route-map__scene-state">
          {mapError ? '地图暂时无法显示；请阅读行程阶段与安全说明。' :
            sceneStatus === 'enhanced' ? `可选三维地形已启用${buildingsEnabled ? '，建筑图层已启用' : '，建筑图层已关闭'}；图块按视角加载，不证明航线可飞。` :
            sceneStatus === 'loading' ? '正在加载可选三维城市图层；基础地图与路线可继续使用。' :
              sceneStatus === 'fallback' ? '外部三维图层不可用，已使用本地基础地图。' :
                '本地基础地图；模拟低空段仍以三维展示。'}
        </p>
      </div>
      <div className="route-map__details" aria-label="地图图例与数据说明">
        {(missingEndpoint || missingVertiport) && (
          <p role="status"><strong>位置待确认。</strong>部分地点或模拟起降点没有可用坐标。</p>
        )}
        {route && drawableCount === 0 && <p role="status"><strong>暂无可绘制线路。</strong>当前方案缺少经过来源标记的线路几何。</p>}
        {route && drawableCount > 0 && missingSegmentCount > 0 && (
          <p role="status">其余分段缺少可信几何，未绘制。</p>
        )}
        {mapError && <p role="status"><strong>地图暂时无法显示。</strong>路线文字说明仍可查看。</p>}
        {selectedDetail && <div className="route-map__selected-detail" role="status"><strong>{selectedDetail.title}</strong><p>{selectedDetail.body}</p></div>}
        {airSegments.length > 0 && (
          <div className="route-map__vertiport-list" aria-label="模拟起降点详情">
            {Array.from(new Map(airSegments.flatMap((segment) => [segment.origin, segment.destination])
              .filter((location) => usableCoordinate(location))
              .map((location) => [`${location.label}:${location.coordinate?.longitude}:${location.coordinate?.latitude}`, location])).values())
              .map((location) => (
                <button key={`${location.label}:${location.coordinate?.longitude}`} type="button" onClick={() => setSelectedDetail({
                  title: shortMarkerLabel(location, '模拟起降点'),
                  body: '仅用于 SilverSky 场景演示，非真实运营设施；位置为模拟坐标。',
                })}>{shortMarkerLabel(location, '模拟起降点')}详情</button>
              ))}
          </div>
        )}
        <div className="route-map__legend" aria-label="地图图例">
          <span><i className="route-map__swatch route-map__swatch--origin" />出发地</span>
          <span><i className="route-map__swatch route-map__swatch--destination" />目的地</span>
          {airSegments.length > 0 && <span><i className="route-map__swatch route-map__swatch--vertiport" />模拟起降点</span>}
          {drawableCount > 0 && (
            <>
              {hasPublicRoad && <span><i className="route-map__line route-map__line--ground route-map__line--solid" />公开道路快照</span>}
              {hasReferenceGround && <span><i className="route-map__line route-map__line--ground" />地面示意</span>}
              {hasSimulatedAir && <span><i className="route-map__line route-map__line--air" />模拟低空</span>}
            </>
          )}
        </div>
        {hasPublicRoad && <p className="route-map__safety-note">静态道路模型不保证无障碍通行。</p>}
        <details className="route-map__disclosure">
          <summary>数据说明</summary>
          <p>{sceneStatus === 'enhanced' ? `可选三维地形已启用，建筑图层${buildingsEnabled ? '已启用' : '已关闭'}` : '底图为本地地理概览'}；公开地点标记是 POI 中心点，未核验具体上下车位置。</p>
          {route && <p>{drawableCount} / {segments.length} 段具有可绘制几何。</p>}
          {hasPublicRoad && <p>实线是 OSRM 静态道路模型快照，不是实时导航或门到门路径，也不能保证无障碍通行。</p>}
          {hasReferenceGround && <p><strong>地面线路为示意连接，</strong>不代表实际道路导航路线。</p>}
          {hasSimulatedAir && <p><strong>未来低空模拟航线，</strong>不代表当前航线、可用航班或飞行高度。起降、爬升和巡航高度仅为画面演示，不是批准高度或飞行计划。</p>}
        </details>
        {(hasPublicPoi || hasPublicRoad || sceneStatus === 'enhanced') && (
          <p className="route-map__attribution">地点、道路或建筑数据 <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© OpenStreetMap contributors</a>；Cesium 数据署名见地图底部。</p>
        )}
      </div>
    </section>
  )
}

export function RouteMap(props: RouteMapProps) {
  const [choice, setChoice] = useState<{ routeId: string | null; mode: 'city' | 'spatial' } | null>(null)
  const [amapFailed, setAmapFailed] = useState(false)
  const [cesiumFailed, setCesiumFailed] = useState(false)
  const [mountedSpatial, setMountedSpatial] = useState(false)
  const routeId = props.directGround ? `direct:${props.directGround.origin.id}:${props.directGround.destination.id}` : props.route?.route_id ?? null
  const defaultMode = 'city'
  const mode = props.directGround ? 'city' : amapFailed ? 'spatial' : choice?.routeId === routeId ? choice.mode : defaultMode
  const showSpatial = mountedSpatial || mode === 'spatial'

  useEffect(() => {
    if (mode === 'spatial') setMountedSpatial(true)
  }, [mode])

  return <section className="route-map-shell" aria-label="城市地图与立体旅程">
    <div className="route-map-shell__controls" aria-label="地图视角">
      <span>地图视角</span>
      <button type="button" aria-pressed={mode === 'city'} disabled={amapFailed} onClick={() => setChoice({ routeId, mode: 'city' })}>真实城市地图</button>
      {!props.directGround && <button type="button" aria-pressed={mode === 'spatial'} onClick={() => setChoice({ routeId, mode: 'spatial' })}>查看立体旅程</button>}
      {props.directGround && <strong className="route-map-shell__safety" role="status">正在查看：高德在线地面路线参考；尚未经 SilverSky 安全审查。</strong>}
      {props.route && <strong className={`route-map-shell__safety${props.route.risk_assessment.review_outcome === 'REJECT' ? ' route-map-shell__safety--reject' : ''}`} role="status">正在查看：{routeName(props.route)}。安全审查：{reviewText[props.route.risk_assessment.review_outcome]}</strong>}
      {amapFailed && <span role="status">{props.directGround ? '高德地图不可用；请阅读左侧路线文字说明。' : cesiumFailed ? '高德与三维地图均不可用；请阅读路线文字说明。' : '高德地图不可用，已显示 Cesium 基础地图。'}</span>}
    </div>
    <div className="route-map-shell__stage">
      <div className={`route-map-shell__layer${mode === 'city' ? '' : ' route-map-shell__layer--hidden'}`} aria-hidden={mode !== 'city'} inert={mode !== 'city'}>
        <AmapRouteMap {...props} active={mode === 'city'} onUnavailable={() => setAmapFailed(true)} />
      </div>
      {showSpatial && <div className={`route-map-shell__layer${mode === 'spatial' ? '' : ' route-map-shell__layer--hidden'}`} aria-hidden={mode !== 'spatial'} inert={mode !== 'spatial'}>
        <CesiumRouteMap {...props} onUnavailable={() => setCesiumFailed(true)} />
      </div>}
    </div>
  </section>
}

export default RouteMap
