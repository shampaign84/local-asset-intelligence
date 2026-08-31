/** 공통 타입 정의 */

/** 질의 의도 분류 — 기획서 §11 Query Router */
export type Intent =
  | "document_search" // TYPE_A 조례/규정 등 문서
  | "structured_data" // TYPE_B 정형 데이터 (SQL)
  | "analytics" // TYPE_C 통계/추이
  | "prediction" // TYPE_D 예측 (위험도/세수)
  | "asset_valuation" // TYPE_E 자산가치
  | "mixed"; // TYPE_F 복합

/** 근거(출처) 항목 — 기획서 §13 [출처], §15 Lineage */
export interface Evidence {
  kind: "sql" | "document" | "prediction";
  source_system: string; // 예: WATER_DB, ORDINANCE_DOC
  title: string;
  snippet?: string; // 문서 인용문 또는 데이터 요약
  reference?: string; // 조항 번호, 테이블명 등
  data_period?: string; // 데이터 시점
  collected_at?: string;
  chunk_id?: string;
  document_id?: string;
  score?: number; // 검색 관련도
}

/** 신뢰도 구성 요소 — 기획서 §14.1 */
export interface TrustBreakdown {
  source_reliability: number;
  freshness: number;
  retrieval_relevance: number;
  numeric_consistency: number;
  groundedness: number;
  model_confidence: number;
  final: number;
  level: "HIGH" | "MEDIUM" | "LOW" | "INSUFFICIENT";
}

/** 예측(상권 위험도) 결과 — 기획서 §7.4 */
export interface RiskResult {
  entity_id: string;
  entity_name: string;
  risk_score: number; // 0~100
  risk_level: "LOW" | "MEDIUM" | "HIGH";
  horizon: string; // "6M"
  main_drivers: string[];
  confidence: number;
  features: Record<string, number>;
}

/** 챗봇 최종 응답 — 기획서 §19 POST /api/v1/chat */
export interface ChatResponse {
  answer_id: string;
  question: string;
  intent: Intent;
  answer: string; // 마크다운 (기획서 §13 답변 형식)
  trust: TrustBreakdown;
  evidence: Evidence[];
  forecast?: {
    metric: string;
    horizon: string;
    change_rate?: number;
  };
  tools_used: string[];
  latency_ms: number;
  abstained: boolean; // 근거 부족으로 답변 제한 여부 — 원칙 E
}

/** 툴 실행 로그 — 기획서 §18.3 tool_execution_log */
export interface ToolLog {
  tool: string;
  input: unknown;
  ok: boolean;
  latency_ms: number;
  summary: string;
}
