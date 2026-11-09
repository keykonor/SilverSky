import { useEffect, useState } from 'react';
import type { Analysis } from './api';

export function beijingInput(time: number): string {
  return new Date(time + 8*3600000).toISOString().slice(0, 16);
}
export function estimatedArrival(value: string, now: number, durationMin: number): { departure: number; arrival: number } | null {
  const departure = value ? Date.parse(`${value}:00+08:00`) : now;
  if (!Number.isFinite(departure) || !Number.isFinite(durationMin) || durationMin <= 0 || departure < now - 60000) return null;
  return { departure, arrival: departure + Math.ceil(durationMin)*60000 };
}
const display = (time: number) => new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(time);

export function DeparturePlan({ plan, durationMin }: { plan: Analysis['departure_plan']; durationMin: number }) {
  const [now, setNow] = useState(Date.now());
  const [mode, setMode] = useState<'now' | 'chosen'>(plan && plan.mode !== 'NOW' ? 'chosen' : 'now');
  const [value, setValue] = useState(plan?.departure_time ? beijingInput(Date.parse(plan.departure_time)) : '');
  useEffect(() => {
    setMode(plan && plan.mode !== 'NOW' ? 'chosen' : 'now');
    setValue(plan?.departure_time ? beijingInput(Date.parse(plan.departure_time)) : '');
  }, [plan]);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(timer); }, []);
  const times = mode === 'chosen' && !value ? null : estimatedArrival(mode === 'now' ? '' : value, now, durationMin);
  return <section className="v2-time-plan" aria-labelledby="v2-time-title">
    <h3 id="v2-time-title">地面行程时间</h3>
    <div className="v2-time-mode"><button type="button" aria-pressed={mode === 'now'} onClick={() => { setNow(Date.now()); setMode('now'); }}>现在出发</button><button type="button" aria-pressed={mode === 'chosen'} onClick={() => { setMode('chosen'); if (!value && plan?.mode !== 'NEEDS_CONFIRMATION') setValue(beijingInput(Date.now()+3600000)); }}>选择时间</button></div>
    {mode === 'chosen' && <label className="v2-departure-label">出发时间（北京时间）<input type="datetime-local" value={value} onChange={(event) => { setValue(event.target.value); setNow(Date.now()); }} /></label>}
    {times ? <ol className="v2-timeline" aria-label="地面出发与到达安排"><li><span>出发</span><strong>{display(times.departure)}</strong></li><li><span>预计行驶</span><strong>约 {Math.ceil(durationMin)} 分钟</strong></li><li><span>预计到达</span><strong>{display(times.arrival)}</strong></li></ol> : <p className="v2-time-warning" role="status">请选择有效的未来出发时间，才能估算到达时间。</p>}
    {plan?.mode === 'NEEDS_CONFIRMATION' && !value && <p className="v2-time-warning">{plan.message}</p>}
    <small>按高德当前道路耗时估算，未来路况可能变化；不含等候、上下车与接送。模拟空中路线没有可用运营时间。</small>
  </section>;
}
