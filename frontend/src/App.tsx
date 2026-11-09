import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { ApiError, health, interpret, plan, searchRealityPlaces } from './api/client';
import RouteMap from './components/RouteMap';
import { DirectGroundPlanner } from './components/DirectGroundPlanner';
import { dataStatusText, demoText, focusText, formatDeparture, geometryStatusText, isEligibleRecommendation, isEmergency, isSimulated, mobilityText, readableBackendText, reviewText } from './presentation';
import type { DirectGroundReference, InterpretationResult, LocationRef, PlanningResult, PlanningState, RouteOption, Segment } from './types/contracts';

type Message = { id: number; role: 'user' | 'assistant'; text: string };
type Phase = 'idle' | 'interpreting' | 'planning';

const welcome = '告诉我您想几点从哪里去哪里，以及老人的行动情况。我会优先考虑安全与舒适。';
const emergencyWarning = '当前描述可能涉及医疗急症，请优先联系 120 或当地紧急医疗服务。';

function readableError(error: unknown): string {
  return error instanceof Error ? error.message : '服务暂时无法完成请求，请稍后重试。';
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="metric"><span>{label}</span><strong>{value}</strong></div>;
}

function locationSummary(raw: LocationRef | undefined, canonical: LocationRef | undefined) {
  if (!raw) return <span>待补充</span>;
  const matched = canonical?.canonical_poi_id && canonical.entity_precision === 'POI';
  return <>
    <span>用户描述：{raw.label}</span>
    {matched && <><span aria-hidden="true">→</span><span>解析地点：{canonical.label}</span></>}
  </>;
}

function segmentTitle(segment: Segment, index: number): string {
  if (segment.segment_type === 'AIR') return '未来低空模拟航段';
  if (segment.geometry_status === 'STRAIGHT_REFERENCE_LINE') return index === 0 ? '地面前往模拟起降点' : '地面前往目的地';
  return segment.segment_type === 'WALK' ? '步行段' : segment.segment_type === 'WAIT' ? '等待段' : segment.segment_type === 'SHUTTLE' ? '接驳段' : '地面车行段';
}

function timelineLocationLabel(location: LocationRef, simulated: boolean): string {
  if (!simulated) return location.label;
  const match = location.label.match(/模拟起降点\s*([AB])\s*$/i);
  return match ? `模拟起降点 ${match[1].toUpperCase()}` : location.label;
}

function geometryDescription(segment: Segment): string {
  if (!segment.geometry || !segment.geometry_status || !segment.geometry_evidence || segment.geometry.coordinates.length < 2) return '路线形状暂无可靠数据；暂无可靠数据';
  return `${geometryStatusText[segment.geometry_status]}；${dataStatusText[segment.geometry_evidence.data_status]}`;
}

function RouteCard({ route, index, selected, onSelect }: { route: RouteOption; index: number; selected: boolean; onSelect: () => void }) {
  const simulated = isSimulated(route);
  const name = route.route_type === 'GROUND_ONLY' ? '纯地面方案' : '模拟低空对比方案';
  return (
    <article className={`route-card ${selected ? 'selected' : ''} ${route.risk_assessment.review_outcome === 'REJECT' ? 'rejected' : ''}`} aria-label={`方案 ${String.fromCharCode(65 + index)}，${name}`}>
      <button className="route-select" type="button" onClick={onSelect} aria-pressed={selected} aria-label={`查看方案 ${String.fromCharCode(65 + index)}：${name}`}>
        <span className="route-letter">{String.fromCharCode(65 + index)}</span>
        <span className="route-title"><strong>{name}</strong><small>{reviewText[route.risk_assessment.review_outcome]}{simulated ? ' · 模拟情景' : ''}</small></span>
        <span className="route-indicator">{selected ? '当前查看' : '查看'}</span>
      </button>
    </article>
  );
}

