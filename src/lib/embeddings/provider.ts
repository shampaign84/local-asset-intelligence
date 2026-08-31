/**
 * Embedding 어댑터 — 기획서 §24 (외부 API 호출 없이 로컬 실행 가능하도록 Adapter 구조)
 *
 * - local : 결정론적 문자 n-gram 해싱 임베딩 (키·네트워크 불필요, 오프라인)
 * - openai: OpenAI 호환 /embeddings 엔드포인트 (LM Studio, Ollama, vLLM 등 포함)
 */
import { config } from "../config";
import { LocalEmbeddingProvider } from "./local";
import { OpenAIEmbeddingProvider } from "./openai";

export interface EmbeddingProvider {
  name: string;
  dim: number;
  embed(texts: string[]): Promise<number[][]>;
}

let cached: EmbeddingProvider | null = null;

export function getEmbeddingProvider(): EmbeddingProvider {
  if (cached) return cached;
  if (config.embedding.provider === "openai" && config.embedding.apiKey) {
    cached = new OpenAIEmbeddingProvider();
  } else {
    if (config.embedding.provider === "openai") {
      console.warn("[embedding] EMBED_PROVIDER=openai 이나 키가 없어 local 로 폴백합니다.");
    }
    cached = new LocalEmbeddingProvider(config.embedding.localDim);
  }
  return cached;
}

export async function embedOne(text: string): Promise<number[]> {
  const [v] = await getEmbeddingProvider().embed([text]);
  return v;
}
