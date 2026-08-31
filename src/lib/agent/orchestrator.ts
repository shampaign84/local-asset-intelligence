/**
 * 오케스트레이터 — 기획서 §31 시나리오 A 파이프라인.
 * Query Router → SQL/Prediction/Vector Tool → Evidence Merge → (LLM 서술) → Trust Check → Answer.
 *
 * 원칙 준수: 숫자는 SQL/예측 엔진이 계산(원칙 A), 모든 답변에 출처·신뢰도(원칙 C/E),
 *           근거 부족 시 답변 거부(원칙 E), tool 호출 audit 기록(§18.3).
 */
import { getDb } from "../db";
import { getLLM } from "../llm/provider";
import { hybridSearch, type RetrievedChunk } from "../rag/retriever";
import * as sql from "./tools/sqlTool";
import { computeTrust, freshnessFromMonths, type TrustInput } from "../trust/score";
import { classifyIntent, resolveZone, zoneName } from "./router";
import type { ChatResponse, Evidence, Intent, ToolLog } from "../types";

const LATEST_DATA_PERIOD = "2026-08"; // 시딩 최신 시점 (현재일 2026-08-31 기준 신선도 ≈ 1.0)

export async function run(question: string): Promise<ChatResponse> {
  const t0 = Date.now();
  const intent = classifyIntent(question);
  const zone = resolveZone(question);
  const logs: ToolLog[] = [];

  let result: BranchResult;
  if (intent === "asset_valuation") {
    result = branchValuation();
  } else if (intent === "document_search") {
    result = await branchDocument(question, logs);
  } else if (intent === "structured_data" || intent === "analytics") {
    result = await branchStructured(question, zone, logs);
  } else {
    // prediction | mixed → 시나리오 A
    result = await branchPrediction(question, zone, logs);
  }

  // LLM 서술(선택) — 숫자/인용은 그대로 유지, 자연스러운 문장만 재작성
  const answer = await narrate(question, result.draft, result.abstained);

  const trust = computeTrust(result.trust);
  const answer_id = `ANS-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${String(Math.floor(Math.random() * 100000)).padStart(5, "0")}`;
  const latency_ms = Date.now() - t0;

  await persist(answer_id, question, intent, answer, trust.final, result.evidence, logs);

  return {
    answer_id,
    question,
    intent,
    answer,
    trust,
    evidence: result.evidence,
    forecast: result.forecast,
    tools_used: result.toolsUsed,
    latency_ms,
    abstained: result.abstained,
  };
}

interface BranchResult {
  draft: string;
  evidence: Evidence[];
  trust: TrustInput;
  toolsUsed: string[];
  forecast?: ChatResponse["forecast"];
  abstained: boolean;
}

