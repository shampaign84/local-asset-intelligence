/**
 * LLM 어댑터 — 기획서 §23 LLMProvider (Local / OpenAICompatible / Mock)
 *
 * 원칙 A: LLM은 계산 엔진이 아니다. 숫자/점수/예측치는 Python/SQL 엔진(여기선 TS 엔진)이 계산하고,
 *         LLM은 "질의 해석 / 결과 설명 / 근거 정리"만 담당한다.
 * 기본값 mock: 키·네트워크 없이 엔진이 만든 근거 기반 초안을 그대로 반환(완전 결정론적, groundedness 보장).
 * openai: OpenAI 호환 게이트웨이(로컬 LLM 우선)로 자연스러운 서술만 재작성.
 */
import { config } from "../config";
import { MockLLMProvider } from "./mock";
import { OpenAICompatibleProvider } from "./openai";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LLMProvider {
  kind: "mock" | "openai";
  name: string;
  chat(messages: ChatMessage[], opts?: { temperature?: number }): Promise<string>;
}

let cached: LLMProvider | null = null;

export function getLLM(): LLMProvider {
  if (cached) return cached;
  if (config.llm.provider === "openai" && config.llm.apiKey) {
    cached = new OpenAICompatibleProvider();
  } else {
    if (config.llm.provider === "openai") {
      console.warn("[llm] LLM_PROVIDER=openai 이나 키가 없어 mock 으로 폴백합니다.");
    }
    cached = new MockLLMProvider();
  }
  return cached;
}
