/** GET /api/health — 기획서 §19 GET /api/v1/health */
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getLLM } from "@/lib/llm/provider";
import { getEmbeddingProvider } from "@/lib/embeddings/provider";

export const runtime = "nodejs";

export async function GET() {
  const status: Record<string, unknown> = {};
  try {
    const db = await getDb();
    const [{ docs }] = await db.query<{ docs: number }>("SELECT count(*)::int AS docs FROM rag_chunk");
    const [{ zones }] = await db.query<{ zones: number }>("SELECT count(*)::int AS zones FROM commercial_zone");
    const [{ biz }] = await db.query<{ biz: number }>("SELECT count(*)::int AS biz FROM business");
    status.database = { ok: true, backend: db.backend, rag_chunks: docs, zones, businesses: biz };
  } catch (e) {
    status.database = { ok: false, error: (e as Error).message };
  }
  status.llm = { provider: getLLM().name, kind: getLLM().kind };
  status.embedding = { provider: getEmbeddingProvider().name, dim: getEmbeddingProvider().dim };
  status.ok = (status.database as { ok: boolean }).ok;
  return NextResponse.json(status);
}
