/**
 * 데이터스토어 어댑터 — 기획서 §26 (PostgreSQL + pgvector)
 *
 * - DATABASE_URL 설정 시: 실제 PostgreSQL/Neon/온프레미스 (node-postgres)
 * - 미설정 시: PGlite (WASM, pgvector 내장, in-memory) → 외부 인프라 없이 데모 구동
 *
 * 두 백엔드 모두 동일한 Postgres 문법($1 placeholder, vector 타입)을 사용하므로
 * 애플리케이션 코드는 백엔드를 신경 쓰지 않는다.
 */
import { config, embedDim } from "./config";

export interface Db {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
  exec(sql: string): Promise<void>;
  backend: "pglite" | "postgres";
}

// 서버리스/HMR 재사용을 위해 전역 캐시
const g = globalThis as unknown as { __lai_db?: Promise<Db> };

export function getDb(): Promise<Db> {
  if (!g.__lai_db) g.__lai_db = init();
  return g.__lai_db;
}

async function init(): Promise<Db> {
  const db = config.db.url ? await initPostgres() : await initPglite();
  await createSchema(db);
  void embedDim(); // 임베딩 차원 확정(로컬/호스티드)
  // PGlite(in-memory)는 매 인스턴스 시작 시 시딩. 실제 Postgres는 `npm run seed`로 1회 시딩.
  if (db.backend === "pglite") {
    const { seedIfEmpty } = await import("../data/seed");
    await seedIfEmpty(db);
  }
  return db;
}

async function initPostgres(): Promise<Db> {
  const { Pool } = await import("pg");
  const pool = new Pool({ connectionString: config.db.url, max: 3 });
  return {
    backend: "postgres",
    async query<T>(sql: string, params: unknown[] = []) {
      const res = await pool.query(sql, params as never[]);
      return res.rows as T[];
    },
    async exec(sql: string) {
      await pool.query(sql);
    },
  };
}

async function initPglite(): Promise<Db> {
  const { PGlite } = await import("@electric-sql/pglite");
  const pg = config.db.pgliteDir ? new PGlite(config.db.pgliteDir) : new PGlite();
  await pg.waitReady;
  return {
    backend: "pglite",
    async query<T>(sql: string, params: unknown[] = []) {
      const res = await pg.query<T>(sql, params);
      return res.rows;
    },
    async exec(sql: string) {
      await pg.exec(sql);
    },
  };
}

let schemaDone = false;
async function createSchema(db: Db) {
  if (schemaDone) return;
  await db.exec(`
    CREATE TABLE IF NOT EXISTS commercial_zone (
      zone_id     TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      sigungu     TEXT,
      admin_dong  TEXT,
      lat         DOUBLE PRECISION,
      lng         DOUBLE PRECISION
    );

    CREATE TABLE IF NOT EXISTS business (
      business_id   TEXT PRIMARY KEY,
      name          TEXT,
      category_code TEXT,
      category_name TEXT,
      status        TEXT,              -- 영업 / 휴업 / 폐업
      open_date     DATE,
      close_date    DATE,
      admin_dong    TEXT,
      zone_id       TEXT,
      lat           DOUBLE PRECISION,
      lng           DOUBLE PRECISION,
      source_system TEXT,
      data_period   TEXT,
      lineage_id    TEXT
    );

    CREATE TABLE IF NOT EXISTS zone_metric (
      zone_id        TEXT,
      period         TEXT,             -- 'YYYY-MM'
      vacancy_rate   DOUBLE PRECISION, -- 공실률 % (부동산원)
      rent_index     DOUBLE PRECISION, -- 임대가격지수 (부동산원)
      foot_traffic   INTEGER,          -- 유동인구 (mock)
      card_sales     BIGINT,           -- 카드매출 원 (mock)
      water_usage    DOUBLE PRECISION, -- 수도 사용량 ㎥ (mock 내부데이터)
      open_count     INTEGER,          -- 개업 수 (인허가)
      close_count    INTEGER,          -- 폐업 수 (인허가)
      business_count INTEGER,          -- 영업 업소 수
      source_system  TEXT,
      PRIMARY KEY (zone_id, period)
    );

    CREATE TABLE IF NOT EXISTS risk_score (
      zone_id    TEXT,
      period     TEXT,
      score      DOUBLE PRECISION,
      level      TEXT,
      horizon    TEXT,
      drivers    JSONB,
      confidence DOUBLE PRECISION,
      PRIMARY KEY (zone_id, period)
    );

    CREATE TABLE IF NOT EXISTS rag_document (
      document_id    TEXT PRIMARY KEY,
      title          TEXT,
      source_system  TEXT,
      source_type    TEXT,
      authority      TEXT,
      effective_date DATE,
      version        TEXT,
      security_level TEXT
    );

    CREATE TABLE IF NOT EXISTS rag_chunk (
      chunk_id    TEXT PRIMARY KEY,
      document_id TEXT REFERENCES rag_document(document_id),
      title       TEXT,
      section     TEXT,
      content     TEXT,
      embedding   TEXT   -- JSON 배열(정규화 벡터). 코사인 유사도는 앱 레이어에서 계산(이식성).
    );

    CREATE TABLE IF NOT EXISTS rag_answer (
      answer_id   TEXT PRIMARY KEY,
      question    TEXT,
      intent      TEXT,
      answer      TEXT,
      trust_score DOUBLE PRECISION,
      created_at  TIMESTAMP DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS rag_citation (
      answer_id     TEXT,
      ord           INTEGER,
      kind          TEXT,
      source_system TEXT,
      title         TEXT,
      snippet       TEXT,
      reference     TEXT
    );

    CREATE TABLE IF NOT EXISTS tool_execution_log (
      id         SERIAL PRIMARY KEY,
      answer_id  TEXT,
      tool       TEXT,
      ok         BOOLEAN,
      latency_ms INTEGER,
      summary    TEXT,
      created_at TIMESTAMP DEFAULT now()
    );
  `);
  schemaDone = true;
}

/** number[] → 저장용 JSON 문자열 */
export function embeddingToJson(v: number[]): string {
  return JSON.stringify(v);
}
/** 저장된 문자열 → number[] */
export function embeddingFromJson(s: string): number[] {
  try {
    return JSON.parse(s) as number[];
  } catch {
    return [];
  }
}
