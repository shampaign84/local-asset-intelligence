/**
 * 실데이터 수집 — 공공 OpenAPI (서비스키 필요, 로그인 불필요)
 *
 * 사용법:
 *   1) data.go.kr 에서 아래 API 활용신청 후 "일반 인증키(Decoding)" 발급
 *      - 소상공인시장진흥공단_상가(상권)정보 API : https://www.data.go.kr/data/15012005/openapi.do
 *   2) 환경변수로 키 지정 후 실행:
 *      DATA_GO_KR_KEY="발급받은디코딩키" npx tsx scripts/fetch-real.ts
 *   3) 결과: data/raw/sangga_mapo.json  (마포구 실제 상가업소)
 *      이후 `DATABASE_URL=... npx tsx scripts/seed-db.ts --real` 로 실데이터 적재
 *
 * 참고(추가 실데이터, 각각 별도 키):
 *   - LocalData 지방행정인허가(개·폐업) : https://www.localdata.go.kr/ (authKey)
 *   - 한국부동산원_부동산통계 조회(공실률/임대료) : https://www.data.go.kr/data/15134761/openapi.do
 *   - 국토부_상업업무용 매매 실거래가 : https://www.data.go.kr/data/15126463/openapi.do
 */
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const KEY = process.env.DATA_GO_KR_KEY;
const SIGUNGU = "11440"; // 마포구
const BASE = "http://apis.data.go.kr/B553077/api/open/sdsc2";

interface Store {
  bizesNm?: string; // 상호명
  indsLclsNm?: string; // 업종 대분류
  indsMclsNm?: string; // 업종 중분류
  ldongAddr?: string; // 지번주소
  rdnmAdr?: string; // 도로명주소
  adongNm?: string; // 행정동
  lon?: string;
  lat?: string;
}

async function main() {
  if (!KEY) {
    console.error("❌ DATA_GO_KR_KEY 환경변수가 없습니다. data.go.kr 에서 상가정보 API 키를 발급받아 지정하세요.");
    console.error('   예) DATA_GO_KR_KEY="...디코딩키..." npx tsx scripts/fetch-real.ts');
    process.exit(1);
  }
  const all: Store[] = [];
  const numOfRows = 1000;
  for (let page = 1; page <= 50; page++) {
    const url =
      `${BASE}/storeListInArea?serviceKey=${encodeURIComponent(KEY)}` +
      `&divId=signguCd&key=${SIGUNGU}&pageNo=${page}&numOfRows=${numOfRows}&type=json`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
    const json = (await res.json()) as {
      body?: { items?: Store[]; totalCount?: number };
      header?: { resultCode?: string; resultMsg?: string };
    };
    const items = json.body?.items ?? [];
    all.push(...items);
    const total = json.body?.totalCount ?? 0;
    console.log(`  page ${page}: +${items.length} (누적 ${all.length} / 전체 ${total})`);
    if (all.length >= total || items.length === 0) break;
  }

  const outDir = path.resolve("data/raw");
  await mkdir(outDir, { recursive: true });
  const out = path.join(outDir, "sangga_mapo.json");
  await writeFile(out, JSON.stringify(all, null, 2), "utf-8");
  console.log(`✅ 마포구 상가업소 ${all.length}건 저장: ${out}`);
}

main().catch((e) => {
  console.error("❌ 수집 실패:", e.message);
  process.exit(1);
});
