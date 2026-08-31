/**
 * 마포구 참조 데이터 (실제 행정 구조 기반)
 *
 * - 행정동/상권/업종 분류는 실제 마포구 및 소상공인·부동산원 체계를 따른다.
 * - 수치 데이터는 프로토타입용으로 생성(seeded)하되, 부동산원 공실률·인허가 개폐업 등
 *   실제 CSV가 data/raw 에 있으면 scripts/seed-db.ts 가 이를 우선 사용한다.
 */

/** 마포구 행정동 (16개) */
export const ADMIN_DONGS = [
  "공덕동", "아현동", "도화동", "용강동", "대흥동", "염리동",
  "신수동", "서강동", "서교동", "합정동", "망원1동", "망원2동",
  "연남동", "성산1동", "성산2동", "상암동",
] as const;

/**
 * 부동산원 상업용부동산 임대동향조사 단위와 대응하는 상권.
 * base/trend 는 시나리오 A(상권쇠퇴) 데모를 위한 초기 조건이며,
 * 실제 부동산원 공실률 CSV 적재 시 대체된다.
 */
export interface ZoneSeed {
  zone_id: string;
  name: string;
  admin_dong: string;
  lat: number;
  lng: number;
  baseVacancy: number; // 24개월 전 공실률 %
  vacancyTrend: number; // 월별 공실률 변화(%p) — 양수면 악화(쇠퇴)
  baseBusiness: number; // 초기 영업 업소 수
}

export const ZONES: ZoneSeed[] = [
  { zone_id: "ZONE-HONGDAE", name: "홍대·합정 상권", admin_dong: "서교동", lat: 37.5563, lng: 126.9236, baseVacancy: 6.2, vacancyTrend: 0.55, baseBusiness: 1200 },
  { zone_id: "ZONE-YEONNAM", name: "연남동 상권", admin_dong: "연남동", lat: 37.5636, lng: 126.9256, baseVacancy: 5.1, vacancyTrend: 0.32, baseBusiness: 640 },
  { zone_id: "ZONE-MANGWON", name: "망원동 상권", admin_dong: "망원1동", lat: 37.5556, lng: 126.9018, baseVacancy: 4.4, vacancyTrend: -0.08, baseBusiness: 520 },
  { zone_id: "ZONE-GONGDEOK", name: "공덕역 상권", admin_dong: "공덕동", lat: 37.5443, lng: 126.9515, baseVacancy: 7.0, vacancyTrend: 0.18, baseBusiness: 480 },
  { zone_id: "ZONE-DMC", name: "상암 DMC 상권", admin_dong: "상암동", lat: 37.5794, lng: 126.8895, baseVacancy: 8.5, vacancyTrend: 0.42, baseBusiness: 360 },
  { zone_id: "ZONE-EWHA", name: "대흥·이대 상권", admin_dong: "대흥동", lat: 37.5566, lng: 126.9455, baseVacancy: 9.1, vacancyTrend: 0.6, baseBusiness: 300 },
];

/** 업종 분류 (소상공인 상가정보 대분류 근사) + 폐업 민감도 weight */
export interface CategorySeed {
  code: string;
  name: string;
  weight: number; // 업소 구성 비중
  closureBias: number; // 폐업 경향(1 기준)
}

export const CATEGORIES: CategorySeed[] = [
  { code: "Q01", name: "한식음식점", weight: 0.18, closureBias: 1.1 },
  { code: "Q02", name: "카페·디저트", weight: 0.15, closureBias: 1.3 },
  { code: "Q03", name: "주점·유흥", weight: 0.09, closureBias: 1.5 },
  { code: "Q04", name: "분식·간이음식", weight: 0.07, closureBias: 1.2 },
  { code: "D01", name: "의류·패션잡화", weight: 0.08, closureBias: 1.4 },
  { code: "D02", name: "화장품·미용용품", weight: 0.04, closureBias: 1.2 },
  { code: "S01", name: "미용실·네일", weight: 0.08, closureBias: 0.9 },
  { code: "S02", name: "부동산중개", weight: 0.06, closureBias: 0.8 },
  { code: "E01", name: "학원·교습소", weight: 0.05, closureBias: 0.7 },
  { code: "M01", name: "의원·병원", weight: 0.04, closureBias: 0.5 },
  { code: "L01", name: "PC·오락·노래방", weight: 0.05, closureBias: 1.6 },
  { code: "R01", name: "소매·편의점", weight: 0.11, closureBias: 0.9 },
];

export const STATUS = { OPEN: "영업", SUSPENDED: "휴업", CLOSED: "폐업" } as const;
