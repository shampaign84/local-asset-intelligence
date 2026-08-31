/** POST /api/prediction — 기획서 §19 POST /api/v1/prediction (상권 위험도) */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { zoneRiskRanking } from "@/lib/agent/tools/sqlTool";

export const runtime = "nodejs";

const Body = z.object({
  entity_id: z.string().optional(), // zone_id (없으면 전체 랭킹)
});

export async function POST(req: NextRequest) {
  let body: z.infer<typeof Body> = {};
  try {
    body = Body.parse(await req.json());
  } catch {
    /* 빈 바디 허용 → 전체 랭킹 */
  }
  try {
    const ranking = await zoneRiskRanking();
    const data = body.entity_id ? ranking.filter((r) => r.zone_id === body.entity_id) : ranking;
    return NextResponse.json({ horizon: "6M", results: data });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
