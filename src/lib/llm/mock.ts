/**
 * Mock LLM — 키/네트워크 없이 동작. 엔진이 만든 근거 기반 초안을 신뢰하므로
 * chat()은 최소한의 결정론적 요약만 반환한다(실제 답변 서술은 orchestrator가 초안을 사용).
 */
import type { ChatMessage, LLMProvider } from "./provider";

export class MockLLMProvider implements LLMProvider {
  kind = "mock" as const;
  name = "mock";

  async chat(messages: ChatMessage[]): Promise<string> {
    const last = [...messages].reverse().find((m) => m.role === "user");
    return last?.content ?? "";
  }
}