function RouteDetail({ route }: { route: RouteOption }) {
  const simulated = isSimulated(route);
  const recommended = isEligibleRecommendation(route);
  return (
    <section className="route-detail" aria-label="当前方案详情">
      <div className="route-body">
        {recommended && <p className="tag good">满足安全推荐条件</p>}
        {simulated && <p className="simulation-banner">模拟低空情景 · 未来场景演示，当前不可据此购票或乘坐</p>}
        <div className={`safety-line ${route.risk_assessment.review_outcome.toLowerCase()}`}>
          <strong>安全审查：{reviewText[route.risk_assessment.review_outcome]}</strong>
          <span>数据来源：{dataStatusText[route.data_status]}</span>
        </div>
        <div className="metric-grid">
          <Metric label={route.route_type === 'GROUND_ONLY' ? '道路模型车行时间' : '全程时间'} value={route.total_time_min == null ? '待确认' : `约 ${Math.round(route.total_time_min)} 分钟`} />
          <Metric label="步行距离" value={route.walking_distance_m == null ? '待确认' : `${Math.round(route.walking_distance_m)} 米`} />
          <Metric label="换乘次数" value={route.transfer_count == null ? '待确认' : `${route.transfer_count} 次`} />
          <Metric label="预计费用" value={route.estimated_cost_cny == null ? '暂无可靠数据' : `约 ¥${route.estimated_cost_cny.toFixed(0)}`} />
          <Metric label="舒适度" value={route.comfort_score == null ? '待确认' : `${Math.round(route.comfort_score)} / 100`} />
          <Metric label="风险等级" value={{ LOW: '低', MEDIUM: '中', HIGH: '高', UNKNOWN: '未知' }[route.risk_level]} />
        </div>
        {route.route_type === 'GROUND_ONLY' && <p className="duration-note">车行时间来自静态道路模型估算，不是预计到达时间；等候、步行及上下车时间未知，完整行程时间暂无法可靠估计。</p>}
        <p className="duration-note">具体入口、推荐上下车位置和无障碍通行情况均待人工确认。地图上的 POI 点不代表这些位置。</p>
        <ul className="reason-list" aria-label="安全审查原因">
          {route.risk_assessment.reasons.map((reason, i) => <li key={i}>{readableBackendText(reason)}</li>)}
        </ul>
        <section className="journey-timeline" aria-label="行程阶段">
          <strong>行程阶段</strong>
          <ol>{route.segments.map((segment, i) => <li key={i}><span>{segmentTitle(segment, i)}</span><small>{timelineLocationLabel(segment.origin, simulated)} → {timelineLocationLabel(segment.destination, simulated)}</small></li>)}</ol>
        </section>
        <details className="data-truth">
          <summary>数据说明</summary>
          <p>若使用公开 POI 坐标，它表示中心点，具体入口需核验；静态道路模型不保证实时路况、门到门路线或无障碍通行。模拟起降点并非真实设施。</p>
          <ul>{route.segments.map((segment, i) => <li key={i}>{segmentTitle(segment, i)}：{geometryDescription(segment)}。{segment.geometry_status === 'SIMULATED_AIR_CORRIDOR' ? '高度只用于模拟展示，不代表获批航线或可飞条件。' : ''}</li>)}</ul>
        </details>
        <details className="explanation">
          <summary>为什么这样规划？</summary>
          <p>{readableBackendText(route.explanation)}</p>
          <p>{route.walking_distance_m == null ? '步行距离暂无可靠数据。' : `步行距离约 ${Math.round(route.walking_distance_m)} 米。`}{route.transfer_count == null ? '换乘次数尚未核实。' : `换乘 ${route.transfer_count} 次。`}{route.total_time_min == null ? '完整行程时间暂无可靠数据。' : route.route_type === 'GROUND_ONLY' ? `静态道路模型估算车行约 ${Math.round(route.total_time_min)} 分钟，非预计到达时间。` : `模拟空中阶段约 ${Math.round(route.total_time_min)} 分钟，并非完整行程时间。`}</p>
          <p>安全结果：{reviewText[route.risk_assessment.review_outcome]}。数据确定性：{dataStatusText[route.data_status]}。{recommended ? '此方案满足当前安全推荐条件。' : '因安全审查或数据条件限制，此方案仅供规划参考。'}</p>
          <ul className="segment-evidence">
            {route.segments.map((segment, i) => <li key={i}>{i + 1}. {segmentTitle(segment, i)}：{dataStatusText[segment.evidence.data_status]}{segment.evidence.unavailable_reason ? `；${readableBackendText(segment.evidence.unavailable_reason)}` : ''}</li>)}
          </ul>
        </details>
      </div>
    </section>
  );
}

