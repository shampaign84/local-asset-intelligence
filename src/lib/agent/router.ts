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
