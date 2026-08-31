"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface AdminData {
  summary: { rag_chunks: number; rag_documents: number; questions: number; businesses: number; avg_trust: number | null };
  sources: { source: string; record_count: number; last_period: string }[];
  risk: { name: string; score: number; level: string }[];
  recent: { answer_id: string; question: string; intent: string; trust_score: number; citations: number }[];
}

export default function Admin() {
  const [data, setData] = useState<AdminData | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin")
      .then((r) => r.json())
      .then((d) => (d.error ? setErr(d.error) : setData(d)))
      .catch((e) => setErr(String(e)));
  }, []);

  return (
    <div className="relative min-h-screen bg-ink-950 text-[#f4f4f2]">
      <div className="pointer-events-none fixed inset-0 bg-grid-lines opacity-60" />
      <div className="relative">
        <header className="border-b border-white/10 bg-ink-950/90 backdrop-blur">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
            <div className="flex items-center gap-2.5">
              <span className="h-4 w-[3px] bg-gold-500" />
              <div>
                <span className="text-lg font-bold tracking-tight text-[#f4f4f2]">관리자 대시보드</span>
                <p className="text-xs text-white/40">데이터·RAG·예측 모니터링 (기획서 §20)</p>
              </div>
            </div>
            <Link
              href="/"
              className="rounded-md border border-gold-500/40 px-2.5 py-1 text-xs font-medium text-gold-400 transition hover:bg-gold-500/10"
            >
              ← 챗봇으로
            </Link>
          </div>
        </header>

        <main className="mx-auto max-w-5xl px-4 py-6">
          {err && (
            <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-400">오류: {err}</div>
          )}
          {!data && !err && <div className="text-sm text-white/40">불러오는 중…</div>}
          {data && (
            <div className="space-y-6">
              <section className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                <Card label="RAG 청크" value={data.summary.rag_chunks} />
                <Card label="RAG 문서" value={data.summary.rag_documents} />
                <Card label="누적 질의" value={data.summary.questions} />
                <Card label="업소(표본)" value={data.summary.businesses.toLocaleString()} />
                <Card label="평균 신뢰도" value={data.summary.avg_trust ?? "—"} accent />
              </section>

              <section className="rounded-xl border border-white/10 bg-ink-900/60 p-4">
                <h2 className="mb-3 text-sm font-bold text-white/80">상권 위험도 (예측 엔진)</h2>
                <div className="space-y-2">
                  {data.risk.map((r) => (
                    <div key={r.name} className="flex items-center gap-3">
                      <span className="w-40 shrink-0 text-sm text-white/60">{r.name}</span>
                      <div className="h-3 flex-1 overflow-hidden rounded-full bg-white/10">
                        <div
                          className={`h-full ${r.level === "HIGH" ? "bg-rose-500" : r.level === "MEDIUM" ? "bg-amber-400" : "bg-emerald-500"}`}
                          style={{ width: `${r.score}%` }}
                        />
                      </div>
                      <span className="w-24 shrink-0 text-right text-xs font-semibold text-white/50">
                        {Math.round(r.score * 10) / 10} · {r.level}
                      </span>
                    </div>
                  ))}
                </div>
              </section>

              <section className="grid gap-6 lg:grid-cols-2">
                <div className="rounded-xl border border-white/10 bg-ink-900/60 p-4">
                  <h2 className="mb-3 text-sm font-bold text-white/80">데이터 소스 모니터</h2>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-white/10 text-left text-white/40">
                        <th className="py-1.5">소스</th>
                        <th className="py-1.5 text-right">레코드</th>
                        <th className="py-1.5 text-right">최신시점</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.sources.map((s, i) => (
                        <tr key={i} className="border-b border-white/5">
                          <td className="py-1.5 font-mono text-gold-400">{s.source}</td>
                          <td className="py-1.5 text-right text-white/70">{s.record_count.toLocaleString()}</td>
                          <td className="py-1.5 text-right text-white/40">{s.last_period ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="rounded-xl border border-white/10 bg-ink-900/60 p-4">
                  <h2 className="mb-3 text-sm font-bold text-white/80">RAG 모니터 (최근 질의)</h2>
                  {data.recent.length === 0 ? (
                    <p className="text-xs text-white/30">아직 질의가 없습니다. 챗봇에서 질문해 보세요.</p>
                  ) : (
                    <ul className="space-y-2">
                      {data.recent.map((r) => (
                        <li key={r.answer_id} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs">
                          <div className="truncate text-white/70">{r.question}</div>
                          <div className="mt-1 flex items-center gap-2 text-[10px] text-white/40">
                            <span className="rounded bg-white/10 px-1.5 py-0.5 text-white/60">{r.intent}</span>
                            <span>신뢰도 {r.trust_score?.toFixed(2)}</span>
                            <span>· 인용 {r.citations}건</span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </section>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function Card({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div className={`rounded-xl border p-3 ${accent ? "border-gold-500/40 bg-gold-500/5" : "border-white/10 bg-ink-900/60"}`}>
      <div className={`text-xl font-bold ${accent ? "text-gold-400" : "text-[#f4f4f2]"}`}>{value}</div>
      <div className="text-[11px] text-white/40">{label}</div>
    </div>
  );
}
