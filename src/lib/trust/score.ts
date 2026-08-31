/**
 * 신뢰도(Trust Score) — 기획서 §14. 이번 프로젝트의 핵심 차별화 요소.
 * 6개 구성요소의 가중 평균으로 산출하고 등급을 매긴다.
 */
import { config } from "../config";
import type { TrustBreakdown } from "../types";

export interface TrustInput {
  sourceReliability: number; // 출처 신뢰성 (0..1)
  freshness: number; // 데이터 신선도 (0..1)
  retrievalRelevance: number; // 검색 관련도 (0..1)
  numericConsistency: number; // 숫자 정합성 (0..1) — 엔진 계산값 사용 시 1
  groundedness: number; // 근거 기반성 (0..1)
  modelConfidence: number; // 모델/예측 신뢰 (0..1)
}

const W = {
  sourceReliability: 0.15,
  freshness: 0.15,
  retrievalRelevance: 0.2,
  numericConsistency: 0.2,
  groundedness: 0.2,
  modelConfidence: 0.1,
};

export function computeTrust(i: TrustInput): TrustBreakdown {
  const c = (x: number) => Math.max(0, Math.min(1, x));
  const final =
    c(i.sourceReliability) * W.sourceReliability +
    c(i.freshness) * W.freshness +
    c(i.retrievalRelevance) * W.retrievalRelevance +
    c(i.numericConsistency) * W.numericConsistency +
    c(i.groundedness) * W.groundedness +
    c(i.modelConfidence) * W.modelConfidence;

  const f = Math.round(final * 100) / 100;
  const level: TrustBreakdown["level"] =
    f >= config.trust.high ? "HIGH" : f >= config.trust.medium ? "MEDIUM" : f >= config.trust.low ? "LOW" : "INSUFFICIENT";

  return {
    source_reliability: round2(i.sourceReliability),
    freshness: round2(i.freshness),
    retrieval_relevance: round2(i.retrievalRelevance),
    numeric_consistency: round2(i.numericConsistency),
    groundedness: round2(i.groundedness),
    model_confidence: round2(i.modelConfidence),
    final: f,
    level,
  };
}

/** 데이터 시점(개월 경과)으로 신선도 점수 산출 */
export function freshnessFromMonths(monthsOld: number): number {
  // 0개월=1.0, 12개월≈0.4, 24개월↓
  return Math.max(0.2, 1 - monthsOld * 0.05);
}

function round2(x: number) {
  return Math.round(Math.max(0, Math.min(1, x)) * 100) / 100;
}