export default function App() {
  const [draft, setDraft] = useState('');
  const [messages, setMessages] = useState<Message[]>([{ id: 0, role: 'assistant', text: welcome }]);
  const [planningState, setPlanningState] = useState<PlanningState | null>(null);
  const [interpretation, setInterpretation] = useState<InterpretationResult | null>(null);
  const [displayAssumptions, setDisplayAssumptions] = useState<string[]>([]);
  const [result, setResult] = useState<PlanningResult | null>(null);
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [directGround, setDirectGround] = useState<DirectGroundReference | null>(null);
  const [directPlannerKey, setDirectPlannerKey] = useState(0);
  const [placeChoices, setPlaceChoices] = useState<Array<{ id: string; name: string; address: string }>>([]);
  const [placeChoiceRole, setPlaceChoiceRole] = useState<'origin' | 'destination'>('origin');
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState<string | null>(null);
  const [serviceOnline, setServiceOnline] = useState<boolean | null>(null);
  const generation = useRef(0);
  const messageId = useRef(1);
  const stateRef = useRef<PlanningState | null>(null);
  const busyRef = useRef(false);

  useEffect(() => {
    health().then(() => setServiceOnline(true)).catch(() => setServiceOnline(false));
  }, []);

  const selectedRoute = result?.route_options.find((route) => route.route_id === selectedRouteId) ?? null;
  const stateForDisplay = planningState ?? interpretation?.structured_intent ?? null;
  const rawOrigin = result?.user_request.origin ?? stateForDisplay?.origin;
  const rawDestination = result?.user_request.destination ?? stateForDisplay?.destination;
  const canonicalRoute = result?.route_options.find((route) => route.segments.length > 0);
  const canonicalOrigin = canonicalRoute?.segments[0]?.origin;
  const canonicalDestination = canonicalRoute?.segments[canonicalRoute.segments.length - 1]?.destination;
  const unverifiedPoiCenter = [canonicalOrigin, canonicalDestination].some((location) => location?.canonical_poi_id && location.entity_precision === 'POI' && location.entrance_verified !== true);
  const emergency = interpretation ? isEmergency(interpretation) : false;
  const uncertaintyCount = interpretation?.uncertain_fields?.length ?? 0;
  const missingCount = interpretation?.missing_fields.length ?? 0;
  const pendingCount = interpretation ? new Set([...interpretation.missing_fields, ...(interpretation.uncertain_fields ?? [])]).size : 0;
  const safeRecommendation = result?.route_options.some(isEligibleRecommendation) ?? false;
  const profileForDisplay = result?.user_request.elderly_profile ?? stateForDisplay?.elderly_profile;
  const visibleCareSummary = `${profileForDisplay?.age == null ? '年龄待确认' : `${profileForDisplay.age} 岁`} · ${mobilityText[profileForDisplay?.mobility ?? 'UNKNOWN']}`;

  function addMessage(role: Message['role'], text: string) {
    setMessages((items) => [...items, { id: messageId.current++, role, text }]);
  }

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || busyRef.current) return;
    busyRef.current = true;
    generation.current += 1;
    const activeGeneration = generation.current;
    setDraft('');
    setError(null);
    setResult(null);
    setDirectGround(null);
    setDirectPlannerKey((value) => value + 1);
    setSelectedRouteId(null);
    setPlaceChoices([]);
    addMessage('user', text);
    setPhase('interpreting');
    try {
      const reply = await interpret({ text, reference_time: new Date().toISOString(), ...(stateRef.current ? { planning_state: stateRef.current } : {}) });
      if (activeGeneration !== generation.current) return;
      const nextState = reply.planning_state ?? reply.structured_intent ?? null;
      stateRef.current = nextState;
      setPlanningState(nextState);
      setInterpretation(reply);
      setDisplayAssumptions((items) => [...new Set([...items, ...reply.assumptions])]);
      setServiceOnline(true);

      if (isEmergency(reply)) {
        addMessage('assistant', emergencyWarning);
        setPhase('idle');
        return;
      }
      if (reply.planning_allowed !== true || !reply.user_request) {
        addMessage('assistant', readableBackendText(reply.follow_up_question || '还需要补充一些出行信息，请继续说明。'));
        setPhase('idle');
        return;
      }
      const ambiguousRole = (['origin', 'destination'] as const).find((role) =>
        ['天津大学', '天大'].includes(reply.user_request?.[role].label ?? ''));
      if (ambiguousRole) {
        setPlaceChoiceRole(ambiguousRole);
        const followUp = '天津大学有多个校区。请先选择或输入具体校区，才能继续规划。';
        setInterpretation({ ...reply, planning_allowed: false, uncertain_fields: [...(reply.uncertain_fields ?? []), ambiguousRole], follow_up_question: followUp });
        addMessage('assistant', followUp);
        try {
          const found = await searchRealityPlaces('天津大学', 'TIANJIN');
          if (activeGeneration !== generation.current) return;
          setPlaceChoices(found.status === 'OK' ? found.candidates.filter((item) => item.name.startsWith('天津大学') && item.name.includes('校区')).slice(0, 5) : []);
        } catch { /* Manual specific-campus entry remains available. */ }
        setPhase('idle');
        return;
      }
      addMessage('assistant', '已了解本次出行需求，SilverSky 正在生成方案……');
      setPhase('planning');
      const planned = await plan(reply.user_request);
      if (activeGeneration !== generation.current) return;
      setResult(planned);
      setSelectedRouteId(planned.route_options[0]?.route_id ?? null);
      addMessage('assistant', planned.route_options.length ? `已生成 ${planned.route_options.length} 个规划参考方案。请查看安全说明和数据来源。` : '目前缺少足够可靠的地点或路线数据，无法生成规划方案。');
      setPhase('idle');
    } catch (caught) {
      if (activeGeneration !== generation.current) return;
      setError(readableBackendText(readableError(caught)));
      if (!(caught instanceof ApiError) || caught.status == null) setServiceOnline(false);
      setDraft(text);
      setPhase('idle');
    } finally {
      if (activeGeneration === generation.current) busyRef.current = false;
    }
  }

  function reset() {
    generation.current += 1;
    busyRef.current = false;
    stateRef.current = null;
    setPlanningState(null);
    setInterpretation(null);
    setDisplayAssumptions([]);
    setResult(null);
    setDirectGround(null);
    setDirectPlannerKey((value) => value + 1);
    setSelectedRouteId(null);
    setPlaceChoices([]);
    setMessages([{ id: messageId.current++, role: 'assistant', text: welcome }]);
    setDraft('');
    setError(null);
    setPhase('idle');
  }

  function onInputKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  }

  const conversationPanel = <div className="conversation" aria-label="与 SilverSky 的对话" aria-live="polite" tabIndex={0}>
    {messages.map((message) => <div key={message.id} className={`message ${message.role}`}><span className="avatar" aria-hidden="true">{message.role === 'assistant' ? 'S' : '您'}</span><p>{message.text}</p></div>)}
    {phase === 'interpreting' && <div className="inline-status" role="status">正在理解出行需求…</div>}
    {phase === 'planning' && <div className="inline-status" role="status">SilverSky 正在生成方案…<span>分析候选路线 · 进行安全审查</span></div>}
  </div>;

  const additionalNeeds = <dl className="needs-grid additional-needs">
    {stateForDisplay?.location_candidate && <div className="full"><dt>地点待确认</dt><dd>“{stateForDisplay.location_candidate.label}”的起点或终点角色尚未确认</dd></div>}
    <div className="full"><dt>出发时间</dt><dd>{stateForDisplay ? formatDeparture(stateForDisplay) : '待补充'}</dd></div>
    <div><dt>老人年龄</dt><dd>{stateForDisplay?.elderly_profile?.age != null ? `${stateForDisplay.elderly_profile.age} 岁` : displayAssumptions.some((item) => item.includes('七十多岁')) ? '约 70 多岁，待进一步确认' : '待确认'}</dd></div>
    <div><dt>行动能力</dt><dd>{mobilityText[stateForDisplay?.elderly_profile?.mobility ?? 'UNKNOWN']}</dd></div>
    <div><dt>出行偏好</dt><dd>{focusText[stateForDisplay?.preferences?.focus ?? 'BALANCED']}</dd></div>
    <div><dt>需要陪同</dt><dd>{stateForDisplay?.elderly_profile?.assistance_requirement === true ? '是' : stateForDisplay?.elderly_profile?.assistance_requirement === false ? '否' : '待确认'}</dd></div>
  </dl>;

  const directCallbackGeneration = generation.current;
  function showDirectRoute(route: DirectGroundReference | null) {
    if (directCallbackGeneration !== generation.current || busyRef.current || emergency || phase !== 'idle') return;
    setDirectGround(route);
    setResult(null);
    setSelectedRouteId(null);
    setInterpretation(null);
    setPlanningState(null);
    stateRef.current = null;
    setMessages([{ id: messageId.current++, role: 'assistant', text: welcome }]);
    setDraft('');
    setError(null);
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-mark" aria-hidden="true"><span /></div>
        <div className="brand-copy"><strong>SilverSky <em>AI</em></strong><span>{result ? '理解需求 → 形成候选 → 安全审查' : '老年低空出行智能规划助手'}</span></div>
        <div className="topbar-right"><span className={`service-status ${serviceOnline === false ? 'offline' : ''}`} role="status">{serviceOnline === false ? '服务连接异常' : serviceOnline === true ? '服务已连接' : '正在检查服务'}</span><button type="button" className="reset-button" onClick={reset}>重新规划</button></div>
      </header>
      <main className="workspace">
        <section className="sidebar" aria-label="对话和规划方案">
          <div className="sidebar-heading"><div><p className="eyebrow">安心出行，从这里开始</p><h1>今天想去哪里？</h1></div><span className="step-count">{directGround ? '路线已显示' : result ? '03 / 03' : interpretation ? '02 / 03' : '01 / 03'}</span></div>
          <DirectGroundPlanner key={directPlannerKey} disabled={emergency || phase !== 'idle'} onRoute={showDirectRoute} />
          {result ? <details className="conversation-history"><summary>查看对话记录</summary>{conversationPanel}</details> : conversationPanel}

          {emergency && <section className="emergency-panel" role="alert"><strong>{emergencyWarning}</strong><p>SilverSky 不能替代紧急医疗服务。</p></section>}
          {error && <section className="error-panel" role="alert"><strong>本次请求没有完成</strong><p>{error}</p><p>文字已保留，可以重新发送。</p></section>}

          {interpretation && stateForDisplay && <section className={`needs-card ${result ? 'result-needs-card' : ''}`} aria-labelledby="needs-title">
            <div className="section-heading"><div><p className="eyebrow">出行需求</p><h2 id="needs-title">SilverSky 已理解</h2></div>{result ? <strong className="needs-brief">{visibleCareSummary}</strong> : <span className="section-icon" aria-hidden="true">✓</span>}</div>
            <dl className={`needs-grid ${result ? 'result-locations' : ''}`}>
              <div><dt>出发地</dt><dd className="location-summary">{locationSummary(rawOrigin, canonicalOrigin)}</dd></div>
              <div><dt>目的地</dt><dd className="location-summary">{locationSummary(rawDestination, canonicalDestination)}</dd></div>
            </dl>
            {unverifiedPoiCenter && <p className="poi-center-note">位置精度：POI 中心点；具体入口、接送点和无障碍情况待确认。</p>}
            {result ? <details className="needs-more"><summary>查看时间与照护需求</summary>{additionalNeeds}</details> : additionalNeeds}
            {pendingCount > 0 && <p className="needs-pending">{uncertaintyCount === 1 && missingCount === 0 ? '这里有一处需要确认。' : `还需要确认 ${pendingCount} 项信息。`}请根据下方问题继续说明。</p>}
            {interpretation.follow_up_question && !emergency && interpretation.planning_allowed !== true && <p className="follow-up"><strong>请继续告诉我</strong>{readableBackendText(interpretation.follow_up_question)}</p>}
            {placeChoices.length > 0 && <div className="place-choices" aria-label="选择具体地点"><strong>高德地点候选：请选择具体校区</strong>{placeChoices.map((item) => item.name === '天津大学卫津路校区' ? <button key={item.id} type="button" onClick={() => setDraft(placeChoiceRole === 'origin' ? `从${item.name}出发` : `去${item.name}`)}>{item.name}{item.address ? ` · ${item.address}` : ''} · 可查看本地规划参考</button> : <p key={item.id}>{item.name}{item.address ? ` · ${item.address}` : ''}：当前没有已核验的本地线路，暂不能生成该校区的方案。</p>)}<small>选择后请检查输入框并发送；具体入口和上下车点仍需核实。</small></div>}
          </section>}

          {result && <section className="routes-section" aria-labelledby="routes-title">
            <p className="duration-note"><strong>下一步：先查看地面方案与地图，再向出发地和目的地核实入口、接送位置及无障碍条件。</strong> 未来低空方案只是模拟演示，目前不能乘坐。</p>
            <div className="section-heading"><div><p className="eyebrow">规划结果</p><h2 id="routes-title">路线方案 <span>({result.route_options.length})</span></h2></div></div>
            <div className="agent-flow" aria-label="规划角色与处理结果"><strong>规划协作</strong><ol><li><b>需求理解</b><span>提取地点与照护需求</span></li><li><b>候选规划</b><span>形成 {result.route_options.length} 个参考方案</span></li><li><b>安全审查</b><span>逐条给出降级或拒绝理由</span></li></ol><small>当前由本地规则流程承担这些角色。</small></div>
            {result.route_options.length === 0 ? <div className="empty-results" role="status"><strong>目前缺少足够可靠的地点或路线数据，无法生成规划方案。</strong><p>请核对具体地点后重新规划。</p></div> : <>
              {!safeRecommendation && <div className="reference-notice"><strong>目前没有满足 SilverSky 安全推荐条件的真实出行方案。</strong><span>以下方案仅供规划参考。</span></div>}
              <div className="routes-list">{result.route_options.map((route, index) => <RouteCard key={route.route_id} route={route} index={index} selected={route.route_id === selectedRouteId} onSelect={() => setSelectedRouteId(route.route_id)} />)}</div>
              {selectedRoute && <RouteDetail route={selectedRoute} />}
            </>}
            {result.warnings.length > 0 && <div className="warnings"><strong>规划提醒</strong><ul>{result.warnings.map((warning, index) => <li key={index}>{readableBackendText(warning)}</li>)}</ul></div>}
          </section>}

          <form className="composer" onSubmit={send}>
            <label htmlFor="trip-input">描述您的出行需求</label>
            <textarea id="trip-input" value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={onInputKeyDown} rows={3} disabled={phase !== 'idle'} placeholder="例如：我父亲明天下午要去天津医大总医院……" />
            <div className="composer-actions"><span>按 Enter 发送，Shift + Enter 换行</span><button type="submit" disabled={!draft.trim() || phase !== 'idle'}>发送需求 <span aria-hidden="true">↗</span></button></div>
            <div className="demo-actions"><span>快速体验</span><button type="button" onClick={() => setDraft(demoText('TIANJIN'))} disabled={phase !== 'idle'}>天津体验</button><button type="button" onClick={() => setDraft(demoText('SHENZHEN'))} disabled={phase !== 'idle'}>深圳体验</button></div>
          </form>
          <p className="sidebar-footnote">规划信息仅用于当前页面会话；刷新或重新规划后清空。模拟低空情景不代表真实运营服务。</p>
        </section>
        <section id="route-map-panel" className="map-panel" aria-label="路线地图" tabIndex={-1}><RouteMap route={directGround ? null : selectedRoute} directGround={directGround} city={result?.user_request.city ?? stateForDisplay?.city ?? null} origin={directGround ? null : result?.user_request.origin ?? stateForDisplay?.origin ?? null} destination={directGround ? null : result?.user_request.destination ?? stateForDisplay?.destination ?? null} /></section>
      </main>
    </div>
  );
}
