/**
 * 중앙 설정 (환경변수 분리 — 기획서 §23 "LLM 교체가 가능하도록 환경변수로 분리")
 *
 * 모든 외부 의존성(LLM, Embedding, DB)은 어댑터 + 환경변수로 교체 가능하다.
 * 기본값은 "키 없이 오프라인 동작"이며, 키를 넣으면 호스티드 백엔드로 전환된다.
 */

export const config = {
  // 대상 지역 (데모)
  region: {
    name: "서울특별시 마포구",
    sido: "서울특별시",
    sigungu: "마포구",
    sigunguCode: "11440", // 마포구 법정동 앞 5자리
  },

  // 데이터스토어: DATABASE_URL 이 있으면 실제 PostgreSQL, 없으면 PGlite(in-memory)
  db: {
    url: process.env.DATABASE_URL || "",
    // PGlite 영속화 경로 (비우면 in-memory). Vercel 서버리스에서는 in-memory 사용.
    pgliteDir: process.env.PGLITE_DIR || "",
  },

  // LLM 어댑터 — 기획서 §23 LLMProvider (Local / OpenAICompatible / Mock)
  llm: {
    provider: (process.env.LLM_PROVIDER || "mock") as "mock" | "openai",
    baseUrl: process.env.LLM_BASE_URL || "https://api.openai.com/v1",
    apiKey: process.env.LLM_API_KEY || "",
    model: process.env.LLM_MODEL || "gpt-4o-mini",
    temperature: Number(process.env.LLM_TEMPERATURE ?? "0.2"),
  },

  // Embedding 어댑터 — 기획서 §24 (Local embedding / hosted)
  embedding: {
    provider: (process.env.EMBED_PROVIDER || "local") as "local" | "openai",
    baseUrl: process.env.EMBED_BASE_URL || "https://api.openai.com/v1",
    apiKey: process.env.EMBED_API_KEY || process.env.LLM_API_KEY || "",
    model: process.env.EMBED_MODEL || "text-embedding-3-small",
    // 로컬(결정론적) 임베딩 차원. 호스티드 사용 시 해당 모델 차원으로 재시딩 필요.
    localDim: 256,
    openaiDim: 1536,
  },

  // 신뢰도 등급 임계값 — 기획서 §14.2
  trust: {
    high: 0.9,
    medium: 0.75,
    low: 0.5,
  },
} as const;

/** 현재 활성 임베딩 차원 */
export function embedDim(): number {
  return config.embedding.provider === "openai"
    ? config.embedding.openaiDim
    : config.embedding.localDim;
}

export type AppConfig = typeof config;
