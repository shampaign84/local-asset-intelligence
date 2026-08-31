/**
 * Query Router — 기획서 §11. 질문을 유형(intent)으로 분류하고 대상 상권을 해석한다.
 * 규칙 기반(결정론적)으로 동작하여 LLM 없이도 라우팅이 가능하다.
 */
import type { Intent } from "../types";
import { ZONES } from "../../data/reference";

const ZONE_KEYWORDS: { re: RegExp; zone_id: string }[] = [
  { re: /(홍대|합정)/, zone_id: "ZONE-HONGDAE" },
  { re: /(연남)/, zone_id: "ZONE-YEONNAM" },
  { re: /(망원)/, zone_id: "ZONE-MANGWON" },
  { re: /(공덕)/, zone_id: "ZONE-GONGDEOK" },
  { re: /(상암|DMC|dmc)/, zone_id: "ZONE-DMC" },
  { re: /(이대|이화|대흥)/, zone_id: "ZONE-EWHA" },
];

export function resolveZone(text: string): string | null {
  for (const z of ZONE_KEYWORDS) if (z.re.test(text)) return z.zone_id;
  return null;
}

export function zoneName(zoneId: string): string {
  return ZONES.find((z) => z.zone_id === zoneId)?.name ?? zoneId;
}

/**
 * 마포구 외 지역명 감지 (범위 밖 질문 안내용).
 *
 * ⚠️ 일반 정규식("OO구/OO시" 패턴)은 쓰지 않는다 — "유동인구"("~인구"),
 * "위험도"("~험도") 같은 도메인 용어 자체가 오탐지되기 때문이다.
 * 대신 실제 지역명 화이트리스트로만 명시적 매칭한다(오탐 최소화).
 */
/** 서울특별시 25개 자치구 전체(대상 마포구 포함) — "24개"류 매직넘버 재발 방지를 위해 전체 목록에서 파생시킨다. */
const SEOUL_25_GU = [
  "종로구", "중구", "용산구", "성동구", "광진구", "동대문구", "중랑구", "성북구", "강북구", "도봉구",
  "노원구", "은평구", "서대문구", "마포구", "양천구", "강서구", "구로구", "금천구", "영등포구", "동작구",
  "관악구", "서초구", "강남구", "송파구", "강동구",
];
if (SEOUL_25_GU.length !== 25) {
  throw new Error(`SEOUL_25_GU 개수가 25가 아닙니다(${SEOUL_25_GU.length}). 자치구 목록을 재확인하세요.`);
}
const OTHER_SEOUL_GU = SEOUL_25_GU.filter((g) => g !== "마포구"); // 24개 = 서울 25개 자치구 - 마포구(범위 내)

const OTHER_MAJOR_REGIONS = [
  "부산", "대구", "인천", "광주", "대전", "울산", "세종",
  "경기도", "강원도", "충청북도", "충청남도", "전라북도", "전라남도",
  "경상북도", "경상남도", "제주도", "제주특별자치도",
  "수원", "성남", "고양", "용인", "부천", "안산", "안양", "화성", "평택",
];
const OUT_OF_SCOPE_REGIONS = [...OTHER_SEOUL_GU, ...OTHER_MAJOR_REGIONS];

export function detectOutOfScopeRegion(text: string): string | null {
  for (const r of OUT_OF_SCOPE_REGIONS) {
    if (text.includes(r)) return r;
  }
  return null;
}

const RULES: { intent: Intent; re: RegExp }[] = [
  { intent: "prediction", re: /(예측|전망|향후|앞으로|리스크|위험|쇠퇴|공실\s*가능|경보|몇\s*개월|개월\s*뒤|미래)/ },
  { intent: "asset_valuation", re: /(추정가|자산\s*가치|감정|가치평가|시세)/ },
  { intent: "document_search", re: /(조례|규정|기준|법령|조항|용도변경|이행강제금|허가|신고|지침|근거\s*규정)/ },
  { intent: "structured_data", re: /(수도\s*사용량|공실률|매출|유동인구|폐업|개업|업소\s*수|얼마|사용량|증감|추이|건수)/ },
];

export function classifyIntent(text: string): Intent {
  const hits = RULES.filter((r) => r.re.test(text)).map((r) => r.intent);
  const uniq = Array.from(new Set(hits));
  if (uniq.length === 0) return "document_search";
  // 문서 + (예측/정형)이 함께 잡히면 복합
  const hasDoc = uniq.includes("document_search");
  const hasQuant = uniq.some((i) => i === "prediction" || i === "structured_data" || i === "asset_valuation");
  if (hasDoc && hasQuant) return "mixed";
  return uniq[0];
}
