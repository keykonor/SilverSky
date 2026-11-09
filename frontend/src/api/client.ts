import type { DirectGroundReference, InterpretationResult, PlanningResult, RealityPlace, TextInterpretRequest, UserRequest } from '../types/contracts';

export class ApiError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, { ...init, headers: { 'Content-Type': 'application/json', ...init?.headers } });
  } catch {
    throw new ApiError('暂时无法连接规划服务。请确认服务已启动，然后重试。');
  }
  if (!response.ok) {
    let detail = '';
    try {
      const body = await response.json() as { detail?: string | { message?: string } };
      detail = typeof body.detail === 'string' ? body.detail : body.detail?.message ?? '';
    } catch { /* HTTP status is still available. */ }
    throw new ApiError(detail || '服务暂时无法完成请求，请稍后重试。', response.status);
  }
  try {
    return await response.json() as T;
  } catch {
    throw new ApiError('服务返回的内容无法读取，请稍后重试。', response.status);
  }
}

export function health(): Promise<{ status: string }> {
  return request('/health');
}

export function interpret(payload: TextInterpretRequest): Promise<InterpretationResult> {
  return request('/api/v1/interpret', { method: 'POST', body: JSON.stringify(payload) });
}

export function plan(payload: UserRequest): Promise<PlanningResult> {
  return request('/api/v1/plan', { method: 'POST', body: JSON.stringify(payload) });
}

export function searchRealityPlaces(query: string, city: 'TIANJIN' | 'SHENZHEN' | 'ALL'): Promise<{ status: string; candidates: RealityPlace[] }> {
  return request(`/api/v1/reality/places?query=${encodeURIComponent(query)}&city=${city}`);
}

export function routeRealityByIds(originId: string, destinationId: string): Promise<DirectGroundReference | { status: 'DATA_UNAVAILABLE'; message: string }> {
  return request('/api/v1/reality/route-by-id', { method: 'POST', body: JSON.stringify({ origin_id: originId, destination_id: destinationId }) });
}
