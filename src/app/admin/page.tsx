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
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div>
            <span className="text-lg font-bold text-indigo-700">관리자 대시보드</span>
            <p className="text-xs text-slate-500">데이터·RAG·예측 모니터링 (기획서 §20)</p>
          </div>
          <Link href="/" className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100">
            ← 챗봇으로
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">
        {err && <div className="rounded-lg bg-rose-50 p-4 text-sm text-rose-700">오류: {err}</div>}
        {!data && !err && <div className="text-sm text-slate-500">불러오는 중…</div>}
        {data && (
          <div className="space-y-6">
            <section className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              <Card label="RAG 청크" value={data.summary.rag_chunks} />
              <Card label="RAG 문서" value={data.summary.rag_documents} />
              <Card label="누적 질의" value={data.summary.questions} />
              <Card label="업소(표본)" value={data.summary.businesses.toLocaleString()} />
              <Card label="평균 신뢰도" value={data.summary.avg_trust ?? "—"} accent />
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-4">
              <h2 className="mb-3 text-sm font-bold text-slate-700">상권 위험도 (예측 엔진)</h2>
              <div className="space-y-2">
                {data.risk.map((r) => (
                  <div key={r.name} className="flex items-center gap-3">
                    <span className="w-40 shrink-0 text-sm text-slate-600">{r.name}</span>
                    <div className="h-3 flex-1 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={`h-full ${r.level === "HIGH" ? "bg-rose-500" : r.level === "MEDIUM" ? "bg-amber-400" : "bg-emerald-500"}`}
                        style={{ width: `${r.score}%` }}
                      />
                    </div>
                    <span className="w-24 shrink-0 text-right text-xs font-semibold text-slate-500">
                      {Math.round(r.score * 10) / 10} · {r.level}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            <section className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <h2 className="mb-3 text-sm font-bold text-slate-700">데이터 소스 모니터</h2>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 text-left text-slate-400">
                      <th className="py-1.5">소스</th>
                      <th className="py-1.5 text-right">레코드</th>
                      <th className="py-1.5 text-right">최신시점</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.sources.map((s, i) => (
                      <tr key={i} className="border-b border-slate-50">
                        <td className="py-1.5 font-mono text-slate-600">{s.source}</td>
                        <td className="py-1.5 text-right">{s.record_count.toLocaleString()}</td>
                        <td className="py-1.5 text-right text-slate-500">{s.last_period ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <h2 className="mb-3 text-sm font-bold text-slate-700">RAG 모니터 (최근 질의)</h2>
                {data.recent.length === 0 ? (
                  <p className="text-xs text-slate-400">아직 질의가 없습니다. 챗봇에서 질문해 보세요.</p>
                ) : (
                  <ul className="space-y-2">
                    {data.recent.map((r) => (
                      <li key={r.answer_id} className="rounded-lg bg-slate-50 px-3 py-2 text-xs">
                        <div className="truncate text-slate-700">{r.question}</div>
                        <div className="mt-1 flex items-center gap-2 text-[10px] text-slate-400">
                          <span className="rounded bg-slate-200 px-1.5 py-0.5 text-slate-600">{r.intent}</span>
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
  );
}

function Card({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div className={`rounded-xl border p-3 ${accent ? "border-indigo-200 bg-indigo-50" : "border-slate-200 bg-white"}`}>
      <div className={`text-xl font-bold ${accent ? "text-indigo-700" : "text-slate-800"}`}>{value}</div>
      <div className="text-[11px] text-slate-500">{label}</div>
    </div>
  );
}
