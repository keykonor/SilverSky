import { useEffect, useRef, useState } from 'react'
import AMapLoader from '@amap/amap-jsapi-loader'
import type { DirectGroundReference, LocationRef, RouteOption, Segment } from '../types/contracts'
import './RouteMap.css'

type Props = {
  route: RouteOption | null
  directGround?: DirectGroundReference | null
  origin?: LocationRef | null
  destination?: LocationRef | null
  city?: 'TIANJIN' | 'SHENZHEN' | null
  onUnavailable: () => void
  active: boolean
}

type Point = [number, number]

declare global {
  interface Window {
    _AMapSecurityConfig?: { serviceHost: string }
  }
}

function validPoint(location: LocationRef | null | undefined): Point | null {
  const point = location?.coordinate
  if (!point || !Number.isFinite(point.longitude) || !Number.isFinite(point.latitude) ||
    Math.abs(point.longitude) > 180 || Math.abs(point.latitude) > 90) return null
  return [point.longitude, point.latitude]
}

function validGeometry(segment: Segment): Point[] | null {
  if (!segment.geometry || !segment.geometry_status || !segment.geometry_evidence ||
    segment.geometry.type !== 'LineString' || segment.geometry.coordinates.length < 2) return null
  if (segment.geometry_status === 'PUBLIC_ROUTE_SNAPSHOT' &&
    (segment.segment_type === 'AIR' || segment.geometry_evidence.data_status !== 'PUBLIC_DATA')) return null
  if (segment.geometry_status === 'SIMULATED_AIR_CORRIDOR' &&
    (segment.segment_type !== 'AIR' || segment.geometry_evidence.data_status !== 'SIMULATED_DATA')) return null
  if (segment.geometry_status === 'STRAIGHT_REFERENCE_LINE' &&
    (segment.segment_type === 'AIR' || segment.geometry_evidence.data_status !== 'SIMULATED_DATA')) return null
  return segment.geometry.coordinates.every(([lon, lat]) => Number.isFinite(lon) && Number.isFinite(lat) &&
    Math.abs(lon) <= 180 && Math.abs(lat) <= 90) ? segment.geometry.coordinates : null
}

// Conversion uses a same-origin local proxy so the Web service Key stays server-side.
let lastCoordinateConversionAt = 0
const convertedPointCache = new Map<string, Point>()

async function convertGps(AMap: any, points: Point[]): Promise<any[]> {
  const delay = Math.max(0, 1100 - (Date.now() - lastCoordinateConversionAt))
  if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay))
  lastCoordinateConversionAt = Date.now()
  const response = await fetch('/__amap_convert', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ points }),
  })
  if (!response.ok) throw new Error('COORDINATE_CONVERSION_FAILED')
  const result: { available?: boolean; points?: Point[]; reason?: string } = await response.json()
  if (!result.available || !result.points || result.points.length !== points.length) {
    throw new Error(result.reason ?? 'COORDINATE_CONVERSION_FAILED')
  }
  return result.points.map(([longitude, latitude]) => new AMap.LngLat(longitude, latitude))
}

function pointKey(point: Point): string {
  return `${point[0].toFixed(6)},${point[1].toFixed(6)}`
}

function nearbyProviderPoint(point: Point | undefined, converted: any): boolean {
  if (!point || !converted || !Number.isFinite(point[0]) || !Number.isFinite(point[1])) return false
  const latRadians = point[1] * Math.PI / 180
  const dx = (point[0] - converted.getLng()) * 111_320 * Math.cos(latRadians)
  const dy = (point[1] - converted.getLat()) * 110_540
  return Math.hypot(dx, dy) <= 250
}

function nearbyPoints(a: Point, b: Point, maxMeters = 750): boolean {
  if (![...a, ...b].every(Number.isFinite)) return false
  const dx = (a[0] - b[0]) * 111_320 * Math.cos((a[1] + b[1]) / 2 * Math.PI / 180)
  const dy = (a[1] - b[1]) * 110_540
  return Math.hypot(dx, dy) <= maxMeters
}