// ---------------- 시나리오 A: 상권 쇠퇴 예측 ----------------
async function branchPrediction(question: string, zone: string | null, logs: ToolLog[]): Promise<BranchResult> {
  const ranking = await timed(logs, "sql:zoneRiskRanking", () => sql.zoneRiskRanking());
  if (ranking.length === 0) return insufficient();
  const target = (zone && ranking.find((r) => r.zone_id === zone)) || ranking[0];

  const series = await timed(logs, "sql:zoneMetricSeries", () => sql.zoneMetricSeries(target.zone_id, 6));
  const closures = await timed(logs, "sql:recentClosures", () => sql.recentClosures(target.zone_id, 4));
  const docs = await timed(logs, "vector:hybridSearch", () =>
    hybridSearch("상권 쇠퇴 조기경보 우선관리 도시재생 소상공인 지원 조례", 3)
  );

  const first = series[0];
  const last = series[series.length - 1];
  const vacDelta = round1(last.vacancy_rate - first.vacancy_rate);
  const waterCh = pct(last.water_usage, first.water_usage);
  const footCh = pct(last.foot_traffic, first.foot_traffic);
  const cardCh = pct(last.card_sales, first.card_sales);
  const closeSum = series.reduce((s, m) => s + m.close_count, 0);
  const drivers = asDrivers(target.drivers);

  const evidence: Evidence[] = [
    {
      kind: "prediction",
      source_system: "PREDICTION_ENGINE",
      title: `${target.name} 상권 위험도`,
      snippet: `위험점수 ${round1(target.score)}/100 · 등급 ${target.level} · 6개월`,
      reference: "risk_score",
      data_period: LATEST_DATA_PERIOD,
    },
    {
      kind: "sql",
      source_system: "zone_metric (부동산원+인허가+mock)",
      title: `${target.name} 월별 지표`,
      snippet: `공실률 ${first.vacancy_rate}%→${last.vacancy_rate}% · 수도 ${fmtPct(waterCh)} · 폐업 ${closeSum}건`,
      reference: "zone_metric",
      data_period: `${first.period}~${last.period}`,
    },
    ...docs.map((d) => docEvidence(d)),
  ];

  const draft = [
    `## 결론`,
    `**${target.name}**의 최근 6개월 상권 쇠퇴 위험은 **${target.level}** 등급(위험점수 **${round1(target.score)}/100**)입니다.` +
      (zone ? "" : ` 마포구 내 분석 대상 상권 중 위험도가 가장 높습니다.`),
    ``,
    `## 주요 근거`,
    `1. **공실률**: ${first.period} ${first.vacancy_rate}% → ${last.period} ${last.vacancy_rate}% (**${vacDelta >= 0 ? "+" : ""}${vacDelta}%p**)`,
    `2. **폐업**: 최근 6개월 폐업 ${closeSum}건` + (closures.length ? ` (예: ${closures.map((c) => `${c.name}·${c.category_name}(${c.close_date})`).join(", ")})` : ""),
    `3. **유동인구/카드매출**: 유동인구 ${fmtPct(footCh)}, 카드매출 ${fmtPct(cardCh)}`,
    `4. **수도 사용량(공실 선행지표)**: ${fmtPct(waterCh)}`,
    ``,
    `### 위험요인 기여도(예측 엔진)`,
    ...drivers.map((d) => `- ${d.label}: ${d.value}`),
    ``,
    `## 관련 규정·근거`,
    ...docs.slice(0, 2).map((d) => `- **${d.title} ${d.section}** — "${trim(d.content, 90)}"`),
    ``,
    `## 주의`,
    `본 결과는 내부 행정자료와 모델 분석 기반의 **의사결정 지원** 결과이며, 유동인구·카드매출·수도사용량은 프로토타입 mock 데이터입니다.`,
  ].join("\n");

  const trust: TrustInput = {
    sourceReliability: 0.9,
    freshness: freshnessFromMonths(0),
    retrievalRelevance: docs[0]?.relevance ?? 0.7,
    numericConsistency: 1,
    groundedness: 0.95,
    modelConfidence: 0.8,
  };

  return {
    draft,
    evidence,
    trust,
    toolsUsed: ["sql_tool", "prediction_tool", "vector_search_tool"],
    forecast: { metric: "commercial_risk", horizon: "6M", change_rate: waterCh },
    abstained: false,
  };
}

// ---------------- 문서 검색 ----------------
async function branchDocument(question: string, logs: ToolLog[]): Promise<BranchResult> {
  const docs = await timed(logs, "vector:hybridSearch", () => hybridSearch(question, 4));
  const top = docs[0];
  // 근거 부족 → 답변 거부 (원칙 E)
  if (!top || (top.vscore < 0.28 && top.kscore === 0)) return insufficient();

  const draft = [
    `## 결론`,
    summarizeDoc(top),
    ``,
    `## 근거 조문`,
    ...docs.slice(0, 3).map((d) => `- **${d.title} ${d.section}**\n  > ${trim(d.content, 140)}`),
  ].join("\n");

  const trust: TrustInput = {
    sourceReliability: 0.95,
    freshness: 0.9,
    retrievalRelevance: clamp01(top.vscore + (top.kscore > 0 ? 0.15 : 0)),
    numericConsistency: 1,
    groundedness: 0.96,
    modelConfidence: 0.75,
  };
  return {
    draft,
    evidence: docs.map(docEvidence),
    trust,
    toolsUsed: ["vector_search_tool"],
    abstained: false,
  };
}

// ---------------- 정형 데이터 ----------------
async function branchStructured(question: string, zone: string | null, logs: ToolLog[]): Promise<BranchResult> {
  if (!zone) {
    return {
      draft: `## 확인 필요\n어느 상권(예: 홍대·합정, 연남동, 망원동, 공덕역, 상암 DMC, 대흥·이대)에 대한 질문인지 알려주시면 정확한 수치를 조회하겠습니다.`,
      evidence: [],
      trust: baseInsufficientTrust(),
      toolsUsed: [],
      abstained: true,
    };
  }
  const series = await timed(logs, "sql:zoneMetricSeries", () => sql.zoneMetricSeries(zone, 6));
  if (series.length === 0) return insufficient();
  const first = series[0];
  const last = series[series.length - 1];
  const metric = detectMetric(question);
  const line = metricLine(metric, first, last, series);

  const draft = [
    `## 결론`,
    `${zoneName(zone)}의 ${line.title} 결과입니다.`,
    ``,
    `## 주요 근거`,
    ...line.bullets,
    ``,
    `## 주의`,
    `유동인구·카드매출·수도사용량은 프로토타입 mock 데이터입니다.`,
  ].join("\n");

  return {
    draft,
    evidence: [
      {
        kind: "sql",
        source_system: "zone_metric (부동산원+인허가+mock)",
        title: `${zoneName(zone)} 월별 지표`,
        snippet: line.snippet,
        reference: "zone_metric",
        data_period: `${first.period}~${last.period}`,
      },
    ],
    trust: {
      sourceReliability: 0.9,
      freshness: freshnessFromMonths(0),
      retrievalRelevance: 0.85,
      numericConsistency: 1,
      groundedness: 0.95,
      modelConfidence: 0.8,
    },
    toolsUsed: ["sql_tool"],
    abstained: false,
  };
}

