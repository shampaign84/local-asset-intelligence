/**
 * 데이터 생성기 — 마포구 상권/업소/월별지표 (결정론적 seeded)
 *
 * 실제 CSV(상가정보·부동산원 공실률·인허가)가 있으면 scripts/seed-db.ts 가 우선 사용하고,
 * 없으면(특히 PGlite 데모) 이 생성기가 실제 구조에 기반한 현실적 데이터를 만든다.
 * 유동인구·카드매출·수도사용량은 무료 공개 API 부재로 항상 mock 이다.
 */
import { ZONES, CATEGORIES, STATUS, type ZoneSeed } from "./reference";

export interface BusinessRow {
  business_id: string;
  name: string;
  category_code: string;
  category_name: string;
  status: string;
  open_date: string | null;
  close_date: string | null;
  admin_dong: string;
  zone_id: string;
  lat: number;
  lng: number;
  source_system: string;
  data_period: string;
  lineage_id: string;
}

export interface MetricRow {
  zone_id: string;
  period: string;
  vacancy_rate: number;
  rent_index: number;
  foot_traffic: number;
  card_sales: number;
  water_usage: number;
  open_count: number;
  close_count: number;
  business_count: number;
  source_system: string;
}

/** 최근 24개월 (…2026-08 까지) */
export function months(n = 24, end = { y: 2026, m: 8 }): string[] {
  const out: string[] = [];
  let y = end.y;
  let m = end.m;
  for (let i = 0; i < n; i++) {
    out.unshift(`${y}-${String(m).padStart(2, "0")}`);
    m--;
    if (m === 0) {
      m = 12;
      y--;
    }
  }
  return out;
}

export function generateAll(seed = 42) {
  const rnd = mulberry32(seed);
  const ms = months(24);
  const zones = ZONES;
  const businesses: BusinessRow[] = [];
  const metrics: MetricRow[] = [];

  for (const z of zones) {
    metrics.push(...genZoneMetrics(z, ms, rnd));
    businesses.push(...genBusinesses(z, ms, rnd));
  }
  return { zones, businesses, metrics, months: ms };
}

function genZoneMetrics(z: ZoneSeed, ms: string[], rnd: () => number): MetricRow[] {
  const rows: MetricRow[] = [];
  const n = ms.length;
  for (let i = 0; i < n; i++) {
    const t = i; // 0..23
    const vacancy = Math.max(0.5, z.baseVacancy + z.vacancyTrend * t + noise(rnd, 0.4));
    const rentIndex = 100 - z.vacancyTrend * t * 1.3 + noise(rnd, 0.6);
    // 영업 업소 수: 공실 상승 시 완만히 감소
    const businessCount = Math.round(z.baseBusiness * (1 - (vacancy - z.baseVacancy) / 100) + noise(rnd, 5));
    // 폐업/개업: 쇠퇴(trend>0)일수록 폐업↑ 개업↓
    const decline = Math.max(0, z.vacancyTrend);
    const closeCount = Math.max(0, Math.round((z.baseBusiness / 220) * (1 + decline * 2) + noise(rnd, 1.2)));
    const openCount = Math.max(0, Math.round((z.baseBusiness / 240) * (1 - decline) + noise(rnd, 1.2)));
    // 유동인구/카드매출/수도: 공실 상승과 음의 상관 (mock)
    const activity = 1 - (vacancy - z.baseVacancy) / 60;
    const footTraffic = Math.round(z.baseBusiness * 95 * activity + noise(rnd, 400));
    const cardSales = Math.round(z.baseBusiness * 3_100_000 * activity + noise(rnd, 8_000_000));
    const waterUsage = Math.round((businessCount * 14 * activity + noise(rnd, 60)) * 10) / 10;

    rows.push({
      zone_id: z.zone_id,
      period: ms[i],
      vacancy_rate: r1(vacancy),
      rent_index: r1(rentIndex),
      foot_traffic: Math.max(0, footTraffic),
      card_sales: Math.max(0, cardSales),
      water_usage: Math.max(0, waterUsage),
      open_count: openCount,
      close_count: closeCount,
      business_count: Math.max(0, businessCount),
      source_system: "reb+localdata+mock",
    });
  }
  return rows;
}

function genBusinesses(z: ZoneSeed, ms: string[], rnd: () => number): BusinessRow[] {
  const rows: BusinessRow[] = [];
  const count = Math.round(z.baseBusiness * 0.35); // 대표 표본
  const decline = Math.max(0, z.vacancyTrend);
  for (let i = 0; i < count; i++) {
    const cat = pickCategory(rnd);
    // 폐업 확률: 업종 민감도 × 상권 쇠퇴도
    const closeProb = Math.min(0.4, 0.06 * cat.closureBias * (1 + decline * 2.2));
    const roll = rnd();
    let status: string = STATUS.OPEN;
    let closeDate: string | null = null;
    if (roll < closeProb) {
      status = STATUS.CLOSED;
      closeDate = ms[Math.floor(rnd() * ms.length)] + "-15";
    } else if (roll < closeProb + 0.03) {
      status = STATUS.SUSPENDED;
    }
    const openYear = 2012 + Math.floor(rnd() * 13);
    const openDate = `${openYear}-${String(1 + Math.floor(rnd() * 12)).padStart(2, "0")}-01`;
    rows.push({
      business_id: `${z.zone_id}-B${String(i + 1).padStart(4, "0")}`,
      name: `${cat.name.replace(/[·].*/, "")} ${sampleName(rnd)}`,
      category_code: cat.code,
      category_name: cat.name,
      status,
      open_date: openDate,
      close_date: closeDate,
      admin_dong: z.admin_dong,
      zone_id: z.zone_id,
      lat: r5(z.lat + noise(rnd, 0.004)),
      lng: r5(z.lng + noise(rnd, 0.004)),
      source_system: "sbiz_sangga+localdata",
      data_period: "2026-03",
      lineage_id: `LIN-${z.zone_id}-${i + 1}`,
    });
  }
  return rows;
}

const NAME_POOL = ["마포점", "연남점", "합정점", "본점", "1호점", "구름", "달빛", "골목", "모퉁이", "정원", "하루", "온기", "다올", "미가", "제일"];
function sampleName(rnd: () => number) {
  return NAME_POOL[Math.floor(rnd() * NAME_POOL.length)];
}

function pickCategory(rnd: () => number) {
  const total = CATEGORIES.reduce((s, c) => s + c.weight, 0);
  let x = rnd() * total;
  for (const c of CATEGORIES) {
    if ((x -= c.weight) <= 0) return c;
  }
  return CATEGORIES[0];
}

// --- 유틸 ---
function mulberry32(a: number) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function noise(rnd: () => number, scale: number) {
  return (rnd() - 0.5) * 2 * scale;
}
function r1(x: number) {
  return Math.round(x * 10) / 10;
}
function r5(x: number) {
  return Math.round(x * 1e5) / 1e5;
}
