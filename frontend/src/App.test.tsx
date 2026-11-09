import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import App from './App';
import { health, interpret, plan, searchRealityPlaces } from './api/client';
import type { InterpretationResult, PlanningResult, PlanningState, RouteOption } from './types/contracts';

vi.mock('./api/client', async (importOriginal) => ({ ...(await importOriginal<typeof import('./api/client')>()), health: vi.fn(), interpret: vi.fn(), plan: vi.fn(), searchRealityPlaces: vi.fn() }));
vi.mock('./components/RouteMap', () => ({ default: ({ route }: { route: RouteOption | null }) => <div data-testid="route-map">{route?.route_id ?? '无选中路线'}</div> }));

const previous: PlanningState = { destination: { label: '天津医大总医院' }, departure_window: { start: '2026-09-28T12:00:00+08:00', end: '2026-09-28T18:00:00+08:00', precision: 'AFTERNOON' } };
const complete: PlanningState = { ...previous, origin: { label: '天津大学卫津路校区' }, elderly_profile: { age: 78, mobility: 'LIMITED', wheelchair_requirement: null, assistance_requirement: null }, preferences: { focus: 'SAFETY_COMFORT', air_option: 'UNSPECIFIED' } };
const userRequest = { origin: complete.origin!, destination: complete.destination!, departure_time: null, departure_window: complete.departure_window!, urgency: 'NORMAL' as const, elderly_profile: complete.elderly_profile!, preferences: complete.preferences! };

function reply(state: PlanningState, allowed: boolean, question: string | null = null, uncertain_fields: InterpretationResult['uncertain_fields'] = []): InterpretationResult {
  return { user_request: allowed ? userRequest : null, needs_summary: '需求摘要', missing_fields: allowed ? [] : state.origin ? [] : ['origin'], assumptions: [], interpretation_summary: '需求摘要', structured_intent: state, planning_state: state, uncertain_fields, follow_up_question: question, planning_allowed: allowed };
}

function route(id: string, overrides: Partial<RouteOption> = {}): RouteOption {
  return { route_id: id, route_type: 'GROUND_ONLY', display_labels: ['UNRANKED'], total_time_min: 12, walking_distance_m: null, transfer_count: 0, estimated_cost_cny: null, comfort_score: null, risk_level: 'UNKNOWN', data_status: 'PUBLIC_DATA', segments: [{ segment_type: 'CAR', origin: { label: '天津大学' }, destination: { label: '天津医大总医院' }, distance_m: 1200, duration_min: 12, evidence: { data_status: 'PUBLIC_DATA', source_ref: 'fixture', observed_at: '2026-09-27T00:00:00+08:00' } }], risk_assessment: { weather: 'UNKNOWN', mobility: 'UNKNOWN', transfer: 'LOW', operational: 'UNKNOWN', data_uncertainty: 'HIGH', review_outcome: 'DOWNGRADE', reasons: ['出入口数据未核验'] }, explanation: '因安全和舒适需求生成。', ...overrides };
}

function result(routes: RouteOption[], warnings: string[] = []): PlanningResult {
  return { schema_version: '0.1-proposal', user_request: userRequest, needs_summary: '需求摘要', route_options: routes, warnings };
}

function submit(text: string) {
  fireEvent.change(screen.getByRole('textbox', { name: '描述您的出行需求' }), { target: { value: text } });
  fireEvent.click(screen.getByRole('button', { name: /发送需求/ }));
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(health).mockResolvedValue({ status: 'ok' });
  vi.mocked(searchRealityPlaces).mockResolvedValue({ status: 'OK', candidates: [{ id: '1', name: '天津大学卫津路校区', address: '天津', city: '天津市', location: [117.17, 39.10], precision: 'POI', source: '高德 Web 服务' }, { id: '2', name: '天津大学北洋园校区', address: '天津', city: '天津市', location: [117.10, 39.00], precision: 'POI', source: '高德 Web 服务' }] });
});