export function AmapRouteMap({ route, directGround, origin, destination, city, onUnavailable, active }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const amapRef = useRef<any>(null)
  const overlaysRef = useRef<any[]>([])
  const cityFocusRef = useRef<any>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'failed'>('loading')
  const [reason, setReason] = useState('')
  const [districtState, setDistrictState] = useState('正在核验福建省行政边界…')
  const [routeState, setRouteState] = useState('')
  const [hasRouteOverlay, setHasRouteOverlay] = useState(false)
  const [onlineReference, setOnlineReference] = useState<{ distance_m: number; duration_min: number; walking_min: number | null; retrieved_at: string; originArrival: boolean; destinationArrival: boolean } | null>(null)
  const [visibleRouteKey, setVisibleRouteKey] = useState('')
  const routeKey = directGround ? `direct:${directGround.origin.id}:${directGround.destination.id}:${directGround.driving.retrieved_at}` : route ? `${route.route_id}:${route.segments[0]?.origin.coordinate?.longitude}:${route.segments.at(-1)?.destination.coordinate?.longitude}` : ''
  const routePending = state !== 'ready' || !routeKey || visibleRouteKey !== routeKey
  const devMode = new URLSearchParams(window.location.search).get('dev') === '1'

  useEffect(() => {
    let cancelled = false
    let timedOut = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const mapContainer = containerRef.current
    const labelMapAssets = () => {
      mapContainer?.querySelectorAll<HTMLIFrameElement>('iframe:not([title])').forEach((frame) => { frame.title = '高德地图键盘交互区域' })
      mapContainer?.querySelectorAll<HTMLImageElement>('img:not([alt])').forEach((image) => { image.alt = '高德地图标识' })
    }
    const accessibilityObserver = mapContainer ? new MutationObserver(labelMapAssets) : null
    if (mapContainer) accessibilityObserver?.observe(mapContainer, { childList: true, subtree: true })
    timer = setTimeout(() => {
      if (cancelled) return
      timedOut = true
      mapRef.current?.destroy()
      mapRef.current = null
      amapRef.current = null
      setReason('高德地图加载超时，可能是网络或 Key 授权问题。')
      setState('failed')
    }, 20000)
    async function start() {
      try {
        const response = await fetch('/__amap_config', { cache: 'no-store' })
        if (!response.ok) throw new Error('高德本地凭证尚未配置完整。')
        const config: { key?: string } = await response.json()
        if (!config.key) throw new Error('高德 Web 端 Key 不可用。')
        window._AMapSecurityConfig = { serviceHost: `${window.location.origin}/_AMapService` }
        const AMap = await AMapLoader.load({ key: config.key, version: '2.0', plugins: devMode ? ['AMap.DistrictSearch'] : [] })
        if (cancelled || timedOut || !containerRef.current) return
        const map = new AMap.Map(containerRef.current, {
          center: [104.2, 35.8],
          zoom: 4,
          viewMode: '2D',
          pitch: 0,
          pitchEnable: true,
          rotateEnable: true,
          resizeEnable: true,
        })
        mapRef.current = map
        amapRef.current = AMap
        map.on('complete', () => {
          if (cancelled || timedOut) return
          if (timer) clearTimeout(timer)
          setState('ready')
        })
        if (devMode) {
          const district = new AMap.DistrictSearch({ level: 'province', subdistrict: 0, extensions: 'all' })
          district.search('福建省', (status: string, result: any) => {
          if (cancelled || timedOut) return
          const item = result?.districtList?.find((entry: any) => entry.adcode === '350000' || entry.name === '福建省')
          const boundaries = item?.boundaries
          if (status !== 'complete' || !Array.isArray(boundaries) || boundaries.length === 0) {
            setDistrictState('福建省边界查询失败；未绘制边界。')
            return
          }
          const polygons = boundaries.map((path: any) => new AMap.Polygon({
            path,
            strokeColor: '#72439a',
            strokeWeight: 2,
            strokeOpacity: 0.9,
            fillColor: '#aa82c6',
            fillOpacity: 0.08,
          }))
          map.add(polygons)
          setDistrictState(`福建省边界查询成功（${boundaries.length} 段边界）。`)
          })
        }
      } catch {
        if (!cancelled && !timedOut) {
          if (timer) clearTimeout(timer)
          setReason('高德地图未能加载；请检查凭证平台类型、授权域名和网络。')
          setState('failed')
        }
      }
    }
    void start()
    return () => {
      cancelled = true
      accessibilityObserver?.disconnect()
      if (timer) clearTimeout(timer)
      if (mapRef.current) mapRef.current.destroy()
      mapRef.current = null
      amapRef.current = null
    }
  }, [devMode])

  useEffect(() => {
    if (state === 'failed') onUnavailable()
  }, [state, onUnavailable])

  useEffect(() => {
    const map = mapRef.current
    const AMap = amapRef.current
    if (state !== 'ready' || !map || !AMap || !active) return
    let cancelled = false
    map.remove(overlaysRef.current)
    overlaysRef.current = []
    cityFocusRef.current = null
    setRouteState(route || directGround ? '正在定位路线…' : '')
    setHasRouteOverlay(false)
    setOnlineReference(null)
    async function drawRoute() {
      if (directGround) {
        const points = directGround.driving.geometry
        if (points.length < 2 || !points.every(([lon, lat]) => Number.isFinite(lon) && Number.isFinite(lat) && lon >= 70 && lon <= 140 && lat >= 0 && lat <= 60) || !nearbyPoints(points[0], directGround.origin.location) || !nearbyPoints(points.at(-1)!, directGround.destination.location)) {
          setRouteState('在线路线与所选地点不一致，未绘制。请重新查询。')
          return
        }
        const toLngLat = ([lon, lat]: Point) => new AMap.LngLat(lon, lat)
        const overlays = [
          new AMap.Marker({ position: toLngLat(directGround.origin.location), title: `出发地：${directGround.origin.name}`, label: { content: '出发地' } }),
          new AMap.Marker({ position: toLngLat(directGround.destination.location), title: `目的地：${directGround.destination.name}`, label: { content: '目的地' } }),
          new AMap.Polyline({ path: points.map(toLngLat), strokeColor: '#115ca1', strokeWeight: 6, strokeStyle: 'solid', showDir: false }),
        ]
        if (cancelled) return
        map.add(overlays)
        overlaysRef.current = overlays
        cityFocusRef.current = toLngLat(directGround.origin.location)
        const leftInset = containerRef.current && containerRef.current.clientWidth >= 640 ? 350 : 120
        map.setFitView(overlays, true, [90, 80, 90, leftInset])
        setVisibleRouteKey(routeKey)
        setHasRouteOverlay(true)
        setRouteState('已显示所选天津起点到目的地的高德在线驾车路线参考。')
        return
      }
      const overlays: any[] = []
      const staticLines: any[] = []
      let missingGeometry = 0
      let rejectedGeometry = 0
      let failedConversions = 0
      let convertedSegments = 0
      let conversionFailure = ''
      const first = route?.segments[0]?.origin ?? origin
      const last = route?.segments.at(-1)?.destination ?? destination
      const endpointMarkers = [
        { location: first, title: '出发地' },
        { location: last, title: '目的地' },
      ].flatMap((item) => {
        const point = validPoint(item.location)
        return point ? [{ ...item, point }] : []
      })
      const vertiports = new Set<string>()
      const airMarkers: { location: LocationRef; point: Point }[] = []
      const drawableSegments: { segment: Segment; geometry: Point[] }[] = []
      const uniquePoints = new Map<string, Point>()
      const addPoint = (point: Point) => uniquePoints.set(pointKey(point), point)
      endpointMarkers.forEach(({ point }) => addPoint(point))
      for (const segment of route?.segments ?? []) {
        if (segment.segment_type === 'AIR') {
          for (const location of [segment.origin, segment.destination]) {
            const point = validPoint(location)
            if (!point) continue
            const id = pointKey(point)
            if (vertiports.has(id)) continue
            vertiports.add(id)
            airMarkers.push({ location, point })
            addPoint(point)
          }
        }
        const geometry = validGeometry(segment)
        if (!geometry) {
          if (segment.geometry) rejectedGeometry++
          else missingGeometry++
          continue
        }
        drawableSegments.push({ segment, geometry })
        geometry.forEach(addPoint)
      }

      const convertedPoints = new Map<string, any>()
      const points = [...uniquePoints.values()]
      const firstPoints = [...new Map(endpointMarkers.map(({ point }) => [pointKey(point), point])).values()]
      const orderedPoints = [...firstPoints, ...points.filter((point) => !firstPoints.some((firstPoint) => pointKey(firstPoint) === pointKey(point)))]
      for (const point of orderedPoints) {
        const cached = convertedPointCache.get(pointKey(point))
        if (cached) convertedPoints.set(pointKey(point), new AMap.LngLat(cached[0], cached[1]))
      }
      async function convertBatch(batch: Point[]) {
        try {
          const converted = await convertGps(AMap, batch)
          batch.forEach((point, pointIndex) => {
            const position = converted[pointIndex]
            convertedPoints.set(pointKey(point), position)
            convertedPointCache.set(pointKey(point), [position.getLng(), position.getLat()])
          })
        } catch (error) {
          failedConversions++
          conversionFailure ||= error instanceof Error ? error.message : 'COORDINATE_CONVERSION_FAILED'
        }
      }
      const missingEndpoints = firstPoints.filter((point) => !convertedPoints.has(pointKey(point)))
      if (missingEndpoints.length) await convertBatch(missingEndpoints)
      if (cancelled) return
      const endpointPositions = firstPoints.map((point) => convertedPoints.get(pointKey(point))).filter(Boolean)
      if (endpointPositions.length) {
        map.setZoomAndCenter(14, endpointPositions[0])
        setVisibleRouteKey(routeKey)
        setRouteState('已定位到本次出行城市，正在绘制路线…')
      }
      const remaining = orderedPoints.filter((point) => !convertedPoints.has(pointKey(point)))
      for (let index = 0; index < remaining.length; index += 40) {
        await convertBatch(remaining.slice(index, index + 40))
        if (cancelled) return
      }
      for (const { location, title, point } of endpointMarkers) {
        const position = convertedPoints.get(pointKey(point))
        if (position) overlays.push(new AMap.Marker({ position, title: `${title}：${location?.label}`, label: { content: title } }))
      }
      cityFocusRef.current = endpointMarkers.length > 0 ? convertedPoints.get(pointKey(endpointMarkers[0].point)) ?? null : null
      for (const { point } of airMarkers) {
        const position = convertedPoints.get(pointKey(point))
        if (position) overlays.push(new AMap.Marker({ position, title: '模拟起降点：非真实设施', label: { content: '模拟起降点' } }))
      }
      for (const { segment, geometry } of drawableSegments) {
        const path = geometry.map((point) => convertedPoints.get(pointKey(point)))
        if (path.some((position) => !position)) continue
        const line = new AMap.Polyline({
          path,
          strokeColor: segment.geometry_status === 'SIMULATED_AIR_CORRIDOR' ? '#75499c' : '#087f78',
          strokeWeight: 5,
          strokeStyle: segment.geometry_status === 'PUBLIC_ROUTE_SNAPSHOT' ? 'solid' : 'dashed',
          showDir: false,
        })
        overlays.push(line)
        if (segment.geometry_status === 'PUBLIC_ROUTE_SNAPSHOT') staticLines.push(line)
        convertedSegments++
      }
      if (cancelled) return
      map.add(overlays)
      overlaysRef.current = overlays
      setHasRouteOverlay(overlays.length > 0)
      if (overlays.length > 0) {
        map.setFitView(overlays, false, [80, 80, 80, 80])
        map.setPitch(0)
      }
      const messages = [`已转换并显示 ${overlays.length} 个地图要素，其中 ${convertedSegments} 条路线段`]
      if (missingGeometry > 0) messages.push(`${missingGeometry} 段没有可用线路几何，未绘制`)
      if (rejectedGeometry > 0) messages.push(`${rejectedGeometry} 段几何未通过状态或坐标检查，未绘制`)
      if (failedConversions > 0) messages.push(`${failedConversions} 处高德坐标转换失败，未绘制（${conversionFailure}）`)
      if (overlays.length > 0 || messages.length > 1) setRouteState(messages.join('；') + '。')
      if (!endpointPositions.length) setRouteState('地点坐标转换失败；当前地图无法可靠定位，路线文字仍可查看。')
      if (route?.route_type === 'GROUND_ONLY' && staticLines.length > 0 && city && first?.canonical_poi_id && last?.canonical_poi_id) {
        try {
          const response = await fetch('/api/v1/reality/ground', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ city, origin_query: first.label, destination_query: last.label }) })
          const online = await response.json() as { status?: string; origin?: { location: Point }; destination?: { location: Point }; driving?: { geometry: Point[]; distance_m: number; duration_min: number; retrieved_at: string }; walking?: { duration_min: number } | null; origin_detail?: { arrival_point?: Point | null } | null; destination_detail?: { arrival_point?: Point | null } | null }
          if (cancelled) return
          const driving = online.driving
          const endpointsMatch = nearbyProviderPoint(online.origin?.location, convertedPoints.get(pointKey(firstPoints[0]))) && nearbyProviderPoint(online.destination?.location, convertedPoints.get(pointKey(firstPoints.at(-1)!)))
          if (response.ok && online.status === 'OK' && driving && driving.geometry.length >= 2 && endpointsMatch) {
            const line = new AMap.Polyline({ path: driving.geometry.map(([longitude, latitude]) => new AMap.LngLat(longitude, latitude)), strokeColor: '#115ca1', strokeWeight: 6, strokeStyle: 'solid', showDir: false })
            map.remove(staticLines)
            map.add(line)
            overlaysRef.current = [...overlays.filter((item) => !staticLines.includes(item)), line]
            map.setFitView(overlaysRef.current, false, [80, 80, 80, 80])
            setOnlineReference({ distance_m: driving.distance_m, duration_min: driving.duration_min, walking_min: online.walking?.duration_min ?? null, retrieved_at: driving.retrieved_at, originArrival: Boolean(online.origin_detail?.arrival_point), destinationArrival: Boolean(online.destination_detail?.arrival_point) })
            setRouteState('已显示高德在线驾车路径；规划安全结论仍以原审查为准。')
          } else {
            setRouteState(response.ok && online.status === 'OK' ? '高德在线地点与当前方案不一致；保留静态道路模型，请核实具体地点。' : '高德在线路线暂不可用；当前显示静态道路模型。')
          }
        } catch {
          if (!cancelled) setRouteState('高德在线路线暂不可用；当前显示静态道路模型。')
        }
      }
    }
    void drawRoute()
    return () => { cancelled = true }
  }, [state, route, directGround, origin, destination, city, active, routeKey])

  if (state === 'failed') return <div className="amap-fallback"><div className="amap-fallback__notice" role="status">{reason} {directGround ? '路线文字说明仍可查看。' : '已显示原有 Cesium 地理概览；这不表示高德接入验证通过。'}</div></div>

  return <section className={`route-map${directGround ? ' direct-route' : ''}`} aria-label="高德路线地图">
    <div ref={containerRef} className="route-map__globe" role="group" aria-label="高德地图；路线详情、图例和数据说明见地图文字" />
    {routePending && <div className="route-map__loading-cover" role="status" aria-live="polite">{route || directGround ? '正在定位本次路线…' : '请先输入出发地与目的地'}<small>{route || directGround ? '新路线就绪前，地图暂不显示，避免误看上一座城市。' : '完成规划后，这里会显示对应的城市地图。'}</small></div>}
    <div className="route-map__header" aria-live="polite">
      <span className="route-map__eyebrow">高德地图 · 城市平面视图</span>
      <h2>{directGround ? '在线地面路线参考' : route?.route_type === 'GROUND_AIR_GROUND' ? '模拟低空情景' : route ? '纯地面方案' : '路线位置概览'}</h2>
      <p className="route-map__scene-state">{state === 'ready' ? '高德地图已加载。' : '正在加载高德地图…'}</p>
      {route?.route_type === 'GROUND_AIR_GROUND' && <p className="route-map__simulation">仅供情景演示，不代表真实航线或可乘坐服务。</p>}
      {hasRouteOverlay && <div className="route-map__actions"><button type="button" onClick={() => { mapRef.current?.setFitView(overlaysRef.current, false, [80, 80, 80, 80]); mapRef.current?.setPitch(0) }}>查看完整路线</button><button type="button" disabled={!cityFocusRef.current} onClick={() => { mapRef.current?.setZoomAndCenter(17, cityFocusRef.current); mapRef.current?.setPitch(0) }}>查看起点街区</button></div>}
      {route?.route_type === 'GROUND_AIR_GROUND' && <p className="route-map__projection">此视角仅显示模拟低空线路的地图投影；立体高度请切换到旅程示意。</p>}
    </div>
    <div className="route-map__details" aria-label="地图图例与数据说明">
      {routeState && <p role="status">{routeState}</p>}
      {directGround && <><div className="route-map__legend"><span><i className="route-map__line route-map__line--ground route-map__line--solid" />高德在线驾车参考</span></div><p className="route-map__safety-note">所选地点为公开 POI 位置；实际入口、上下车点及无障碍通行未核验。此路线未经 SilverSky 安全审查。</p></>}
      {onlineReference && <p role="status"><strong>高德在线驾车参考</strong>：约 {Math.round(onlineReference.distance_m)} 米、约 {Math.round(onlineReference.duration_min)} 分钟；获取于 {new Date(onlineReference.retrieved_at).toLocaleString('zh-CN')}。{onlineReference.walking_min == null ? '步行路线暂无可靠数据。' : `步行路径约 ${Math.round(onlineReference.walking_min)} 分钟，仅作距离参考，不代表适合老人或轮椅。`} {onlineReference.originArrival || onlineReference.destinationArrival ? '高德提供地点到达点，但未核验实际入口、接送位置或轮椅通行。' : '地点到达点暂无可靠数据。'} 等候、上下车和完整行程时间未知。</p>}
      {route && !route.segments.some((segment) => validGeometry(segment)) && <p role="status"><strong>暂无可绘制线路。</strong>当前方案缺少经过来源标记的线路几何。</p>}
      {route?.segments.some((segment) => validGeometry(segment)) && <div className="route-map__legend">
        {route.segments.some((segment) => validGeometry(segment) && segment.geometry_status === 'PUBLIC_ROUTE_SNAPSHOT') && <span><i className="route-map__line route-map__line--ground route-map__line--solid" />{onlineReference ? '高德在线驾车参考' : '静态道路模型'}</span>}
        {route.segments.some((segment) => validGeometry(segment) && segment.geometry_status === 'STRAIGHT_REFERENCE_LINE') && <span><i className="route-map__line route-map__line--ground" />地面示意</span>}
        {route.segments.some((segment) => validGeometry(segment) && segment.geometry_status === 'SIMULATED_AIR_CORRIDOR') && <span><i className="route-map__line route-map__line--air" />模拟低空</span>}
      </div>}
      {route?.segments.some((segment) => validGeometry(segment) && segment.geometry_status === 'PUBLIC_ROUTE_SNAPSHOT') && <p className="route-map__safety-note">{onlineReference ? '地图显示高德在线驾车参考；方案卡仍是静态道路模型估算。' : '当前为静态道路模型。'} 两者均不保证无障碍通行或完整行程时间。</p>}
      <details className="route-map__disclosure"><summary>数据说明</summary><p>高德提供城市地图背景。{directGround ? '蓝线为本次选定地点的在线驾车路径，不包含完整行程与安全审查。' : onlineReference ? '地图蓝线为高德在线驾车参考；方案卡的安全审查和静态道路模型估算未因此改变。' : '当前线路来自 SilverSky 的静态道路模型或模拟情景。'} 公开 POI 为中心点，具体入口和接送点未核验。</p><p>OSRM 静态道路模型快照不是实时导航，不能保证无障碍通行。模拟起降点、接驳及低空线不代表真实设施或航线。</p></details>
      {devMode && <details className="route-map__disclosure"><summary>地图能力核验</summary><p role="status">{districtState}</p></details>}
      <p className="route-map__attribution">城市地图 © 高德地图；地图原生署名与审图号保留在底部。</p>
    </div>
  </section>
}
