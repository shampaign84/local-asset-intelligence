# Local Asset Intelligence — 마포구 상권 쇠퇴 예측 On-premise RAG 챗봇

지자체(B2G) 자산가치·상권 예측 및 **On-premise RAG 챗봇** 프로토타입.
서울 **마포구**를 대상으로, 상권의 **쇠퇴 위험도·공실/폐업 추이·관련 조례**를
**근거(citation)와 신뢰도(Trust Score)**와 함께 답한다.

> 개발 핵심 키워드: **RAG · 신뢰도 · 보안**
> 이 프로토타입은 첨부 기획서의 6대 원칙(§1.3)을 코드로 구현한 시나리오 A(상권 쇠퇴) 집중 버전이다.

## ✨ 핵심 특징 (기획서 원칙 매핑)

| 기획서 원칙 | 구현 |
|---|---|
| **A. LLM은 계산 엔진이 아니다** | 위험점수·증감률은 `src/lib/prediction`·SQL 엔진이 계산. LLM은 서술만. |
| **B. RAG ↔ Prediction 분리** | `rag/`(근거) 와 `prediction/`(수치)를 분리, orchestrator가 결합. |
| **C. 원천/AI결과 구분, 메타데이터** | 모든 근거에 `source_system`·`data_period`·lineage 표기. |
| **D. 온프레미스 우선** | LLM/Embedding 어댑터 — 기본 로컬/Mock, 내부 데이터 외부전송 없음. |
| **E. 근거 없으면 답하지 않음** | 검색 근거 부족 시 답변 거부(abstention). |
| **보안** | SQL 가드(SELECT-only·allowlist), 프롬프트 인젝션 무력화, audit 로그. |

## 🏗️ 아키텍처

```
Next.js (App Router, TypeScript)  ──►  Vercel 배포
  │
  ├─ /api/chat   → Query Router → [SQL Tool · Prediction Tool · Vector Tool]
  │                              → Evidence Merge → (LLM 서술) → Trust Check → Answer
  ├─ /api/prediction · /api/evidence · /api/health · /api/admin
  │
  └─ 데이터스토어 어댑터
       ├─ 기본: PGlite (WASM Postgres, 외부 인프라 불필요)  ← 데모
       └─ DATABASE_URL 지정 시: PostgreSQL / Neon           ← 실 배포/온프레미스
```

- **하이브리드 검색**: 임베딩 코사인 + 키워드(ILIKE) → RRF 융합 (기획서 §10)
- **LLM/Embedding 어댑터**: `mock`(기본) ↔ OpenAI 호환 게이트웨이(로컬 LLM 우선, 기획서 §23·24)
- **Trust Score**: 6개 구성요소 가중평균 + 등급(HIGH/MEDIUM/LOW/INSUFFICIENT) (기획서 §14)

## 🚀 실행

> ⚠️ **PGlite(WASM)는 Next.js `dev` 모드에서 초기화되지 않는다.** 로컬 실행은 프로덕션 빌드로:

```bash
npm install
npm run demo        # = next build && next start  → http://localhost:3000
```

파이프라인만 빠르게 확인:

```bash
npm run smoke       # 시딩→검색→오케스트레이터 콘솔 테스트
```

### 데모 질문 (시나리오 A)
- 마포구에서 최근 6개월 쇠퇴 위험이 가장 높은 상권과 근거를 설명해줘
- 홍대·합정 상권의 최근 6개월 수도 사용량 증감률은?
- 용도변경 불허가 시 이행강제금 규정은?
- 연남동 상권의 공실률 추이와 폐업 현황 알려줘

관리자 대시보드: `/admin` (데이터·RAG·예측 모니터, 기획서 §20)

## 📊 데이터

- **실제 공개데이터 연동 가능** — 소상공인 상가정보 OpenAPI 등. 절차는 [`data/README.md`](data/README.md).
- 기본 데모는 마포구 실제 **행정동·부동산원 상권·업종 분류**에 기반한 생성 데이터.
- 유동인구·카드매출·수도사용량은 무료 공개 API가 없어 **mock**(답변에 명시).

## ☁️ Vercel 배포

1. 이 저장소를 GitHub 에 푸시
2. [Vercel](https://vercel.com/new) 에서 Import → Framework: Next.js (자동 감지)
3. 환경변수: **없어도 동작**(PGlite in-memory). 데이터 영속화가 필요하면 Neon 등
   `DATABASE_URL` 설정 후 `npm run seed` 로 1회 시딩.
4. Deploy

> PGlite in-memory 는 서버리스 콜드스타트마다 재시딩된다(소규모라 수백 ms). 다중 인스턴스
> 간 상태 공유·영속화가 필요하면 Neon(`DATABASE_URL`) 사용을 권장.

## 🔐 환경변수

[`.env.example`](.env.example) 참조. 전부 선택이며 기본값은 로컬/Mock 동작이다.
`LLM_API_KEY` 를 넣으면 답변 서술이 실제 LLM 으로, `EMBED_API_KEY` 를 넣으면 임베딩이
호스티드로 전환된다(내부 데이터는 온프레미스 게이트웨이로 라우팅 권장).

## 🗂️ 구조

```
src/
├─ app/                # 챗봇 UI · 관리자 · API 라우트
├─ lib/
│  ├─ agent/           # router, orchestrator, tools(sql/vector/prediction/evidence)
│  ├─ rag/             # 하이브리드 검색
│  ├─ prediction/      # 상권 위험도 엔진(결정론적)
│  ├─ trust/           # Trust Score
│  ├─ llm/ · embeddings/  # 어댑터(Mock/Local ↔ OpenAI 호환)
│  └─ db.ts            # PGlite ↔ PostgreSQL 어댑터
└─ data/               # 참조데이터·문서코퍼스·생성기·시더
scripts/               # smoke · seed-db · fetch-real
```

## ⚖️ 유의

행정 의사결정 **지원**용 프로토타입이다. 자산가치 추정치는 AVM 성격이며 **법정 감정평가를
대체하지 않는다**. 유동인구·카드·수도 등 일부 지표는 mock 이다.