function branchValuation(): BranchResult {
  return {
    draft: [
      `## 안내`,
      `자산가치 추정(AVM, 시나리오 B)은 국토부 실거래가 OpenAPI 키 연동이 필요하여 이번 프로토타입(시나리오 A: 상권 쇠퇴 리스크 + RAG) 범위에는 포함되지 않았습니다.`,
      `대신 특정 상권의 **쇠퇴 위험도**, **공실률/폐업 추이**, **관련 조례**는 지금 바로 조회할 수 있습니다.`,
    ].join("\n"),
    evidence: [],
    trust: baseInsufficientTrust(),
    toolsUsed: [],
    abstained: true,
  };
}

// ---------------- 공통 유틸 ----------------
async function narrate(question: string, draft: string, abstained: boolean): Promise<string> {
  const llm = getLLM();
  if (llm.kind === "mock" || abstained) return draft;
  try {
    const sys =
      "너는 지자체 행정 의사결정 지원 RAG 챗봇이다. 아래 '초안'의 모든 숫자와 인용, 출처, 구조를 절대 바꾸지 말고 " +
      "한국어로 자연스럽게 다듬기만 하라. 새로운 사실이나 숫자를 추가하지 마라. 마크다운 형식을 유지하라.";
    const out = await llm.chat([
      { role: "system", content: sys },
      { role: "user", content: `질문: ${question}\n\n초안:\n${draft}` },
    ]);
    return out?.trim() || draft;
  } catch (e) {
    console.warn("[narrate] LLM 실패, 초안 사용:", (e as Error).message);
    return draft;
  }
}

