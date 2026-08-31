/**
 * RAG 문서 코퍼스 — 마포구/서울시 조례·도시계획·소상공인 지원 규정 (프로토타입 샘플)
 *
 * ⚠️ 프로토타입용 대표 조문 샘플이다. 실제 배포 시에는 자치법규정보시스템(ELIS),
 *    도시계획 지침서 원문 등을 scripts/ingest-docs.ts 로 적재하여 대체한다.
 *    (제42조 이행강제금 조문은 README 평가셋 Ground Truth 와 정합되도록 구성)
 */

export interface DocSection {
  section: string;
  content: string;
}
export interface DocSeed {
  document_id: string;
  title: string;
  source_system: string;
  source_type: string; // ordinance | plan | guideline | manual
  authority: string;
  effective_date: string;
  version: string;
  security_level: string; // public | internal
  sections: DocSection[];
}

export const DOCUMENTS: DocSeed[] = [
  {
    document_id: "DOC-ARCH-ORD",
    title: "마포구 건축 조례",
    source_system: "elis",
    source_type: "ordinance",
    authority: "마포구",
    effective_date: "2025-07-01",
    version: "v12",
    security_level: "public",
    sections: [
      {
        section: "제40조(용도변경의 기준)",
        content:
          "건축물의 용도를 변경하려는 자는 건축법 제19조 및 같은 법 시행령 별표1의 용도별 건축물의 종류에 따라 상위군으로의 변경은 허가를, 하위군으로의 변경은 신고를 하여야 한다. 근린생활시설(제1종·제2종) 상호 간의 변경은 원칙적으로 신고 대상으로 하되, 주차·정화조·소방 등 부대시설 기준을 충족하여야 한다.",
      },
      {
        section: "제41조(용도변경 시 검토사항)",
        content:
          "구청장은 용도변경 신청을 받은 경우 해당 필지의 용도지역·지구, 주차장 확보 기준, 정화조 용량, 소방시설, 도로 접도 요건을 종합적으로 검토하여야 한다. 일반음식점으로의 용도변경 시에는 정화조 용량과 급·배기 설비 기준을 우선 확인한다.",
      },
      {
        section: "제42조(이행강제금)",
        content:
          "허가권자는 위반건축물에 대하여 상당한 기간을 정하여 시정명령을 하고, 그 기간까지 시정하지 아니하면 건축법 제80조에 따라 이행강제금을 부과한다. 무단 용도변경 등 위반 사항에 대하여는 해당 부분에 대한 시가표준액의 100분의 10에 해당하는 금액을 이행강제금으로 부과하며, 시정될 때까지 매년 2회 이내의 범위에서 반복 부과할 수 있다.",
      },
    ],
  },
  {
    document_id: "DOC-URBAN-PLAN",
    title: "마포구 도시계획 조례",
    source_system: "elis",
    source_type: "ordinance",
    authority: "마포구",
    effective_date: "2025-01-01",
    version: "v9",
    security_level: "public",
    sections: [
      {
        section: "제30조(용도지역 안에서의 건축제한)",
        content:
          "일반상업지역 안에서는 위락시설 및 공해성 공장을 제외한 대부분의 상업·업무시설 건축이 가능하다. 준주거지역에서는 주거기능을 침해하지 아니하는 범위에서 근린생활시설과 판매시설을 허용하며, 제2종 일반주거지역에서는 제1종 근린생활시설과 일정 규모 이하의 제2종 근린생활시설만 허용한다.",
      },
      {
        section: "제52조(지구단위계획 구역의 관리)",
        content:
          "지구단위계획으로 정한 획지 및 건축물의 용도, 건폐율·용적률, 높이, 공개공지에 관한 사항은 해당 계획이 정하는 바에 따른다. 홍대·합정 일대 관광특구 및 상업지역의 경우 저층부 권장용도(문화·근린생활)를 지정할 수 있다.",
      },
    ],
  },
  {
    document_id: "DOC-COMM-REVITAL",
    title: "마포구 상권 활성화 및 소상공인 지원 조례",
    source_system: "elis",
    source_type: "ordinance",
    authority: "마포구",
    effective_date: "2026-03-01",
    version: "v4",
    security_level: "public",
    sections: [
      {
        section: "제3조(상권 쇠퇴 조기경보)",
        content:
          "구청장은 관내 상권의 공실률, 매출 변동, 개업·폐업 추이, 유동인구 변화 등 지표를 상시 모니터링하여 상권 쇠퇴 징후를 조기에 파악하고, 위험 단계에 따라 필요한 지원 대책을 수립하여야 한다. 공실률이 직전 분기 대비 급등하거나 폐업률이 현저히 상승하는 상권은 우선 관리 대상으로 지정할 수 있다.",
      },
      {
        section: "제7조(임차 소상공인 지원)",
        content:
          "구청장은 상권 쇠퇴 우선관리구역 내 임차 소상공인에 대하여 임대료 안정, 컨설팅, 시설 개선, 홍보·마케팅 등의 지원을 할 수 있으며, 예산의 범위에서 도시재생기금을 우선 배분할 수 있다.",
      },
      {
        section: "제11조(공실 점포 활용)",
        content:
          "구청장은 장기 공실 점포를 임차하여 창업 지원 공간, 공동 판매장, 생활 SOC 등으로 활용하는 사업을 추진할 수 있다. 장기 공실이란 6개월 이상 영업이 이루어지지 아니한 상태를 말한다.",
      },
    ],
  },
  {
    document_id: "DOC-URBAN-REGEN",
    title: "마포구 도시재생 활성화 계획 지침",
    source_system: "urban_plan",
    source_type: "guideline",
    authority: "마포구",
    effective_date: "2025-09-01",
    version: "v2",
    security_level: "internal",
    sections: [
      {
        section: "3.2 대상지 선정 기준",
        content:
          "도시재생 활성화 대상지는 인구·산업의 쇠퇴 지표(공실률 상승, 사업체 감소, 유동인구 감소)를 종합한 쇠퇴도 진단 결과에 따라 선정한다. 3개 이상 지표가 기준치를 초과하는 지역을 쇠퇴지역으로 진단한다.",
      },
      {
        section: "4.1 기금 우선 투입",
        content:
          "상권 쇠퇴 조기경보에서 위험(HIGH) 등급으로 분류된 상권은 도시재생기금 및 소상공인 지원 예산의 우선 투입 대상으로 검토한다. 투입 우선순위는 위험점수, 공실률 증가폭, 폐업률을 기준으로 산정한다.",
      },
    ],
  },
  {
    document_id: "DOC-SIGN-ORD",
    title: "마포구 옥외광고물 조례",
    source_system: "elis",
    source_type: "ordinance",
    authority: "마포구",
    effective_date: "2024-05-01",
    version: "v6",
    security_level: "public",
    sections: [
      {
        section: "제15조(광고물의 표시 방법)",
        content:
          "가로형 간판은 건물 벽면에서 돌출되지 아니하도록 설치하여야 하며, 1개 업소당 표시할 수 있는 간판의 총수량과 면적은 별표에서 정하는 기준을 따른다. 관광특구 및 특정구역에서는 별도의 디자인 가이드라인을 적용할 수 있다.",
      },
    ],
  },
  {
    document_id: "DOC-LOCALTAX",
    title: "지방세 재산세 과세 안내(행정 매뉴얼)",
    source_system: "tax",
    source_type: "manual",
    authority: "마포구",
    effective_date: "2026-06-01",
    version: "v1",
    security_level: "internal",
    sections: [
      {
        section: "재산세 과세표준",
        content:
          "건축물 재산세의 과세표준은 시가표준액에 공정시장가액비율(건축물 70%)을 곱하여 산정한다. 상업용 건축물의 재산세율은 표준세율을 적용하며, 부속 토지는 별도합산 과세대상으로 분류된다.",
      },
      {
        section: "세수 영향 분석 유의사항",
        content:
          "상업용 부동산의 가치 변동은 재산세 과세표준에, 거래량 변동은 취득세 세수에 시차를 두고 반영된다. 따라서 상권 쇠퇴에 따른 세수 영향은 재산세(과세표준)와 취득세(거래량)를 구분하여 추정하여야 한다.",
      },
    ],
  },
];
