import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { RealityPlace } from '../types/contracts';
import { ApiError, api, type Analysis, type TripRoute } from './api';
import { DirectGroundPlanner } from '../components/DirectGroundPlanner';
import { MvpMap } from './MvpMap';
import { useSpeech } from './useSpeech';
import { DeparturePlan } from './DeparturePlan';
import { PRODUCT_VERSION_LABEL } from '../version';
import './v2.css';

type Role = 'origin' | 'destination';
type SearchCity = 'TIANJIN' | 'SHENZHEN' | 'ALL';
const example = '我想从天津大学卫津路校区去天津医科大学总医院。';

export default function MvpApp() {
  const [text, setText] = useState('');
  const [city, setCity] = useState<SearchCity>('TIANJIN');
  const [manualOpen, setManualOpen] = useState(false);
  const [manualBlocked, setManualBlocked] = useState(false);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [chosen, setChosen] = useState<Record<Role, RealityPlace | null>>({ origin: null, destination: null });
  const [route, setRoute] = useState<TripRoute | null>(null);
  const [mode, setMode] = useState<'ground' | 'air'>('ground');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [connected, setConnected] = useState('正在连接服务…');
  const generation = useRef(0);
  const input = useRef<HTMLTextAreaElement>(null);
  const speech = useSpeech((spoken) => { changeText(text ? `${text}\n${spoken}` : spoken); input.current?.focus(); });

  useEffect(() => {
    let stale = false;
    api<{ deepseek_configured: boolean; amap_configured: boolean }>('status').then((status) => {
      if (!stale) setConnected(status.deepseek_configured && status.amap_configured ? '服务已连接' : '服务已连接，部分配置待补齐');
    }).catch(() => { if (!stale) setConnected('服务未连接，请启动后端'); });
    return () => { stale = true; generation.current += 1; };
  }, []);

  function clearResult() {
    generation.current += 1;
    setBusy(false); setAnalysis(null); setRoute(null);
    setChosen({ origin: null, destination: null }); setError(''); setMessage(''); setMode('ground');
    setManualOpen(false);
  }
  function changeText(value: string) {
    clearResult();
    setText(value);
    if (!value.trim()) setManualBlocked(false);
  }

  async function makeRoute(origin: RealityPlace, destination: RealityPlace, token: number) {
    setMessage('正在获取高德真实驾车路线…');
    const result = await api<TripRoute>('route', { origin_id: origin.id, destination_id: destination.id });
    if (token !== generation.current) return;
    if (result.origin.id !== origin.id || result.destination.id !== destination.id || result.ground.geometry.length < 2) throw new Error('路线与已选地点不一致，请重新确认地点。');
    setRoute(result); setMode('ground'); setMessage('');
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!text.trim() || busy || speech.state !== 'idle') return;
    clearResult();
    const token = ++generation.current;
    setBusy(true); setMessage('正在理解您的出行需求…');
    let interpreting = true;
    try {
      const result = await api<Analysis>('interpret', { text: text.trim(), city });
      interpreting = false;
      if (token !== generation.current) return;
      setManualBlocked(false);
      setAnalysis(result); setChosen(result.resolved);
      if (result.missing_fields.length) { setMessage('请在原文中补充出发地和目的地，再点击完成。'); return; }
      if (result.resolved.origin && result.resolved.destination) await makeRoute(result.resolved.origin, result.resolved.destination, token);
      else setMessage('请点击具体地点；两端选齐后自动规划。');
    } catch (e) {
      if (token === generation.current) {
        if (interpreting && e instanceof ApiError && e.status === 422) setManualBlocked(true);
        setError(e instanceof Error ? e.message : '暂时无法完成，请稍后重试。');
        setMessage('');
      }
    }
    finally { if (token === generation.current) setBusy(false); }
  }

  async function choose(role: Role, place: RealityPlace) {
    if (busy) return;
    const selected = { ...chosen, [role]: place };
    setChosen(selected);
    if (!selected.origin || !selected.destination) return;
    const token = ++generation.current;
    setBusy(true); setError(''); setRoute(null);
    try { await makeRoute(selected.origin, selected.destination, token); }
    catch (e) { if (token === generation.current) { setError(e instanceof Error ? e.message : '获取路线失败，请重试。'); setMessage(''); } }
    finally { if (token === generation.current) setBusy(false); }
  }

  async function planManual(origin: RealityPlace, destination: RealityPlace) {
    const token = ++generation.current;
    setError('');
    try { await makeRoute(origin, destination, token); }
    catch (e) {
      if (token === generation.current) {
        setError(e instanceof Error ? e.message : '获取路线失败，请重试。');
        setMessage('');
      }
    }
  }

  function returnToText() {
    clearResult();
    setTimeout(() => input.current?.focus(), 0);
  }

  return <main className={`v2-app ${route ? 'v2-has-route' : ''}`}>
    <header className="v2-header"><a className="v2-brand" href="/">S<span>SilverSky <small>{PRODUCT_VERSION_LABEL}</small></span></a><span className="v2-service">{connected}</span><a className="v2-legacy" href="/aircraft" target="_blank" rel="noopener noreferrer">航空器产品</a><a className="v2-legacy" href="/?legacy=1">旧版入口</a></header>
    {!route ? <section className="v2-input-panel" aria-labelledby="v2-title">
      <div className="v2-input-copy"><p>从一句话，开始这段旅程</p><h1 id="v2-title">您想去哪里？</h1><span>告诉我们出发地和目的地，也可以加上您的出行需求。</span></div>
      {manualOpen ? <div className="v2-manual-input">
        <button type="button" onClick={returnToText}>返回文字输入</button>
        <DirectGroundPlanner originCity={city} onPlacesSelected={planManual} />
      </div> : <form onSubmit={(event) => void submit(event)} className="v2-form">
        <label className="v2-sr-only" htmlFor="v2-trip">出行需求</label>
        <textarea ref={input} id="v2-trip" maxLength={2000} value={text} onChange={(event) => changeText(event.target.value)} placeholder={example} disabled={busy || speech.state !== 'idle'} />
        <div className="v2-input-actions"><label>地点搜索范围 <select value={city} disabled={busy} onChange={(event) => { clearResult(); setCity(event.target.value as SearchCity); }}><option value="TIANJIN">天津</option><option value="SHENZHEN">深圳</option><option value="ALL">全国</option></select></label>
          <button type="button" className={`v2-mic ${speech.state === 'listening' ? 'v2-recording' : ''}`} disabled={!speech.supported || busy || speech.state === 'finishing'}
            onPointerDown={(event) => { if (event.button !== 0) return; event.currentTarget.setPointerCapture(event.pointerId); speech.start(); }}
            onPointerUp={speech.finish} onPointerCancel={speech.finish} onLostPointerCapture={speech.finish}
            onKeyDown={(event) => { if ((event.key === ' ' || event.key === 'Enter') && !event.repeat) { event.preventDefault(); speech.start(); } }}
            onKeyUp={(event) => { if (event.key === ' ' || event.key === 'Enter') { event.preventDefault(); speech.finish(); } }} onBlur={speech.finish}
            onContextMenu={(event) => event.preventDefault()}>{speech.state === 'listening' ? '松开结束' : speech.state === 'finishing' ? '正在转写…' : '按住说话'}</button>
          <button type="submit" className="v2-primary" disabled={!text.trim() || busy || speech.state !== 'idle'}>{busy ? '正在处理…' : '完成'}</button>
          <button type="button" disabled={manualBlocked || busy || speech.state !== 'idle'} onClick={() => { clearResult(); setManualOpen(true); }}>手动选点</button></div>
        {manualBlocked && <p className="v2-privacy">当前需求的普通规划已暂停。清空原文可开始新的行程。</p>}
        <div className="v2-input-foot"><button type="button" disabled={busy || speech.state !== 'idle'} onClick={() => { changeText(example); input.current?.focus(); }}>试试：天大卫津路校区 → 总医院</button><span>{text.length}/2000</span></div>
        <p className="v2-privacy">点击完成后，文字发送至 DeepSeek 分析，地点发送至高德核实。请勿输入姓名、电话等隐私信息。</p>
        <p className="v2-speech-help" role="status">{speech.message || (!speech.supported ? '此浏览器不支持网页语音识别。' : '语音由浏览器服务处理，需麦克风权限和网络。')} 备用：点击文字框，按 Win+H 使用 Windows 语音输入。</p>
      </form>}
    </section> : <section className="v2-summary"><div><span>您的行程</span><strong>{route.origin.name} <b>→</b> {route.destination.name}</strong></div><button onClick={() => {
      if (manualOpen) { clearResult(); setManualOpen(true); }
      else returnToText();
    }}>修改行程</button></section>}
    {(error || message) && <div className={`v2-notice ${error ? 'v2-error' : ''}`} role={error ? 'alert' : 'status'}>{error || message}</div>}
    <div className="v2-workspace">
      {(analysis || route) && <aside className="v2-sidebar" aria-label={route ? '路线方案' : '确认地点'}>
        {!route && analysis ? <><h2>确认具体地点</h2><p>请点击正确地点，两端选齐后自动规划。</p>
          {(['origin', 'destination'] as const).map((role) => <section className="v2-place-group" key={role} aria-label={role === 'origin' ? '选择出发地' : '选择目的地'}>
            <h3>{role === 'origin' ? '从哪里出发' : '去哪里'} <small>{analysis.intent[role] || '待补充'}</small></h3>
            {chosen[role] && <p className="v2-chosen">已选：{chosen[role]?.name}</p>}
            {!analysis[`${role}_candidates`].length && <p>未找到具体地点，请在原文中补充城市、校区、街道或门牌。</p>}
            {analysis[`${role}_candidates`].map((place) => <button key={place.id} disabled={busy} aria-pressed={chosen[role]?.id === place.id} onClick={() => void choose(role, place)}><strong>{place.name}</strong><span>{place.city} · {place.address || '地址未提供'}</span></button>)}
          </section>)}
          {error && chosen.origin && chosen.destination && <button className="v2-primary v2-confirm" disabled={busy} onClick={() => void choose('destination', chosen.destination!)}>重试路线</button>}</> : route && <>
          <h2>路线方案</h2><p className="v2-route-subtitle">先看地面行程，也可浏览空中参考。</p>
          <button className="v2-option" aria-pressed={mode === 'ground'} onClick={() => setMode('ground')}><span className="v2-option-title"><i className="v2-line-ground" />地面驾车路线</span><strong>{(route.ground.distance_m / 1000).toFixed(1)} <small>公里</small> <b>·</b> {Math.max(1, Math.ceil(route.ground.duration_min))} <small>分钟</small></strong><span>高德在线道路参考 · 预计行驶时间</span></button>
          <button className="v2-option v2-air-option" aria-pressed={mode === 'air'} onClick={() => setMode('air')}><span className="v2-option-title"><i className="v2-line-air" />模拟空中路线</span><strong>空间参考 <small>· 非运营航线</small></strong><span>不代表空域许可或飞行可行性</span></button>
          <div className="v2-route-note">{mode === 'air' ? route.air.notice : '道路路线未经 SilverSky 安全审查。预计时间不含上下车和等候，入口、接送点及无障碍条件仍需核实。'}</div>
          <DeparturePlan plan={analysis?.departure_plan} durationMin={route.ground.duration_min} />
          {mode === 'ground' && <details><summary>查看道路步骤</summary><ol>{route.ground.steps.map((step, i) => <li key={i}>{step.instruction}</li>)}</ol></details>}
          <p className="v2-source">来源：{route.ground.source}<br />获取于 {new Date(route.ground.retrieved_at).toLocaleString('zh-CN')}</p>
        </>}
        {analysis && <details className="v2-intent"><summary>已识别的出行需求</summary><dl>{([['departure_time', '出发时间'], ['age', '年龄'], ['mobility', '行动能力'], ['preferences', '偏好']] as const).map(([field, label]) => <div key={field}><dt>{label}</dt><dd>{analysis.intent[field] ?? '未提供'}</dd></div>)}</dl><small>这些信息尚未用于无障碍或安全推荐；时间按原文记录，道路时间为当前查询估算。</small></details>}
      </aside>}
      <MvpMap route={route} mode={mode} />
    </div>
    <footer className="v2-footer">SilverSky · 地面道路参考，空中路线为模拟 · 安全、舒适优先</footer>
  </main>;
}
