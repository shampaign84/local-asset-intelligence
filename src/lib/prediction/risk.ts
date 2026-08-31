/**
 * 상권 쇠퇴/공실 리스크 엔진 — 기획서 §7.4
 *
 * 원칙 A: 위험점수/증감률은 이 엔진(결정론적 가중합 + 시계열 추세)이 계산한다. LLM은 관여하지 않는다.
 * 입력: 상권 월별 지표 시계열 / 출력: 0~100 위험점수, 등급, 주요 변동요인, 신뢰도.
 */

export interface MonthlyMetric {
  period: string; // 'YYYY-MM'
  vacancy_rate: number;
  foot_traffic: number;
  card_sales: number;
  water_usage: number;
  open_count: number;
  close_count: number;
  business_count: number;
}

export interface RiskComputation {
  score: number; // 0~100
  level: "LOW" | "MEDIUM" | "HIGH";
  horizon: string;
  confidence: number;
  drivers: { label: string; value: string; contribution: number }[];
  features: Record<string, number>;
}

/** 최근 6개월 vs 직전 6개월 변화율 기반 위험도 계산 */
export function computeRisk(series: MonthlyMetric[], horizon = "6M"): RiskComputation {
  const sorted = [...series].sort((a, b) => a.period.localeCompare(b.period));
  const recent = sorted.slice(-6);
  const prev = sorted.slice(-12, -6);

  const avg = (arr: MonthlyMetric[], k: keyof MonthlyMetric) =>
    arr.length ? arr.reduce((s, m) => s + (m[k] as number), 0) / arr.length : 0;

  const pct = (now: number, before: number) =>
    before === 0 ? 0 : (now - before) / before;

  // 핵심 변화 지표
  const vacancyNow = avg(recent, "vacancy_rate");
  const vacancyBefore = avg(prev, "vacancy_rate");
  const vacancyDeltaPP = vacancyNow - vacancyBefore; // %p

  const footChange = pct(avg(recent, "foot_traffic"), avg(prev, "foot_traffic"));
  const cardChange = pct(avg(recent, "card_sales"), avg(prev, "card_sales"));
  const waterChange = pct(avg(recent, "water_usage"), avg(prev, "water_usage"));

  const closeRecent = recent.reduce((s, m) => s + m.close_count, 0);
  const bizRecent = avg(recent, "business_count") || 1;
  const closureRate = closeRecent / bizRecent; // 최근 6개월 폐업/영업업소

  const features = {
    vacancy_delta_pp: round(vacancyDeltaPP, 2),
    foot_traffic_change: round(footChange, 3),
    card_sales_change: round(cardChange, 3),
    water_usage_change: round(waterChange, 3),
    closure_rate_6m: round(closureRate, 3),
  };

  // 지표별 위험 기여(0~1 로 정규화 후 가중)
  const parts = [
    { key: "공실률 상승", raw: clamp01(vacancyDeltaPP / 5), w: 0.3, disp: `+${round(vacancyDeltaPP, 1)}%p` },
    { key: "폐업률", raw: clamp01(closureRate / 0.15), w: 0.25, disp: `${round(closureRate * 100, 1)}%` },
    { key: "유동인구 감소", raw: clamp01(-footChange / 0.2), w: 0.18, disp: `${round(footChange * 100, 1)}%` },
    { key: "카드매출 감소", raw: clamp01(-cardChange / 0.2), w: 0.15, disp: `${round(cardChange * 100, 1)}%` },
    { key: "수도사용량 감소", raw: clamp01(-waterChange / 0.25), w: 0.12, disp: `${round(waterChange * 100, 1)}%` },
  ];

  const score = round(
    parts.reduce((s, p) => s + p.raw * p.w, 0) * 100,
    1
  );

  const level: RiskComputation["level"] = score >= 66 ? "HIGH" : score >= 40 ? "MEDIUM" : "LOW";

  // 기여도 높은 순으로 주요 변동요인 정렬
  const drivers = parts
    .map((p) => ({ label: p.key, value: p.disp, contribution: round(p.raw * p.w, 3) }))
    .sort((a, b) => b.contribution - a.contribution)
    .slice(0, 3);

  // 데이터 충분도 기반 신뢰도
  const confidence = round(clamp01(sorted.length / 24) * 0.6 + 0.35, 2);

  return { score, level, horizon, confidence, drivers, features };
}

function clamp01(x: number) {
  return Math.max(0, Math.min(1, x));
}
function round(x: number, d: number) {
  const f = Math.pow(10, d);
  return Math.round(x * f) / f;
}
