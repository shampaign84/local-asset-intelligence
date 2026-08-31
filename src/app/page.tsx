"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ChatResponse, TrustBreakdown, Evidence } from "@/lib/types";

const SAMPLES = [
  "마포구에서 최근 6개월 쇠퇴 위험이 가장 높은 상권과 근거를 설명해줘",
  "홍대·합정 상권의 최근 6개월 수도 사용량 증감률은?",
  "용도변경 불허가 시 이행강제금 규정은?",
  "연남동 상권의 공실률 추이와 폐업 현황 알려줘",
];

interface Msg {
  role: "user" | "assistant";
  text: string;
  data?: ChatResponse;
}

export default function Home() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function send(q: string) {
    const question = q.trim();
    if (!question || loading) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", text: question }]);
    setLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
      const data = (await res.json()) as ChatResponse;
      setMessages((m) => [...m, { role: "assistant", text: data.answer ?? "응답을 받지 못했습니다.", data }]);
    } catch {
      setMessages((m) => [...m, { role: "assistant", text: "⚠️ 요청 처리 중 오류가 발생했습니다." }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen text-slate-800">
      <Header />
      <main className="mx-auto max-w-3xl px-4 pb-40 pt-6">
        {messages.length === 0 && <Welcome onPick={send} />}
        <div className="space-y-5">
          {messages.map((m, i) =>
            m.role === "user" ? <UserBubble key={i} text={m.text} /> : <AssistantBubble key={i} msg={m} />
          )}
          {loading && <Thinking />}
          <div ref={endRef} />
        </div>
      </main>
      <Composer input={input} setInput={setInput} onSend={() => send(input)} loading={loading} />
    </div>
  );
}

function Header() {
  return (
    <header className="sticky top-0 z-10 border-b border-white/20 bg-white/[.01] backdrop-blur-md">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold text-indigo-300 drop-shadow-sm">Local Asset Intelligence</span>
            <span className="rounded bg-indigo-500/30 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-100">MAPO · PROTOTYPE</span>
          </div>
          <p className="text-xs text-slate-100 drop-shadow-sm">지자체 자산가치·상권 예측 On-premise RAG 챗봇</p>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <Badge>🔒 On-premise</Badge>
          <Badge>📑 근거·신뢰도</Badge>
          <Link href="/admin" className="rounded-md border border-white/30 px-2.5 py-1 font-medium text-slate-100 hover:bg-white/10">
            관리자
          </Link>
        </div>
      </div>
    </header>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return <span className="hidden rounded-full bg-white/10 px-2 py-1 font-medium text-slate-200 sm:inline">{children}</span>;
}

function Welcome({ onPick }: { onPick: (q: string) => void }) {
  return (
    <div className="relative mb-6 overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-neutral-900 via-neutral-950 to-black p-6 shadow-xl shadow-black/40 sm:p-8">
      {/* reference image, cropped to the card's own aspect ratio, at 50% opacity */}
      <img
        src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/freepik_Luxury%20real%20estate%20invitation%20template_1-default-ChjdQKa23uFeRt5L726GVSUu5wwRcE.png"
        alt=""
        className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-50"
      />
      {/* dark wash to keep text legible over the image */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-neutral-950/70 via-neutral-950/60 to-black/80" />
      {/* thin grid rule lines, echoing the reference card */}
      <div className="pointer-events-none absolute inset-0 opacity-40">
        <div className="absolute left-6 top-0 h-full w-px bg-white/10" />
        <div className="absolute left-0 top-16 h-px w-full bg-white/10" />
        <div className="absolute left-0 top-1/2 h-px w-full bg-white/10" />
      </div>
      {/* gold accent line */}
      <div className="absolute left-1/2 right-6 top-16 h-px bg-gradient-to-r from-amber-400/80 to-amber-500/40" />
      {/* vertical gold tick */}
      <div className="absolute left-6 top-24 h-16 w-px bg-amber-400/70" />

      <div className="relative">
        <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-400/90">Mapo District</span>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-white sm:text-3xl">무엇을 분석해 드릴까요?</h1>
        <p className="mt-2 max-w-md text-sm leading-relaxed text-neutral-400">
          마포구 상권의 <b className="text-neutral-200">쇠퇴 위험도</b>, <b className="text-neutral-200">공실·폐업 추이</b>,{" "}
          <b className="text-neutral-200">관련 조례</b>를 근거·신뢰도와 함께 답합니다.
        </p>

        <div className="mt-6 grid gap-2 sm:grid-cols-2">
          {SAMPLES.map((s) => (
            <button
              key={s}
              onClick={() => onPick(s)}
              className="rounded-xl border border-white/10 bg-white/[.04] px-3 py-2.5 text-left text-sm text-neutral-200 backdrop-blur-sm transition hover:border-amber-400/50 hover:bg-white/[.08]"
            >
              {s}
            </button>
          ))}
        </div>

        <div className="mt-6 flex items-center justify-between border-t border-white/10 pt-3 text-[10px] font-medium text-neutral-500">
          <span>On-premise RAG · 근거 기반 답변</span>
          <span className="font-mono tracking-wide text-neutral-400">local-asset-intel</span>
        </div>
      </div>
    </div>
  );
}

function UserBubble({ text }: { text: string }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-indigo-600 px-4 py-2.5 text-sm text-white shadow-sm">{text}</div>
    </div>
  );
}

function AssistantBubble({ msg }: { msg: Msg }) {
  const d = msg.data;
  return (
    <div className="flex justify-start">
      <div className="w-full max-w-[92%] rounded-2xl rounded-bl-sm border border-slate-200 bg-white px-4 py-3 shadow-sm">
        {d && (
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <IntentChip intent={d.intent} />
            {d.trust && <TrustBadge trust={d.trust} />}
            {d.abstained && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">근거 부족</span>}
          </div>
        )}
        <article className="prose prose-sm max-w-none prose-headings:mt-3 prose-headings:mb-1 prose-headings:text-slate-800 prose-p:my-1 prose-li:my-0.5 prose-strong:text-slate-900">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.text}</ReactMarkdown>
        </article>
        {d && d.evidence.length > 0 && <EvidenceList evidence={d.evidence} />}
        {d && <Meta d={d} />}
      </div>
    </div>
  );
}

const INTENT_LABEL: Record<string, string> = {
  prediction: "예측",
  document_search: "문서검색",
  structured_data: "정형데이터",
  analytics: "분석",
  asset_valuation: "자산가치",
  mixed: "복합",
};

function IntentChip({ intent }: { intent: string }) {
  return <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">{INTENT_LABEL[intent] ?? intent}</span>;
}

function TrustBadge({ trust }: { trust: TrustBreakdown }) {
  const color =
    trust.level === "HIGH"
      ? "bg-emerald-100 text-emerald-700"
      : trust.level === "MEDIUM"
      ? "bg-sky-100 text-sky-700"
      : trust.level === "LOW"
      ? "bg-amber-100 text-amber-700"
      : "bg-rose-100 text-rose-700";
  const label = { HIGH: "높음", MEDIUM: "보통", LOW: "낮음", INSUFFICIENT: "부족" }[trust.level];
  return (
    <span className={`group relative rounded-full px-2 py-0.5 text-[11px] font-semibold ${color}`}>
      신뢰도 {trust.final.toFixed(2)} · {label}
      <span className="pointer-events-none absolute left-0 top-full z-20 mt-1 hidden w-56 rounded-lg border border-slate-200 bg-white p-2 text-[11px] font-normal text-slate-600 shadow-lg group-hover:block">
        <TrustRow k="출처 신뢰성" v={trust.source_reliability} />
        <TrustRow k="신선도" v={trust.freshness} />
        <TrustRow k="검색 관련도" v={trust.retrieval_relevance} />
        <TrustRow k="숫자 정합성" v={trust.numeric_consistency} />
        <TrustRow k="근거 기반성" v={trust.groundedness} />
        <TrustRow k="모델 신뢰" v={trust.model_confidence} />
      </span>
    </span>
  );
}
function TrustRow({ k, v }: { k: string; v: number }) {
  return (
    <span className="flex items-center justify-between gap-2 py-0.5">
      <span>{k}</span>
      <span className="font-mono">{v.toFixed(2)}</span>
    </span>
  );
}

function EvidenceList({ evidence }: { evidence: Evidence[] }) {
  const [open, setOpen] = useState(false);
  const icon = { sql: "🗄️", document: "📑", prediction: "����������" } as Record<string, string>;
  return (
    <div className="mt-3 border-t border-slate-100 pt-2">
      <button onClick={() => setOpen((o) => !o)} className="text-xs font-semibold text-indigo-600 hover:underline">
        {open ? "▾" : "▸"} 근거·출처 {evidence.length}건
      </button>
      {open && (
        <ul className="mt-2 space-y-1.5">
          {evidence.map((e, i) => (
            <li key={i} className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
              <div className="flex items-center gap-1.5">
                <span>{icon[e.kind] ?? "•"}</span>
                <span className="font-semibold text-slate-700">{e.title}</span>
                <span className="ml-auto rounded bg-slate-200 px-1.5 py-0.5 font-mono text-[10px] text-slate-500">{e.source_system}</span>
              </div>
              {e.snippet && <p className="mt-1 text-slate-500">{e.snippet}</p>}
              {e.data_period && <p className="mt-0.5 text-[10px] text-slate-400">데이터 시점: {e.data_period}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Meta({ d }: { d: ChatResponse }) {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-slate-400">
      <span>도구: {d.tools_used.join(", ") || "—"}</span>
      <span>·</span>
      <span>{d.latency_ms}ms</span>
      <span>·</span>
      <span className="font-mono">{d.answer_id}</span>
    </div>
  );
}

function Thinking() {
  return (
    <div className="flex justify-start">
      <div className="rounded-2xl rounded-bl-sm border border-slate-200 bg-white px-4 py-3 text-sm text-slate-400 shadow-sm">
        <span className="inline-flex gap-1">
          <Dot /> <Dot d="0.15s" /> <Dot d="0.3s" />
        </span>{" "}
        근거 검색 및 분석 중��
      </div>
    </div>
  );
}
function Dot({ d = "0s" }: { d?: string }) {
  return <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: d }} />;
}

function Composer({
  input,
  setInput,
  onSend,
  loading,
}: {
  input: string;
  setInput: (s: string) => void;
  onSend: () => void;
  loading: boolean;
}) {
  return (
    <div className="fixed inset-x-0 bottom-0 border-t border-white/20 bg-white/[.01] backdrop-blur-md">
      <div className="mx-auto max-w-3xl px-4 py-3">
        <div className="flex items-end gap-2 rounded-2xl border border-white/25 bg-black/20 px-3 py-2 shadow-sm backdrop-blur-sm focus-within:border-indigo-300">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onSend();
              }
            }}
            rows={1}
            placeholder="마포구 상권/조례에 대해 질문하세요 (예: 홍대 상권 쇠퇴 위험은?)"
            className="max-h-32 flex-1 resize-none bg-transparent text-sm text-white outline-none placeholder:text-slate-200/70"
          />
          <button
            onClick={onSend}
            disabled={loading || !input.trim()}
            className="rounded-xl bg-indigo-600 px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-40"
          >
            전송
          </button>
        </div>
        <p className="mt-1.5 text-center text-[10px] text-slate-100 drop-shadow-sm">
          LLM은 숫자를 계산하지 않습니다 · 모든 답변에 출처·신뢰도 표시 · 근거 부족 시 답변을 제한합니다
        </p>
      </div>
    </div>
  );
}
