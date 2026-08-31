/**
 * 로컬 결정론적 임베딩 — 문자 n-gram + 토큰 해싱 (feature hashing)
 *
 * 한국어는 문자 단위 bigram/trigram 이 형태소적 유사성을 잘 포착하므로,
 * 키·네트워크 없이도 어휘적으로 유사한 문장 간 높은 코사인 유사도를 얻는다.
 * 하이브리드 검색에서 키워드(BM25/FTS)와 결합되어 검색 품질을 보완한다.
 */
import type { EmbeddingProvider } from "./provider";

export class LocalEmbeddingProvider implements EmbeddingProvider {
  name = "local-hash";
  dim: number;
  constructor(dim: number) {
    this.dim = dim;
  }

  async embed(texts: string[]): Promise<number[][]> {
    return texts.map((t) => this.embedText(t));
  }

  private embedText(text: string): number[] {
    const v = new Float64Array(this.dim);
    const norm = text.toLowerCase().replace(/\s+/g, " ").trim();
    const features: string[] = [];

    // 공백 토큰 (가중치 ↑)
    for (const tok of norm.split(" ")) {
      if (tok) {
        features.push("w:" + tok);
        features.push("w:" + tok); // 토큰은 2배 가중
      }
    }
    // 문자 bigram / trigram (공백 제거 후)
    const chars = norm.replace(/ /g, "");
    for (let i = 0; i < chars.length - 1; i++) features.push("b:" + chars.slice(i, i + 2));
    for (let i = 0; i < chars.length - 2; i++) features.push("t:" + chars.slice(i, i + 3));

    for (const f of features) {
      const h = hash32(f);
      const idx = h % this.dim;
      const sign = (hash32("s" + f) & 1) === 0 ? 1 : -1; // 부호 해싱으로 충돌 완화
      v[idx] += sign;
    }

    // L2 정규화 (코사인 유사도용)
    let mag = 0;
    for (let i = 0; i < this.dim; i++) mag += v[i] * v[i];
    mag = Math.sqrt(mag) || 1;
    const out = new Array(this.dim);
    for (let i = 0; i < this.dim; i++) out[i] = v[i] / mag;
    return out;
  }
}

/** FNV-1a 32bit 해시 */
function hash32(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
