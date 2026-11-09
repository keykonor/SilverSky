import type { DataStatus, InterpretationResult, PlanningState, ReviewOutcome, RouteOption, Segment } from './types/contracts';

export const dataStatusText: Record<DataStatus, string> = {
  VERIFIED: '已核验数据',
  PUBLIC_DATA: '公开数据',
  SIMULATED_DATA: '模拟数据',
  DATA_UNAVAILABLE: '暂无可靠数据',
};

export const reviewText: Record<ReviewOutcome, string> = {
  PASS: '安全审查通过',
  DOWNGRADE: '存在限制，已降低推荐优先级',
  REJECT: '当前不建议采用',
  UNKNOWN: '安全信息不足',
};

export const geometryStatusText: Record<NonNullable<Segment['geometry_status']>, string> = {
  PUBLIC_ROUTE_SNAPSHOT: '静态道路模型',
  STRAIGHT_REFERENCE_LINE: '地面示意连接',
  SIMULATED_AIR_CORRIDOR: '未来低空模拟路径',
};

const internalStatusText: Record<string, string> = {
  ...dataStatusText,
  ...geometryStatusText,
  PASS: reviewText.PASS,
  DOWNGRADE: reviewText.DOWNGRADE,
  REJECT: reviewText.REJECT,
  UNKNOWN: reviewText.UNKNOWN,
};

export function readableBackendText(value: string): string {
  return value.replace(/\b(?:VERIFIED|PUBLIC_DATA|SIMULATED_DATA|DATA_UNAVAILABLE|PUBLIC_ROUTE_SNAPSHOT|STRAIGHT_REFERENCE_LINE|SIMULATED_AIR_CORRIDOR|PASS|DOWNGRADE|REJECT|UNKNOWN)\b/g, (status) => internalStatusText[status]);
}

export const mobilityText: Record<string, string> = {
  NORMAL: '行动正常',
  INDEPENDENT: '可独立行动',
  MODERATE: '行动一般',
  LIMITED: '行动能力受限',
  ASSISTED: '需要协助行动',
  WHEELCHAIR: '使用轮椅',
  UNKNOWN: '待确认',
};

export const focusText: Record<string, string> = {
  SAFETY_COMFORT: '安全舒适优先',
  TIME: '时间优先',
  LESS_WALKING: '少步行',
  FEWER_TRANSFERS: '少换乘',
  LOW_COST: '费用优先',
  BALANCED: '综合考虑',
  FASTEST: '时间优先',
  ECONOMICAL: '费用优先',
};

export function isEmergency(result: InterpretationResult): boolean {
  return result.planning_state?.urgency === 'MEDICAL_EMERGENCY'
    || result.structured_intent?.urgency === 'MEDICAL_EMERGENCY'
    || result.user_request?.urgency === 'MEDICAL_EMERGENCY';
}

export function isEligibleRecommendation(route: RouteOption): boolean {
  return route.display_labels.includes('RECOMMENDED')
    && route.route_type === 'GROUND_ONLY'
    && route.risk_assessment.review_outcome === 'PASS'
    && (route.data_status === 'VERIFIED' || route.data_status === 'PUBLIC_DATA');
}

export function isSimulated(route: RouteOption): boolean {
  return route.route_type === 'GROUND_AIR_GROUND'
    || route.display_labels.includes('SIMULATED_SCENARIO')
    || route.segments.some((segment) => segment.segment_type === 'AIR' || segment.evidence.data_status === 'SIMULATED_DATA');
}

export function formatDeparture(state: PlanningState): string {
  if (state.departure_window) {
    const date = new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', month: 'numeric', day: 'numeric' }).format(new Date(state.departure_window.start));
    const time = new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', hour: '2-digit', minute: '2-digit', hour12: false });
    return `${date} 下午 ${time.format(new Date(state.departure_window.start))}–${time.format(new Date(state.departure_window.end))}`;
  }
  if (state.departure_time) {
    return new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(state.departure_time));
  }
  return '待补充';
}

export function demoText(city: 'TIANJIN' | 'SHENZHEN'): string {
  return city === 'TIANJIN'
    ? '78岁老人行动能力有限，需要陪同，从天津大学卫津路校区附近到天津医科大学总医院，明天下午15:00出发，普通出行，安全舒适优先。'
    : '72岁老人从深圳市养老护理院到北京大学深圳医院，明天下午15:00出发，普通出行，安全舒适优先。';
}