describe('Sprint 2 user flow', () => {
  it('F01 首次打开显示欢迎、输入和两个体验入口', () => {
    render(<App />);
    expect(screen.getByText(/优先考虑安全与舒适/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '天津体验' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '深圳体验' })).toBeInTheDocument();
  });

  it.each([['F02 天津', '天津体验', '天津大学卫津路校区'], ['F03 深圳', '深圳体验', '深圳市养老护理院']])('%s Demo 填入自然语言并经过 interpret 和 plan', async (_name, button, place) => {
    vi.mocked(interpret).mockResolvedValue(reply(complete, true));
    vi.mocked(plan).mockResolvedValue(result([route('ground')]));
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: button }));
    expect((screen.getByRole('textbox', { name: '描述您的出行需求' }) as HTMLTextAreaElement).value).toContain(place);
    fireEvent.click(screen.getByRole('button', { name: /发送需求/ }));
    await waitFor(() => expect(plan).toHaveBeenCalledTimes(1));
    expect(interpret).toHaveBeenCalledTimes(1);
  });

  it('F04/F05/F06/F07 不完整时显示追问，回传原状态并保留已知需求', async () => {
    const ambiguousComplete = { ...complete, origin: { label: '天津大学' } };
    vi.mocked(interpret).mockResolvedValueOnce(reply(previous, false, '请告诉我具体起点。')).mockResolvedValueOnce({ ...reply(ambiguousComplete, true), user_request: { ...userRequest, origin: { label: '天津大学' } } }).mockResolvedValueOnce(reply(complete, true));
    vi.mocked(plan).mockResolvedValue(result([]));
    render(<App />);
    submit('我父亲明天下午去天津医大总医院');
    await screen.findAllByText('请告诉我具体起点。');
    expect(plan).not.toHaveBeenCalled();
    expect(screen.getByText('用户描述：天津医大总医院')).toBeInTheDocument();
    submit('从天津大学出发，78岁，腿脚不方便');
    await screen.findAllByText(/天津大学有多个校区/);
    expect(plan).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /天津大学卫津路校区/ })).toBeInTheDocument();
    submit('从天津大学卫津路校区出发');
    await waitFor(() => expect(plan).toHaveBeenCalledTimes(1));
    expect(vi.mocked(interpret).mock.calls[1][0].planning_state).toEqual(previous);
    expect(screen.getByText('78 岁')).toBeInTheDocument();
  });

  it('F08 保留下午时间窗口，不伪造单点时间', async () => {
    vi.mocked(interpret).mockResolvedValue(reply(complete, true));
    vi.mocked(plan).mockResolvedValue(result([]));
    render(<App />);
    submit('出行');
    expect(await screen.findByText(/下午 12:00–18:00/)).toBeInTheDocument();
  });

  it('地点仍是天津大学简称时，其他句子提到校区也不能绕过选择', async () => {
    const ambiguous = { ...complete, origin: { label: '天津大学' } };
    vi.mocked(interpret).mockResolvedValue({ ...reply(ambiguous, true), user_request: { ...userRequest, origin: { label: '天津大学' } } });
    render(<App />);
    submit('从天津大学去医院，天津大学北洋园校区不方便');
    await screen.findAllByText(/天津大学有多个校区/);
    expect(plan).not.toHaveBeenCalled();
  });

  it('F09 冲突等待澄清，不进入规划', async () => {
    vi.mocked(interpret).mockResolvedValue(reply(complete, false, '请确认是一般赶时间，还是发生了需要急救的症状或危险？', ['urgency']));
    render(<App />);
    submit('不着急，但必须二十分钟到');
    await screen.findAllByText(/请确认是一般赶时间/);
    expect(screen.getByText(/这里有一处需要确认/)).toBeInTheDocument();
    expect(plan).not.toHaveBeenCalled();
  });

  it('F10 医疗急症显著提示并停止规划', async () => {
    vi.mocked(interpret).mockResolvedValue(reply({ ...previous, urgency: 'MEDICAL_EMERGENCY' }, false, '请联系 120。'));
    render(<App />);
    submit('老人突然胸痛');
    expect(await screen.findByText('SilverSky 不能替代紧急医疗服务。')).toBeInTheDocument();
    expect(screen.getByText(/普通路线查找已暂停/)).toBeInTheDocument();
    expect(plan).not.toHaveBeenCalled();
  });

  it('F11/F16 候选数量动态显示且切换方案同步地图', async () => {
    vi.mocked(interpret).mockResolvedValue(reply(complete, true));
    vi.mocked(plan).mockResolvedValue(result([route('first'), route('second')]));
    render(<App />);
    submit('完整需求');
    expect(await screen.findByRole('heading', { name: /路线方案/ })).toBeInTheDocument();
    expect(screen.getByText('(2)')).toBeInTheDocument();
    expect(screen.getByTestId('route-map')).toHaveTextContent('first');
    fireEvent.click(screen.getByRole('button', { name: /方案 B/ }));
    expect(screen.getByTestId('route-map')).toHaveTextContent('second');
  });

  it('F12 零候选展示后端警告', async () => {
    vi.mocked(interpret).mockResolvedValue(reply(complete, true));
    vi.mocked(plan).mockResolvedValue(result([], ['地点未匹配已登记 POI']));
    render(<App />);
    submit('完整需求');
    expect(await screen.findByText('地点未匹配已登记 POI')).toBeInTheDocument();
    expect(screen.getAllByText(/缺少足够可靠的地点或路线数据/).length).toBeGreaterThan(0);
  });

  it('F13/F14/F15 模拟情景和安全拒绝有文字，不冒称推荐', async () => {
    const simulated = route('air', { route_type: 'GROUND_AIR_GROUND', display_labels: ['SIMULATED_SCENARIO'], data_status: 'SIMULATED_DATA', risk_assessment: { weather: 'UNKNOWN', mobility: 'UNKNOWN', transfer: 'UNKNOWN', operational: 'HIGH', data_uncertainty: 'HIGH', review_outcome: 'REJECT', reasons: ['真实运营不可用'] } });
    vi.mocked(interpret).mockResolvedValue(reply(complete, true));
    vi.mocked(plan).mockResolvedValue(result([simulated]));
    render(<App />);
    submit('完整需求');
    expect(await screen.findByText(/当前不可据此购票或乘坐/)).toBeInTheDocument();
    expect(screen.getAllByText(/当前不建议采用/).length).toBeGreaterThan(0);
    expect(screen.getByText(/目前没有满足 SilverSky 安全推荐条件的真实出行方案/)).toBeInTheDocument();
    expect(screen.getByText(/数据来源：模拟数据/)).toBeInTheDocument();
  });

  it('S3-11 拒绝方案即使正在查看，也保持中性选中态和明确拒绝结论', async () => {
    const rejected = route('air', { route_type: 'GROUND_AIR_GROUND', display_labels: ['SIMULATED_SCENARIO'], risk_assessment: { weather: 'UNKNOWN', mobility: 'UNKNOWN', transfer: 'UNKNOWN', operational: 'HIGH', data_uncertainty: 'HIGH', review_outcome: 'REJECT', reasons: ['真实运营不可用'] } });
    vi.mocked(interpret).mockResolvedValue(reply(complete, true));
    vi.mocked(plan).mockResolvedValue(result([route('ground'), rejected]));
    const { container } = render(<App />);
    submit('完整需求');
    await screen.findByRole('heading', { name: /路线方案/ });
    fireEvent.click(screen.getByRole('button', { name: /查看方案 B/ }));
    const selected = container.querySelector('.route-card.selected');
    expect(selected).toHaveClass('rejected');
    expect(selected).toHaveTextContent('当前查看');
    expect(selected).toHaveTextContent('当前不建议采用');
    expect(selected).not.toHaveTextContent('✓');
    expect(selected).not.toHaveTextContent('满足安全推荐条件');
  });

  it('S3-12/S3-13 用户描述和登记 POI 并列，服务状态码转为人类语言', async () => {
    const canonical = route('ground', { segments: [{ segment_type: 'CAR', origin: { label: '天津大学卫津路校区', canonical_poi_id: 'tj-university-weijin', entity_precision: 'POI', entrance_verified: false }, destination: { label: '天津医科大学总医院', canonical_poi_id: 'tj-general-hospital', entity_precision: 'POI', entrance_verified: false }, distance_m: 1200, duration_min: 12, evidence: { data_status: 'PUBLIC_DATA' }, geometry: { type: 'LineString', coordinates: [[117.1, 39.1], [117.2, 39.2]] }, geometry_status: 'PUBLIC_ROUTE_SNAPSHOT', geometry_evidence: { data_status: 'PUBLIC_DATA' } }], explanation: '路线为 PUBLIC_ROUTE_SNAPSHOT，费用 DATA_UNAVAILABLE。' });
    vi.mocked(interpret).mockResolvedValue(reply(complete, true));
    vi.mocked(plan).mockResolvedValue(result([canonical], ['DATA_UNAVAILABLE：缺少实时天气。']));
    const { container } = render(<App />);
    submit('完整需求');
    await screen.findByRole('heading', { name: /路线方案/ });
    expect(screen.getByText('用户描述：天津大学卫津路校区')).toBeInTheDocument();
    expect(screen.getByText('解析地点：天津大学卫津路校区')).toBeInTheDocument();
    expect(screen.getAllByText('位置精度：POI 中心点；具体入口、接送点和无障碍情况待确认。')).toHaveLength(1);
    expect(screen.getByText(/暂无可靠数据：缺少实时天气/)).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/\b(?:PUBLIC_ROUTE_SNAPSHOT|DATA_UNAVAILABLE)\b/);
  });

  it('S3 行程阶段使用简短的模拟起降点名称，方案切换位于详情之前', async () => {
    const base = route('base').segments[0];
    const a = { label: '天津 Golden Demo 模拟起降点 A' };
    const b = { label: '天津 Golden Demo 模拟起降点 B' };
    const geometry = { type: 'LineString' as const, coordinates: [[117.1, 39.1], [117.2, 39.2]] as [number, number][] };
    const geometry_evidence = { data_status: 'SIMULATED_DATA' as const };
    const stages: RouteOption['segments'] = [
      { ...base, destination: a, geometry, geometry_status: 'STRAIGHT_REFERENCE_LINE', geometry_evidence },
      { ...base, segment_type: 'AIR', origin: a, destination: b, geometry, geometry_status: 'SIMULATED_AIR_CORRIDOR', geometry_evidence, evidence: { data_status: 'SIMULATED_DATA' } },
      { ...base, origin: b, geometry, geometry_status: 'STRAIGHT_REFERENCE_LINE', geometry_evidence },
    ];
    vi.mocked(interpret).mockResolvedValue(reply(complete, true));
    vi.mocked(plan).mockResolvedValue(result([route('ground'), route('air', { route_type: 'GROUND_AIR_GROUND', data_status: 'DATA_UNAVAILABLE', segments: stages })]));
    const { container } = render(<App />);
    submit('完整需求');
    await screen.findByRole('heading', { name: /路线方案/ });
    fireEvent.click(screen.getByRole('button', { name: /查看方案 B/ }));
    const timeline = screen.getByRole('region', { name: '行程阶段' });
    expect(timeline).toHaveTextContent('模拟起降点 A');
    expect(timeline).toHaveTextContent('模拟起降点 B');
    expect(timeline).not.toHaveTextContent('Golden Demo');
    expect(container.querySelector('.routes-list')?.compareDocumentPosition(container.querySelector('.route-detail')!)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it('F17 后端连接失败保留输入并显示友好错误', async () => {
    vi.mocked(interpret).mockRejectedValue(new Error('暂时无法连接规划服务。'));
    render(<App />);
    submit('去医院');
    expect(await screen.findByText('暂时无法连接规划服务。')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: '描述您的出行需求' })).toHaveValue('去医院');
  });

  it('F18 重新规划清除本次 planning_state', async () => {
    vi.mocked(interpret).mockResolvedValueOnce(reply(previous, false, '请告诉我具体起点。')).mockResolvedValueOnce(reply(previous, false, '请告诉我具体起点。'));
    render(<App />);
    submit('去天津医大总医院');
    await screen.findAllByText('请告诉我具体起点。');
    fireEvent.click(screen.getByRole('button', { name: '重新规划' }));
    submit('新规划');
    await waitFor(() => expect(interpret).toHaveBeenCalledTimes(2));
    expect(vi.mocked(interpret).mock.calls[1][0]).not.toHaveProperty('planning_state');
  });

  it('F19 输入框可用 Enter 键完成发送', async () => {
    vi.mocked(interpret).mockResolvedValue(reply(previous, false, '请告诉我具体起点。'));
    render(<App />);
    const input = screen.getByRole('textbox', { name: '描述您的出行需求' });
    fireEvent.change(input, { target: { value: '去天津' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });
    await waitFor(() => expect(interpret).toHaveBeenCalledTimes(1));
  });
});
