/**
 * 시딩 — 구조화 데이터 + RAG 문서(임베딩) 적재. 멱등(비어있을 때만 실행).
 * PGlite(in-memory) 데모에서는 인스턴스 시작 시, 실제 Postgres 에서는 `npm run seed` 로 1회 실행.
 */
import type { Db } from "../lib/db";
import { embeddingToJson } from "../lib/db";
import { getEmbeddingProvider } from "../lib/embeddings/provider";
import { computeRisk, type MonthlyMetric } from "../lib/prediction/risk";
import { config } from "../lib/config";
import { generateAll } from "./generate";
import { DOCUMENTS } from "./documents";

export async function seedIfEmpty(db: Db): Promise<void> {
  const [{ c }] = await db.query<{ c: number }>(
    "SELECT count(*)::int AS c FROM rag_chunk"
  );
  if (c > 0) return;
  await seed(db);
}

export async function seed(db: Db): Promise<void> {
  const { zones, businesses, metrics } = generateAll();

  // 1) 상권
  await bulk(
    db,
    "commercial_zone",
    ["zone_id", "name", "sigungu", "admin_dong", "lat", "lng"],
    zones.map((z) => [z.zone_id, z.name, config.region.sigungu, z.admin_dong, z.lat, z.lng])
  );

  // 2) 업소 (상가정보+인허가 표본)
  await bulk(
    db,
    "business",
    ["business_id", "name", "category_code", "category_name", "status", "open_date", "close_date", "admin_dong", "zone_id", "lat", "lng", "source_system", "data_period", "lineage_id"],
    businesses.map((b) => [b.business_id, b.name, b.category_code, b.category_name, b.status, b.open_date, b.close_date, b.admin_dong, b.zone_id, b.lat, b.lng, b.source_system, b.data_period, b.lineage_id])
  );

  // 3) 월별 상권 지표
  await bulk(
    db,
    "zone_metric",
    ["zone_id", "period", "vacancy_rate", "rent_index", "foot_traffic", "card_sales", "water_usage", "open_count", "close_count", "business_count", "source_system"],
    metrics.map((m) => [m.zone_id, m.period, m.vacancy_rate, m.rent_index, m.foot_traffic, m.card_sales, m.water_usage, m.open_count, m.close_count, m.business_count, m.source_system])
  );

  // 4) 상권별 위험도 계산 (예측 엔진) — 최신 시점 기준
  const latest = metrics.reduce((mx, m) => (m.period > mx ? m.period : mx), "");
  const riskRows: unknown[][] = [];
  for (const z of zones) {
    const series: MonthlyMetric[] = metrics
      .filter((m) => m.zone_id === z.zone_id)
      .map((m) => ({
        period: m.period,
        vacancy_rate: m.vacancy_rate,
        foot_traffic: m.foot_traffic,
        card_sales: m.card_sales,
        water_usage: m.water_usage,
        open_count: m.open_count,
        close_count: m.close_count,
        business_count: m.business_count,
      }));
    const risk = computeRisk(series);
    riskRows.push([z.zone_id, latest, risk.score, risk.level, risk.horizon, JSON.stringify(risk.drivers), risk.confidence]);
  }
  await bulk(
    db,
    "risk_score",
    ["zone_id", "period", "score", "level", "horizon", "drivers", "confidence"],
    riskRows,
    { jsonbCols: ["drivers"] }
  );

  // 5) RAG 문서 + 청크(임베딩)
  await bulk(
    db,
    "rag_document",
    ["document_id", "title", "source_system", "source_type", "authority", "effective_date", "version", "security_level"],
    DOCUMENTS.map((d) => [d.document_id, d.title, d.source_system, d.source_type, d.authority, d.effective_date, d.version, d.security_level])
  );

  const chunkTexts: string[] = [];
  const chunkMeta: { chunk_id: string; document_id: string; title: string; section: string; content: string }[] = [];
  for (const d of DOCUMENTS) {
    d.sections.forEach((s, i) => {
      const chunk_id = `${d.document_id}-C${String(i + 1).padStart(2, "0")}`;
      // 검색 품질을 위해 문서 제목/조항을 본문에 포함
      const content = `${d.title} ${s.section}\n${s.content}`;
      chunkTexts.push(content);
      chunkMeta.push({ chunk_id, document_id: d.document_id, title: d.title, section: s.section, content });
    });
  }
  const vectors = await getEmbeddingProvider().embed(chunkTexts);
  for (let i = 0; i < chunkMeta.length; i++) {
    const m = chunkMeta[i];
    await db.query(
      `INSERT INTO rag_chunk (chunk_id, document_id, title, section, content, embedding)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [m.chunk_id, m.document_id, m.title, m.section, m.content, embeddingToJson(vectors[i])]
    );
  }
}

/** 다중행 파라미터 INSERT (100행 단위 청크) */
async function bulk(
  db: Db,
  table: string,
  cols: string[],
  rows: unknown[][],
  opts?: { jsonbCols?: string[] }
): Promise<void> {
  if (rows.length === 0) return;
  const jsonb = new Set(opts?.jsonbCols ?? []);
  const batchSize = 100;
  for (let start = 0; start < rows.length; start += batchSize) {
    const batch = rows.slice(start, start + batchSize);
    const params: unknown[] = [];
    const valuesSql: string[] = [];
    let p = 1;
    for (const row of batch) {
      const placeholders = cols.map((col) => {
        const ph = `$${p++}`;
        return jsonb.has(col) ? `${ph}::jsonb` : ph;
      });
      valuesSql.push(`(${placeholders.join(",")})`);
      params.push(...row);
    }
    await db.query(
      `INSERT INTO ${table} (${cols.join(",")}) VALUES ${valuesSql.join(",")}`,
      params
    );
  }
}
