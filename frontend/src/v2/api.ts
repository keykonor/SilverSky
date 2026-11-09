import type { RealityPlace } from '../types/contracts';

export interface Intent {
  origin: string | null; destination: string | null; departure_time: string | null;
  age: number | null; mobility: string | null; preferences: string | null;
}
export interface Analysis {
  status: 'OK'; intent: Intent; source: 'DeepSeek'; missing_fields: string[];
  origin_candidates: RealityPlace[]; destination_candidates: RealityPlace[];
  resolved: { origin: RealityPlace | null; destination: RealityPlace | null };
  departure_plan?: { mode: 'NOW' | 'EXACT' | 'NEEDS_CONFIRMATION'; departure_time: string | null;
    departure_window: { start: string; end: string } | null; message: string };
}
export interface TripRoute {
  status: 'OK'; origin: RealityPlace; destination: RealityPlace;
  ground: { geometry: [number, number][]; distance_m: number; duration_min: number;
    retrieved_at: string; source: string; data_status: 'PUBLIC_DATA'; steps: { instruction: string; road: string }[] };
  ground_wgs84: [number, number][];
  air: { geometry: [number, number, number][]; label: '模拟空中路线'; notice: string; data_status: 'SIMULATED_DATA' };
  safety_review: 'NOT_PERFORMED'; coordinate_system: 'GCJ-02';
}
export interface Buildings {
  features: { id: string; footprint: [number, number][]; height_m: number; height_status: 'SOURCE_HEIGHT' | 'ILLUSTRATIVE' }[];
  source: string; retrieved_at: string;
}
export class ApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function api<T>(path: string, body?: unknown): Promise<T> {
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), 65000);
  try {
    const response = await fetch(`/api/v2/${path}`, { signal: abort.signal, cache: 'no-store',
      ...(body === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }) });
    const value = await response.json();
    if (!response.ok) throw new ApiError(response.status, typeof value.detail === 'string' ? value.detail : '信息格式不正确，请检查后重试。');
    return value as T;
  } catch (error) {
    if (error instanceof TypeError) throw new Error('暂时连不上服务，请确认本机服务已启动。文字已保留。');
    if (error instanceof DOMException && error.name === 'AbortError') throw new Error('请求超时，请稍后重试。文字已保留。');
    throw error;
  } finally { clearTimeout(timer); }
}
