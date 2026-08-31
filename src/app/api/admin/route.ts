/** GET /api/admin — 관리자 대시보드 데이터 (기획서 §20) */
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  try {
    const db = await getDb();
    const [{ chunks }] = await db.query<{ chunks: number }>("SELECT count(*)::int AS chunks FROM rag_chunk");
    const [{ docs }] = await db.query<{ docs: number }>("SELECT count(*)::int AS docs FROM rag_document");
    const [{ questions }] = await db.query<{ questions: number }>("SELECT count(*)::int AS questions FROM rag_answer");
    const [{ avg_trust }] = await db.query<{ avg_trust: number | null }>("SELECT avg(trust_score) AS avg_trust FROM rag_answer");
    const [{ biz }] = await db.query<{ biz: number }>("SELECT count(*)::int AS biz FROM business");

    // 데이터 소스 모니터 (§20 Data Monitor)
    const sources = await db.query(`
      SELECT source_system AS source, count(*)::int AS record_count, max(data_period) AS last_period
      FROM business GROUP BY source_system
      UNION ALL
      SELECT 'zone_metric', count(*)::int, max(period) FROM zone_metric
      UNION ALL
      SELECT 'rag_document', count(*)::int, max(effective_date)::text FROM rag_document
    `);

    // 상권 위험도 (§20 Dashboard)
    const risk = await db.query(`
      SELECT z.name, r.score, r.level FROM risk_score r
      JOIN commercial_zone z ON z.zone_id = r.zone_id
      ORDER BY r.score DESC
    `);

    // RAG 모니터 (§20 RAG Monitor) — 최근 질의
    const recent = await db.query(`
      SELECT a.answer_id, a.question, a.intent, a.trust_score, a.created_at,
             (SELECT count(*)::int FROM rag_citation c WHERE c.answer_id = a.answer_id) AS citations
      FROM rag_answer a ORDER BY a.created_at DESC LIMIT 10
    `);

    return NextResponse.json({
      summary: { rag_chunks: chunks, rag_documents: docs, questions, businesses: biz, avg_trust: avg_trust ? Math.round(avg_trust * 100) / 100 : null },
      sources,
      risk,
      recent,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
