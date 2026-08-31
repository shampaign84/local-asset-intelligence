/** 서울 25개 자치구 전체 완전성 검증: 마포구만 범위 내, 나머지 24개는 모두 범위 밖으로 감지되는지 확인 */
import { detectOutOfScopeRegion, resolveZone } from "../src/lib/agent/router";

const SEOUL_25_GU = [
  "종로구", "중구", "용산구", "성동구", "광진구", "동대문구", "중랑구", "성북구", "강북구", "도봉구",
  "노원구", "은평구", "서대문구", "마포구", "양천구", "강서구", "구로구", "금천구", "영등포구", "동작구",
  "관악구", "서초구", "강남구", "송파구", "강동구",
];

console.log(`검증 대상: 서울 ${SEOUL_25_GU.length}개 자치구\n`);
let fail = 0;
for (const gu of SEOUL_25_GU) {
  const q = `${gu} 상권 쇠퇴 위험은?`;
  const oos = detectOutOfScopeRegion(q);
  const isMapo = gu === "마포구";
  const ok = isMapo ? oos === null : oos === gu;
  if (!ok) fail++;
  console.log(`${ok ? "✅" : "❌"} ${gu.padEnd(5)} → detectOutOfScopeRegion=${JSON.stringify(oos)} (기대: ${isMapo ? "null(범위내)" : gu})`);
}

console.log(`\n결과: ${SEOUL_25_GU.length - fail}/${SEOUL_25_GU.length} 통과`);
process.exit(fail ? 1 : 0);
