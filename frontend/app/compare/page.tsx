"use client";

import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { api, type Conversation, type ModelAnswer, type SourceChunk } from "@/lib/api";
import { LANGUAGES, useLanguage, type Language } from "@/lib/language";
import Sidebar from "@/components/Sidebar";
import SourceViewer from "@/components/SourceViewer";

const PROVIDER_LABEL: Record<string, string> = {
  ollama: "Ollama (your PC)",
  groq: "Groq (online)",
  gemini: "Gemini (online)",
};

export default function ComparePage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [convosLoading, setConvosLoading] = useState(true);
  const [language, setLanguage] = useLanguage();

  const [question, setQuestion] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [showPrompt, setShowPrompt] = useState(false);
  const [results, setResults] = useState<ModelAnswer[]>([]);
  const [sources, setSources] = useState<SourceChunk[]>([]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openChunkId, setOpenChunkId] = useState<string | null>(null);

  useEffect(() => {
    api
      .listConversations()
      .then(setConversations)
      .finally(() => setConvosLoading(false));
  }, []);

  async function run() {
    if (!question.trim()) return;
    setRunning(true);
    setError(null);
    setResults([]);
    setSources([]);
    try {
      const data = await api.compareModels(question.trim(), language, systemPrompt.trim() || undefined);
      setResults(data.results);
      setSources(data.sources);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Comparison failed.");
    } finally {
      setRunning(false);
    }
  }

  const fastest = results.filter((r) => !r.error).sort((a, b) => a.seconds - b.seconds)[0];

  return (
    <div className="flex h-screen">
      <Sidebar
        conversations={conversations}
        activeId={null}
        loading={convosLoading}
        onSelect={() => {
          window.location.href = "/";
        }}
        onNew={() => {
          window.location.href = "/";
        }}
        onRename={async () => {}}
        onDelete={async () => {}}
      />

      <main className="flex-1 overflow-y-auto bg-surface px-8 py-10">
        <div className="mx-auto max-w-6xl">
          <h2 className="font-serif text-2xl text-parchment">Compare models</h2>
          <p className="mt-1 text-sm text-parchmentDim">
            Ask once, and every model that is set up (Ollama, Groq, Gemini) answers from the same document
            context, side by side. Try different system prompts to see how each one reacts.
          </p>

          <div className="mt-6 rounded-xl border border-line bg-panel/40 p-4">
            <div className="flex flex-wrap items-end gap-3">
              <textarea
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    run();
                  }
                }}
                dir="auto"
                rows={2}
                placeholder="Ask a question about your documents…"
                className="min-w-[16rem] flex-1 resize-y rounded-lg border border-line bg-surface px-3 py-2 text-sm text-parchment outline-none placeholder:text-parchmentDim/70 focus:border-brass"
              />
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value as Language)}
                title="Answer language"
                className="rounded-md border border-line bg-surface px-2 py-2 text-sm text-parchment outline-none focus:border-brass"
              >
                {LANGUAGES.map((l) => (
                  <option key={l.value} value={l.value}>
                    {l.label}
                  </option>
                ))}
              </select>
              <button
                onClick={run}
                disabled={running || !question.trim()}
                className="rounded-md bg-brass px-4 py-2 text-sm font-medium text-ink transition disabled:cursor-not-allowed disabled:opacity-40"
              >
                {running ? "Asking all models…" : "Compare"}
              </button>
            </div>
            <button
              onClick={() => setShowPrompt((v) => !v)}
              className="mt-2 text-xs text-parchmentDim hover:text-brass"
            >
              {showPrompt ? "▾" : "▸"} Custom system prompt (optional)
            </button>
            {showPrompt && (
              <textarea
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                rows={3}
                placeholder="Leave empty to use the app's default prompt"
                className="mt-2 w-full resize-y rounded-lg border border-line bg-surface px-3 py-2 text-sm text-parchment outline-none placeholder:text-parchmentDim/60 focus:border-brass"
              />
            )}
          </div>

          {error && (
            <div className="mt-4 rounded-md border border-error/40 bg-error/10 px-4 py-2 text-sm text-error">
              {error}
            </div>
          )}

          {results.length === 1 && (
            <p className="mt-4 text-xs text-parchmentDim">
              Only one model is set up. Add GROQ_API_KEY and/or GEMINI_API_KEY in backend\.env (free keys) to
              compare more.
            </p>
          )}

          {results.length > 0 && (
            <div
              className="mt-6 grid gap-4"
              style={{ gridTemplateColumns: `repeat(auto-fit, minmax(min(100%, 18rem), 1fr))` }}
            >
              {results.map((r) => (
                <div key={`${r.provider}:${r.model}`} className="flex flex-col rounded-xl border border-line/70 bg-panel/40">
                  <div className="flex items-baseline justify-between gap-2 border-b border-line/70 px-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm text-parchment">{PROVIDER_LABEL[r.provider] ?? r.provider}</p>
                      <p className="truncate text-xs text-parchmentDim">{r.model}</p>
                    </div>
                    <span className="shrink-0 text-xs text-parchmentDim">
                      {r.seconds}s{fastest === r && results.length > 1 ? " ⚡ fastest" : ""}
                    </span>
                  </div>
                  <div dir="auto" className="prose-doc flex-1 px-4 py-3 text-sm text-parchment">
                    {r.error ? (
                      <p className="text-error">⚠ {r.error}</p>
                    ) : (
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{r.answer || "(empty answer)"}</ReactMarkdown>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {sources.length > 0 && (
            <div className="mt-4 text-xs text-parchmentDim">
              All models saw the same sources:{" "}
              {sources.map((s, i) => (
                <button
                  key={s.chunk_id}
                  onClick={() => setOpenChunkId(s.chunk_id)}
                  className="mr-2 hover:text-brass hover:underline"
                >
                  [{i + 1}] {s.filename}
                </button>
              ))}
            </div>
          )}
        </div>
      </main>

      {openChunkId && <SourceViewer chunkId={openChunkId} onClose={() => setOpenChunkId(null)} />}
    </div>
  );
}
