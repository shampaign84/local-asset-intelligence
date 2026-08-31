/**
 * OpenAI 호환 임베딩 프로바이더 — 온프레미스 로컬 임베딩 게이트웨이(vLLM/Ollama/LM Studio)
 * 또는 상용 API 모두 동일 인터페이스로 사용.
 */
import { config } from "../config";
import type { EmbeddingProvider } from "./provider";

export class OpenAIEmbeddingProvider implements EmbeddingProvider {
  name = "openai-compatible";
  dim = config.embedding.openaiDim;

  async embed(texts: string[]): Promise<number[][]> {
    const res = await fetch(`${config.embedding.baseUrl}/embeddings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.embedding.apiKey}`,
      },
      body: JSON.stringify({ model: config.embedding.model, input: texts }),
    });
    if (!res.ok) {
      throw new Error(`Embedding API 오류 ${res.status}: ${await res.text()}`);
    }
    const json = (await res.json()) as { data: { embedding: number[] }[] };
    return json.data.map((d) => d.embedding);
  }
}
