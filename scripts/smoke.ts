/* 파이프라인 스모크 테스트: 시드 → 하이브리드 검색 → 오케스트레이터 */
import { getDb } from "../src/lib/db";
import { hybridSearch } from "../src/lib/rag/retriever";
import { run } from "../src/lib/agent/orchestrator";

async function main() {
  console.log("1) DB 초기화 + 시딩 …");
  const db = await getDb();
  const [{ c }] = await db.query<{ c: number }>("SELECT count(*)::int AS c FROM rag_chunk");
  const [{ z }] = await db.query<{ z: number }>("SELECT count(*)::int AS z FROM commercial_zone");
  const [{ b }] = await db.query<{ b: number }>("SELECT count(*)::int AS b FROM business");
  console.log(`   backend=${db.backend} chunks=${c} zones=${z} businesses=${b}`);

  console.log("\n2) 하이브리드 검색: '이행강제금'");
  const hits = await hybridSearch("이행강제금 부과 기준", 3);
  hits.forEach((h) => console.log(`   [${h.relevance}] ${h.title} ${h.section} (v=${h.vscore.toFixed(2)} k=${h.kscore})`));

  const questions = [
    "마포구에서 최근 6개월 쇠퇴 위험이 가장 높은 상권과 근거를 설명해줘",
    "홍대·합정 상권의 최근 6개월 수도 사용량 증감률은?",
    "용도변경 불허가 시 이행강제금 규정은?",
    "연남동 상권의 공실률 추이와 폐업 현황 알려줘",
    "오늘 점심 뭐 먹지?",
  ];
  for (const q of questions) {
    console.log(`\n3) Q: ${q}`);
    const r = await run(q);
    console.log(`   intent=${r.intent} trust=${r.trust.final}(${r.trust.level}) tools=${r.tools_used.join(",")} abstained=${r.abstained} ${r.latency_ms}ms`);
    console.log("   " + r.answer.split("\n").slice(0, 3).join(" ⏎ ").slice(0, 200));
  }

  console.log("\n✅ smoke 완료");
  process.exit(0);
}

main().catch((e) => {
  console.error("❌ 실패:", e);
  process.exit(1);
});
