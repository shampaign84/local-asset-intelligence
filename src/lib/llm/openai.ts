/**
 * OpenAI 호환 LLM 프로바이더 — 온프레미스 로컬 LLM 게이트웨이(vLLM/Ollama/LM Studio)
 * 또는 상용 API. 기획서 §23 "예상 운영 구조: App → LLM Gateway → OpenAI-compatible API → Local LLM".
 */
import { config } from "../config";
import type { ChatMessage, LLMProvider } from "./provider";

export class OpenAICompatibleProvider implements LLMProvider {
  kind = "openai" as const;
  name = `openai:${config.llm.model}`;

  async chat(messages: ChatMessage[], opts?: { temperature?: number }): Promise<string> {
    const res = await fetch(`${config.llm.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.llm.apiKey}`,
      },
      body: JSON.stringify({
        model: config.llm.model,
        temperature: opts?.temperature ?? config.llm.temperature,
        messages,
      }),
    });
    if (!res.ok) {
      throw new Error(`LLM API 오류 ${res.status}: ${await res.text()}`);
    }
    const json = (await res.json()) as {
      choices: { message: { content: string } }[];
    };
    return json.choices[0]?.message?.content ?? "";
  }
}
