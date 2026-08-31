# 데이터 소스 & 실데이터 연동 가이드

이 프로토타입(시나리오 A: 마포구 상권 쇠퇴 리스크)은 **키 없이도** 실제 행정 구조에
기반한 생성 데이터로 즉시 동작한다. 아래 절차로 **실제 공개데이터**를 받아 교체할 수 있다.

## 데이터 구분

| 데이터 | 출처 | 수집 방식 | 키 | 현재 상태 |
|---|---|---|---|---|
| 상가업소(업종·좌표) | 소상공인시장진흥공단 [상가정보 API](https://www.data.go.kr/data/15012005/openapi.do) | OpenAPI | 필요 | `fetch-real.ts` 로 실수집 지원 |
| 공실률/임대료 | 한국부동산원 [임대동향](https://www.data.go.kr/data/15069730/fileData.do) | CSV/OpenAPI | 파일: 불필요 | 생성 데이터(교체 가능) |
| 개·폐업 | 행정안전부 [LocalData](https://www.localdata.go.kr/) | CSV/OpenAPI | authKey | 생성 데이터(교체 가능) |
| 실거래가 | 국토부 [상업업무용 매매](https://www.data.go.kr/data/15126463/openapi.do) | OpenAPI | 필요 | 시나리오 B(범위 외) |
| 유동인구·카드매출·수도사용량 | 통신사/카드사/상수도 | 비공개(상용/내부망) | — | **항상 mock** |

> data.go.kr 의 "파일데이터" 다운로드 버튼은 로그인·동적 파일ID가 필요해 자동화가 어렵다.
> 반면 **OpenAPI 는 서비스키만 있으면 서버에서 바로 호출**되므로 자동 수집에 적합하다.

## 실 상가데이터로 교체하기

```bash
# 1) 소상공인 상가정보 API 활용신청 후 "일반 인증키(Decoding)" 발급
# 2) 마포구 실 상가업소 수집 → data/raw/sangga_mapo.json
DATA_GO_KR_KEY="발급키" npm run fetch:real

# 3) 실 Postgres(Neon)에 병합 적재
DATABASE_URL="postgres://..." npm run seed -- --real
```

`raw/` 에는 수집된 원본이 저장되며 git 에는 커밋하지 않는다(.gitignore).
