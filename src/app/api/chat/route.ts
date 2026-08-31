/** POST /api/chat — 기획서 §19 POST /api/v1/chat */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { run } from "@/lib/agent/orchestrator";

export const runtime = "nodejs";
export const maxDuration = 60;

const Body = z.object({
  question: z.string().min(1).max(500),
  region_id: z.string().optional(),
  session_id: z.string().optional(),
});

export async function POST(req: NextRequest) {
  let parsed;
  try {
    parsed = Body.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다. question(1~500자)이 필요합니다." }, { status: 400 });
  }
  try {
    const result = await run(parsed.question);
    return NextResponse.json(result);
  } catch (e) {
    console.error("[/api/chat] 오류:", e);
    return NextResponse.json({ error: "처리 중 오류가 발생했습니다.", detail: (e as Error).message }, { status: 500 });
  }
}
