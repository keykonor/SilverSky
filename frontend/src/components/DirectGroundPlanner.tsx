import { useEffect, useRef, useState, type FormEvent } from 'react';
import { routeRealityByIds, searchRealityPlaces } from '../api/client';
import type { DirectGroundReference, RealityPlace } from '../types/contracts';

type Role = 'origin' | 'destination';
type SearchState = { query: string; selected: RealityPlace | null; candidates: RealityPlace[]; message: string };
const empty = (): SearchState => ({ query: '', selected: null, candidates: [], message: '' });

type Props = { disabled?: boolean } & (
  { onRoute: (route: DirectGroundReference | null) => void; onPlacesSelected?: never; originCity?: never }
  | { onRoute?: never; onPlacesSelected: (origin: RealityPlace, destination: RealityPlace) => Promise<void>; originCity: Parameters<typeof searchRealityPlaces>[1] }
);

export function DirectGroundPlanner({ onRoute, onPlacesSelected, originCity = 'TIANJIN', disabled = false }: Props) {
  const manualTrip = Boolean(onPlacesSelected);
  const [places, setPlaces] = useState<Record<Role, SearchState>>({ origin: empty(), destination: empty() });
  const [busy, setBusy] = useState(false);
  const [routeBusy, setRouteBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [route, setRoute] = useState<DirectGroundReference | null>(null);
  const sequence = useRef(0);

  useEffect(() => {
    if (disabled) {
      sequence.current += 1;
      setBusy(false);
      setRouteBusy(false);
      setRoute(null);
      setMessage('');
    }
    return () => { sequence.current += 1; };
  }, [disabled]);

  function change(role: Role, query: string) {
    sequence.current += 1;
    setBusy(false);
    setRouteBusy(false);
    setPlaces((current) => ({ ...current, [role]: { query, selected: null, candidates: [], message: '' } }));
    setRoute(null);
    onRoute?.(null);
    setMessage('');
  }

  async function search(role: Role, event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = places[role].query.trim();
    if (!query || disabled) return;
    const thisSearch = ++sequence.current;
    setBusy(true);
    setPlaces((current) => ({ ...current, [role]: { ...current[role], selected: null, candidates: [], message: '正在查找地点…' } }));
    setRoute(null);
    onRoute?.(null);
    try {
      const response = await searchRealityPlaces(query, role === 'origin' ? originCity : 'ALL');
      if (thisSearch !== sequence.current) return;
      setPlaces((current) => ({ ...current, [role]: { ...current[role], candidates: response.status === 'OK' ? response.candidates : [], message: response.status !== 'OK' ? '在线地点暂不可用。请稍后重试。' : response.candidates.length ? '请选择一个具体地点。' : '未找到可靠地点。请补充区县、街道或更具体的名称。' } }));
    } catch {
      if (thisSearch === sequence.current) setPlaces((current) => ({ ...current, [role]: { ...current[role], message: '在线地点暂不可用。请稍后重试。' } }));
    } finally {
      if (thisSearch === sequence.current) setBusy(false);
    }
  }

  function choose(role: Role, place: RealityPlace) {
    sequence.current += 1;
    setBusy(false);
    setRouteBusy(false);
    setPlaces((current) => ({ ...current, [role]: { ...current[role], selected: place, candidates: [], message: `已选择：${place.name}，${place.city}${place.address ? `，${place.address}` : ''}` } }));
    setRoute(null);
    onRoute?.(null);
    setMessage('');
  }

  async function createRoute() {
    const origin = places.origin.selected;
    const destination = places.destination.selected;
    if (!origin || !destination || disabled || busy || routeBusy) return;
    const thisSearch = ++sequence.current;
    setRouteBusy(true);
    setMessage('正在查找在线地面路线…');
    setRoute(null);
    onRoute?.(null);
    try {
      if (onPlacesSelected) {
        setMessage('');
        await onPlacesSelected(origin, destination);
        return;
      }
      const response = await routeRealityByIds(origin.id, destination.id);
      if (thisSearch !== sequence.current) return;
      if (response.status !== 'OK') {
        setMessage(`暂无可靠数据：${response.message}`);
        return;
      }
      if (response.origin.id !== origin.id || response.destination.id !== destination.id || response.driving.geometry.length < 2) {
        setMessage('在线路线与已选地点不一致，不能显示。请重新选择地点。');
        return;
      }
      setRoute(response);
      onRoute?.(response);
      setMessage('已找到地面路线参考。请核实实际入口、接送点和无障碍条件。');
    } catch {
      if (thisSearch === sequence.current) setMessage('在线路线暂不可用。请稍后重试或重新选择地点。');
    } finally {
      if (thisSearch === sequence.current) setRouteBusy(false);
    }
  }

  return <section className="direct-planner" aria-labelledby="direct-planner-title">
    <p className="eyebrow">{manualTrip ? '手动选点' : '天津任意可识别地点出发'}</p>
    <h2 id="direct-planner-title">查找地面路线</h2>
    <p>{manualTrip ? '分别查找并确认出发地和目的地。地图会显示高德在线驾车路线参考，该路线未经 SilverSky 安全审查。' : '选择天津的具体出发地，再选择目的地。地图会显示高德在线驾车路线参考；该路线未经 SilverSky 安全审查。'}</p>
    <p className="direct-planner__privacy">查找时，地点词与所选地点会发送给高德地图服务。请勿输入姓名、电话等个人信息。</p>
    {disabled && <p role="alert">当前可能涉及医疗急症，请先联系 120 或当地紧急医疗服务，普通路线查找已暂停。</p>}
    {(['origin', 'destination'] as const).map((role) => <form key={role} className="direct-planner__search" onSubmit={(event) => void search(role, event)}>
      <label htmlFor={`direct-${role}`}>{role === 'origin' ? (manualTrip ? '出发地' : '天津出发地') : (manualTrip ? '目的地' : '目的地（不限天津）')}</label>
      <div><input id={`direct-${role}`} value={places[role].query} onChange={(event) => change(role, event.target.value)} placeholder={role === 'origin' ? (manualTrip ? '输入出发地点或地址' : '输入天津的地点或地址') : '输入目的地或地址'} autoComplete="off" disabled={disabled || (manualTrip && routeBusy)} /><button type="submit" disabled={disabled || !places[role].query.trim() || busy || routeBusy}>查找</button></div>
      {places[role].message && <p role="status">{places[role].message}</p>}
      {places[role].candidates.length > 0 && <div className="direct-planner__choices" aria-label={`选择${role === 'origin' ? '出发地' : '目的地'}`}>
        {places[role].candidates.map((place) => <button key={place.id} type="button" disabled={disabled} onClick={() => choose(role, place)}><strong>{place.name}</strong><span>{place.city}{place.address ? ` · ${place.address}` : ''}</span></button>)}
        <small>没有您要找的地点？请在输入框中加上区县、街道或门牌，再查找。</small>
      </div>}
    </form>)}
    <button className="direct-planner__submit" type="button" disabled={disabled || !places.origin.selected || !places.destination.selected || busy || routeBusy} onClick={() => void createRoute()}>{routeBusy ? '正在查找路线…' : '查看地面路线'}</button>
    {message && <p className="direct-planner__message" role="status">{message}</p>}
    {route && <div className="direct-planner__result" aria-label="在线地面路线参考"><strong>{route.origin.name} → {route.destination.name}</strong><p>高德在线驾车参考：约 {Math.round(route.driving.distance_m / 100) / 10} 公里，约 {Math.round(route.driving.duration_min)} 分钟。{route.walking ? `步行路径约 ${Math.round(route.walking.distance_m)} 米；不代表适合老人或轮椅。` : '步行路线暂无可靠数据。'}</p><p>路线获取于 {new Date(route.driving.retrieved_at).toLocaleString('zh-CN')}。这是道路行驶参考，不是实际全程时间，也未经 SilverSky 安全审查。</p><a className="direct-planner__map-link" href="#route-map-panel">向下查看路线地图</a>{Boolean(route.driving.steps?.length) && <details className="direct-planner__steps"><summary>查看道路步骤文字</summary><p>以下为高德驾车道路步骤参考，不是实时导航或无障碍指引。</p><ol>{route.driving.steps?.map((step, index) => <li key={index}>{step.instruction}</li>)}</ol></details>}<p><strong>下一步：</strong>向出发地和目的地核实入口、实际接送位置及无障碍通行。地点标记是 POI 位置，不能代替入口。</p></div>}
  </section>;
}
