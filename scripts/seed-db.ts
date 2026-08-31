/**
 * 실 데이터베이스(PostgreSQL/Neon) 시딩 — 배포용
 *
 *   DATABASE_URL="postgres://..." npx tsx scripts/seed-db.ts          # 생성 데이터로 시딩
 *   DATABASE_URL="postgres://..." npx tsx scripts/seed-db.ts --real   # data/raw/sangga_mapo.json(실 상가) 병합
 *
 * PGlite 데모는 시딩이 자동(앱 시작 시)이므로 이 스크립트는 실 Postgres 배포에만 필요하다.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { getDb } from "../src/lib/db";
import { seedIfEmpty } from "../src/data/seed";
import { ZONES, CATEGORIES } from "../src/data/reference";

async function main() {
  const real = process.argv.includes("--real");
  if (!process.env.DATABASE_URL) {
    console.warn("⚠️  DATABASE_URL 이 없어 PGlite(in-memory)에 시딩합니다. 실 배포에는 DATABASE_URL 을 지정하세요.");
  }
  const db = await getDb();
  console.log(`백엔드: ${db.backend}`);
  await seedIfEmpty(db);
  const [{ c }] = await db.query<{ c: number }>("SELECT count(*)::int AS c FROM business");
  console.log(`기본 시딩 완료. business=${c}`);

  if (real) await ingestRealStores(db);

  console.log("✅ 완료");
  process.exit(0);
}

async function ingestRealStores(db: Awaited<ReturnType<typeof getDb>>) {
  const file = path.resolve("data/raw/sangga_mapo.json");
  let raw: Record<string, string>[];
  try {
    raw = JSON.parse(await readFile(file, "utf-8"));
  } catch {
    console.warn(`⚠️  ${file} 없음 — 먼저 scripts/fetch-real.ts 로 실데이터를 받으세요. 실 병합을 건너뜁니다.`);
    return;
  }
  console.log(`실 상가업소 ${raw.length}건 병합 중…`);
  await db.query("DELETE FROM business");

  let i = 0;
  for (const s of raw) {
    const lat = Number(s.lat) || null;
    const lon = Number(s.lon) || null;
    const zone = nearestZone(lat, lon);
    const cat = mapCategory(s.indsLclsNm || s.indsMclsNm || "");
    // 실 API는 영업중 업소만 제공 → 상권 쇠퇴 시나리오를 위해 쇠퇴도 기반으로 일부에 폐업 상태를 합성(라벨 명시)
    const decline = Math.max(0, zone.trend);
    const closed = pseudoRandom(i) < Math.min(0.35, 0.05 * cat.closureBias * (1 + decline * 2.2));
    i++;
    await db.query(
      `INSERT INTO business (business_id,name,category_code,category_name,status,open_date,close_date,admin_dong,zone_id,lat,lng,source_system,data_period,lineage_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
      [
        `REAL-${zone.zone_id}-${i}`,
        s.bizesNm || "(상호미상)",
        cat.code,
        cat.name,
        closed ? "폐업" : "영업",
        null,
        closed ? "2026-05-15" : null,
        s.adongNm || zone.admin_dong,
        zone.zone_id,
        lat,
        lon,
        "sbiz_sangga_REAL(+synth status)",
        "2026-03",
        `LIN-REAL-${i}`,
      ]
    );
  }
  const [{ c }] = await db.query<{ c: number }>("SELECT count(*)::int AS c FROM business");
  console.log(`실데이터 병합 완료. business=${c} (source=sbiz_sangga_REAL)`);
}

function nearestZone(lat: number | null, lng: number | null) {
  if (lat == null || lng == null) return { ...ZONES[0], trend: ZONES[0].vacancyTrend };
  let best = ZONES[0];
  let bestD = Infinity;
  for (const z of ZONES) {
    const d = (z.lat - lat) ** 2 + (z.lng - lng) ** 2;
    if (d < bestD) {
      bestD = d;
      best = z;
    }
  }
  return { ...best, trend: best.vacancyTrend };
}

function mapCategory(nm: string) {
  const s = nm || "";
  if (/음식|한식|식당/.test(s)) return CATEGORIES[0];
  if (/카페|제과|디저트|커피/.test(s)) return CATEGORIES[1];
  if (/주점|호프|유흥/.test(s)) return CATEGORIES[2];
  if (/분식|간이/.test(s)) return CATEGORIES[3];
  if (/의류|패션|잡화/.test(s)) return CATEGORIES[4];
  if (/화장품|미용용품/.test(s)) return CATEGORIES[5];
  if (/미용|네일|이용/.test(s)) return CATEGORIES[6];
  if (/부동산/.test(s)) return CATEGORIES[7];
  if (/학원|교습|교육/.test(s)) return CATEGORIES[8];
  if (/의원|병원|약국|의료/.test(s)) return CATEGORIES[9];
  if (/PC|오락|노래/.test(s)) return CATEGORIES[10];
  return CATEGORIES[11]; // 소매·편의점 기타
}

function pseudoRandom(n: number): number {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

main().catch((e) => {
  console.error("❌ 실패:", e);
  process.exit(1);
});
