/** GET /api/evidence/[answer_id] — 기획서 §19 GET /api/v1/evidence/{answer_id} */
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ answer_id: string }> }) {
  const { answer_id } = await params;
  try {
    const db = await getDb();
    const [answer] = await db.query(
      `SELECT answer_id, question, intent, trust_score, created_at FROM rag_answer WHERE answer_id = $1`,
      [answer_id]
    );
    if (!answer) return NextResponse.json({ error: "not found" }, { status: 404 });
    const citations = await db.query(
      `SELECT ord, kind, source_system, title, snippet, reference FROM rag_citation WHERE answer_id = $1 ORDER BY ord`,
      [answer_id]
    );
    const tools = await db.query(
      `SELECT tool, ok, latency_ms, summary FROM tool_execution_log WHERE answer_id = $1 ORDER BY id`,
      [answer_id]
    );
    return NextResponse.json({ answer, citations, tools });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
