/**
 * SQL Tool — 기획서 §12 Tool1 + §21 SQL Guard
 *
 * 필수 가드: SELECT only / 테이블·컬럼 allowlist / LIMIT 강제 / 위험 키워드 차단 / PII 컬럼 denylist.
 * 프로토타입에서는 안전한 파라미터 쿼리 빌더를 기본 경로로 쓰고, 자유형 SQL(LLM 생성)은
 * validateSelect() 가드를 통과해야만 실행한다.
 */
import { getDb } from "../../db";

export const ALLOWED_TABLES = ["commercial_zone", "business", "zone_metric", "risk_score"];
export const PII_DENYLIST = ["resident_no", "phone", "account_no", "owner_name"]; // 존재 시 차단
const FORBIDDEN = /\b(insert|update|delete|drop|alter|create|truncate|grant|revoke|copy|merge|;|--)\b/i;

/** 자유형 SELECT 가드 검증 (LLM 생성 SQL 대비) */
export function validateSelect(sql: string): { ok: boolean; reason?: string; sql: string } {
  const s = sql.trim().replace(/;+\s*$/, "");
  if (!/^select\s/i.test(s)) return { ok: false, reason: "SELECT 문만 허용됩니다.", sql: s };
  if (FORBIDDEN.test(s)) return { ok: false, reason: "허용되지 않은 키워드가 포함되어 있습니다.", sql: s };
  for (const pii of PII_DENYLIST) {
    if (new RegExp(`\\b${pii}\\b`, "i").test(s))
      return { ok: false, reason: `PII 컬럼(${pii}) 접근은 금지됩니다.`, sql: s };
  }
  // 테이블 allowlist (FROM/JOIN 뒤 식별자 검사)
  const tables = [...s.matchAll(/\b(?:from|join)\s+([a-z_][a-z0-9_]*)/gi)].map((m) => m[1].toLowerCase());
  for (const t of tables) {
    if (!ALLOWED_TABLES.includes(t)) return { ok: false, reason: `허용되지 않은 테이블: ${t}`, sql: s };
  }
  const guarded = /\blimit\s+\d+/i.test(s) ? s : `${s} LIMIT 100`;
  return { ok: true, sql: guarded };
}

export async function runGuardedSelect<T = Record<string, unknown>>(sql: string): Promise<T[]> {
  const v = validateSelect(sql);
  if (!v.ok) throw new Error(`SQL 가드 위반: ${v.reason}`);
  const db = await getDb();
  return db.query<T>(v.sql);
}

// ---------- 안전 파라미터 쿼리 (기본 경로) ----------

export interface ZoneRisk {
  zone_id: string;
  name: string;
  admin_dong: string;
  score: number;
  level: string;
  drivers: unknown;
  vacancy_now: number;
  vacancy_6m_ago: number;
}

/** 상권 위험도 랭킹 (최근 공실률 포함) */
export async function zoneRiskRanking(): Promise<ZoneRisk[]> {
  const db = await getDb();
  return db.query<ZoneRisk>(`
    WITH latest AS (SELECT max(period) AS p FROM zone_metric)
    SELECT z.zone_id, z.name, z.admin_dong,
           r.score, r.level, r.drivers,
           mn.vacancy_rate AS vacancy_now,
           mo.vacancy_rate AS vacancy_6m_ago
    FROM commercial_zone z
    JOIN risk_score r ON r.zone_id = z.zone_id
    LEFT JOIN zone_metric mn ON mn.zone_id = z.zone_id AND mn.period = (SELECT p FROM latest)
    LEFT JOIN zone_metric mo ON mo.zone_id = z.zone_id
         AND mo.period = to_char((to_date((SELECT p FROM latest),'YYYY-MM') - interval '6 month'),'YYYY-MM')
    ORDER BY r.score DESC
    LIMIT 20
  `);
}

export interface MetricPoint {
  period: string;
  vacancy_rate: number;
  water_usage: number;
  foot_traffic: number;
  card_sales: number;
  close_count: number;
  open_count: number;
  business_count: number;
}

/** 특정 상권 월별 지표 시계열 (최근 n개월) */
export async function zoneMetricSeries(zoneId: string, n = 6): Promise<MetricPoint[]> {
  const db = await getDb();
  const rows = await db.query<MetricPoint>(
    `SELECT period, vacancy_rate, water_usage, foot_traffic, card_sales, close_count, open_count, business_count
     FROM zone_metric WHERE zone_id = $1 ORDER BY period DESC LIMIT $2`,
    [zoneId, n]
  );
  return rows.reverse();
}

/** 특정 상권 최근 폐업 업소 */
export async function recentClosures(zoneId: string, limit = 5): Promise<{ name: string; category_name: string; close_date: string }[]> {
  const db = await getDb();
  return db.query(
    `SELECT name, category_name, to_char(close_date,'YYYY-MM') AS close_date
     FROM business
     WHERE zone_id = $1 AND status = '폐업' AND close_date IS NOT NULL
     ORDER BY close_date DESC LIMIT $2`,
    [zoneId, limit]
  );
}
