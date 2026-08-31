/**
 * 하이브리드 검색 — 기획서 §10 (Vector + Keyword) + RRF 융합
 *
 * - Vector: 임베딩 코사인 유사도(앱 레이어 계산). 저장은 SQL(rag_chunk.embedding, JSON).
 *   소규모 코퍼스에 최적이며 모든 백엔드(PGlite/Postgres/Neon)에서 동일 동작.
 *   대규모 확장 시 Neon + pgvector 의 `<=>` 연산으로 손쉽게 교체 가능(임베딩 데이터 그대로 사용).
 * - Keyword: 본문 ILIKE 부분일치 (한국어 조사 결합 토큰 문제 회피)
 * - 두 결과를 Reciprocal Rank Fusion 으로 결합 (Reranker 대체 경량 구현)
 */
import { getDb, embeddingFromJson } from "../db";
import { embedOne } from "../embeddings/provider";

export interface RetrievedChunk {
  chunk_id: string;
  document_id: string;
  title: string;
  section: string;
  content: string;
  vscore: number; // 코사인 유사도 0..1
  kscore: number; // 키워드 매칭 수
  relevance: number; // 융합 후 정규화 0..1
}

interface ChunkRow {
  chunk_id: string;
  document_id: string;
  title: string;
  section: string;
  content: string;
  embedding: string;
}

export async function hybridSearch(query: string, topK = 4): Promise<RetrievedChunk[]> {
  const db = await getDb();
  const qvec = await embedOne(query);

  // 1) 벡터 검색 (앱 레이어 코사인) — 전체 청크 로드 후 상위 정렬
  const all = await db.query<ChunkRow>(
    "SELECT chunk_id, document_id, title, section, content, embedding FROM rag_chunk"
  );
  const vec = all
    .map((r) => ({
      ...r,
      vscore: cosine(qvec, embeddingFromJson(r.embedding)),
    }))
    .sort((a, b) => b.vscore - a.vscore)
    .slice(0, 10);

  // 2) 키워드(ILIKE) 검색
  const terms = tokenize(query);
  let kw: (ChunkRow & { kscore: number })[] = [];
  if (terms.length) {
    const conds = terms.map((_, i) => `(CASE WHEN content ILIKE $${i + 1} THEN 1 ELSE 0 END)`);
    const params = terms.map((t) => `%${t}%`);
    kw = await db.query<ChunkRow & { kscore: number }>(
      `SELECT chunk_id, document_id, title, section, content, embedding,
              (${conds.join(" + ")}) AS kscore
       FROM rag_chunk
       WHERE ${terms.map((_, i) => `content ILIKE $${i + 1}`).join(" OR ")}
       ORDER BY kscore DESC
       LIMIT 10`,
      params
    );
  }

  // 3) RRF 융합
  const K = 60;
  const acc = new Map<string, RetrievedChunk & { rrf: number }>();
  const ensure = (r: ChunkRow) => {
    let cur = acc.get(r.chunk_id);
    if (!cur) {
      cur = {
        chunk_id: r.chunk_id,
        document_id: r.document_id,
        title: r.title,
        section: r.section,
        content: r.content,
        vscore: 0,
        kscore: 0,
        relevance: 0,
        rrf: 0,
      };
      acc.set(r.chunk_id, cur);
    }
    return cur;
  };
  vec.forEach((r, rank) => {
    const cur = ensure(r);
    cur.rrf += 1 / (K + rank + 1);
    cur.vscore = r.vscore;
  });
  kw.forEach((r, rank) => {
    const cur = ensure(r);
    cur.rrf += 1 / (K + rank + 1);
    cur.kscore = Number(r.kscore) || 0;
  });

  const fused = [...acc.values()].sort((a, b) => b.rrf - a.rrf).slice(0, topK);
  const maxRrf = fused[0]?.rrf || 1;
  for (const f of fused) f.relevance = Math.round((f.rrf / maxRrf) * 1000) / 1000;
  return fused;
}

function cosine(a: number[], b: number[]): number {
  if (!a.length || a.length !== b.length) return 0;
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  // 임베딩은 L2 정규화되어 있으므로 내적 = 코사인
  return dot;
}

function tokenize(q: string): string[] {
  return Array.from(
    new Set(
      q
        .replace(/[^\p{L}\p{N}\s]/gu, " ")
        .split(/\s+/)
        .map((t) => t.trim())
        .filter((t) => t.length >= 2)
    )
  ).slice(0, 8);
}