async function persist(
  answer_id: string,
  question: string,
  intent: Intent,
  answer: string,
  trust: number,
  evidence: Evidence[],
  logs: ToolLog[]
) {
  try {
    const db = await getDb();
    await db.query(
      `INSERT INTO rag_answer (answer_id, question, intent, answer, trust_score) VALUES ($1,$2,$3,$4,$5)`,
      [answer_id, question, intent, answer, trust]
    );
    for (let i = 0; i < evidence.length; i++) {
      const e = evidence[i];
      await db.query(
        `INSERT INTO rag_citation (answer_id, ord, kind, source_system, title, snippet, reference) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [answer_id, i + 1, e.kind, e.source_system, e.title, e.snippet ?? null, e.reference ?? null]
      );
    }
    for (const l of logs) {
      await db.query(
        `INSERT INTO tool_execution_log (answer_id, tool, ok, latency_ms, summary) VALUES ($1,$2,$3,$4,$5)`,
        [answer_id, l.tool, l.ok, l.latency_ms, l.summary]
      );
    }
  } catch (e) {
    console.warn("[persist] 실패:", (e as Error).message);
  }
}

async function timed<T>(logs: ToolLog[], tool: string, fn: () => Promise<T>): Promise<T> {
  const s = Date.now();
  try {
    const r = await fn();
    const n = Array.isArray(r) ? (r as unknown[]).length : 1;
    logs.push({ tool, input: null, ok: true, latency_ms: Date.now() - s, summary: `${n} rows` });
    return r;
  } catch (e) {
    logs.push({ tool, input: null, ok: false, latency_ms: Date.now() - s, summary: (e as Error).message });
    throw e;
  }
}

function insufficient(): BranchResult {
  return {
    draft: `## 확인 가능한 근거가 부족합니다\n요청하신 내용을 뒷받침할 데이터·문서를 찾지 못했습니다. 질문을 더 구체화하거나 대상 상권을 지정해 주세요.`,
    evidence: [],
    trust: baseInsufficientTrust(),
    toolsUsed: [],
    abstained: true,
  };
}
function baseInsufficientTrust(): TrustInput {
  return { sourceReliability: 0.3, freshness: 0.3, retrievalRelevance: 0.2, numericConsistency: 0.3, groundedness: 0.2, modelConfidence: 0.3 };
}

function docEvidence(d: RetrievedChunk): Evidence {
  return {
    kind: "document",
    source_system: "ORDINANCE_DOC",
    title: `${d.title} ${d.section}`,
    snippet: trim(d.content, 120),
    reference: d.section,
    chunk_id: d.chunk_id,
    document_id: d.document_id,
    score: d.relevance,
  };
}

function summarizeDoc(d: RetrievedChunk): string {
  return `**${d.title} ${d.section}** 기준: ${trim(d.content.split("\n").slice(1).join(" ") || d.content, 160)}`;
}

interface DriverItem { label: string; value: string }
function asDrivers(raw: unknown): DriverItem[] {
  try {
    const arr = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (Array.isArray(arr)) return arr.map((d) => ({ label: String(d.label), value: String(d.value) }));
  } catch {}
  return [];
}

function detectMetric(q: string): "water" | "vacancy" | "foot" | "card" | "closure" | "all" {
  if (/수도|사용량/.test(q)) return "water";
  if (/공실/.test(q)) return "vacancy";
  if (/유동인구/.test(q)) return "foot";
  if (/매출/.test(q)) return "card";
  if (/폐업|개업/.test(q)) return "closure";
  return "all";
}

function metricLine(
  metric: ReturnType<typeof detectMetric>,
  first: sql.MetricPoint,
  last: sql.MetricPoint,
  series: sql.MetricPoint[]
): { title: string; bullets: string[]; snippet: string } {
  const closeSum = series.reduce((s, m) => s + m.close_count, 0);
  switch (metric) {
    case "water":
      return {
        title: "최근 6개월 수도 사용량 증감",
        bullets: series.map((m) => `- ${m.period}: ${m.water_usage.toLocaleString()}㎥`).concat(`- 증감률: **${fmtPct(pct(last.water_usage, first.water_usage))}**`),
        snippet: `수도 ${first.water_usage}→${last.water_usage}㎥ (${fmtPct(pct(last.water_usage, first.water_usage))})`,
      };
    case "vacancy":
      return {
        title: "최근 6개월 공실률 추이",
        bullets: series.map((m) => `- ${m.period}: ${m.vacancy_rate}%`).concat(`- 변화: **${round1(last.vacancy_rate - first.vacancy_rate)}%p**`),
        snippet: `공실률 ${first.vacancy_rate}%→${last.vacancy_rate}%`,
      };
    case "foot":
      return { title: "유동인구 증감", bullets: [`- ${first.period}→${last.period}: **${fmtPct(pct(last.foot_traffic, first.foot_traffic))}**`], snippet: `유동인구 ${fmtPct(pct(last.foot_traffic, first.foot_traffic))}` };
    case "card":
      return { title: "카드매출 증감", bullets: [`- ${first.period}→${last.period}: **${fmtPct(pct(last.card_sales, first.card_sales))}**`], snippet: `카드매출 ${fmtPct(pct(last.card_sales, first.card_sales))}` };
    case "closure":
      return { title: "최근 6개월 개·폐업", bullets: [`- 폐업 합계: **${closeSum}건**`, `- 개업 합계: ${series.reduce((s, m) => s + m.open_count, 0)}건`], snippet: `폐업 ${closeSum}건` };
    default:
      return {
        title: "최근 6개월 상권 지표 요약",
        bullets: [
          `- 공실률: ${first.vacancy_rate}% → ${last.vacancy_rate}% (${round1(last.vacancy_rate - first.vacancy_rate)}%p)`,
          `- 수도 사용량: ${fmtPct(pct(last.water_usage, first.water_usage))}`,
          `- 유동인구: ${fmtPct(pct(last.foot_traffic, first.foot_traffic))} · 카드매출: ${fmtPct(pct(last.card_sales, first.card_sales))}`,
          `- 폐업 합계: ${closeSum}건`,
        ],
        snippet: `공실 ${last.vacancy_rate}% · 폐업 ${closeSum}건`,
      };
  }
}

// 숫자 유틸
function pct(now: number, before: number): number {
  return before === 0 ? 0 : (now - before) / before;
}
function fmtPct(x: number): string {
  return `${x >= 0 ? "+" : ""}${(x * 100).toFixed(1)}%`;
}
function round1(x: number): number {
  return Math.round(x * 10) / 10;
}
function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}
function trim(s: string, n: number): string {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > n ? t.slice(0, n) + "…" : t;
}
