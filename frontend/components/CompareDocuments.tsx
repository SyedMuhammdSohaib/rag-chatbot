"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { api, type DocumentItem } from "@/lib/api";

const selectClass =
  "min-w-0 flex-1 rounded-md border border-line bg-surface px-2 py-2 text-sm text-parchment outline-none focus:border-brass";

/** "What's the difference between these two files?" */
export default function CompareDocuments({ documents, language }: { documents: DocumentItem[]; language: string }) {
  const ready = documents.filter((d) => d.status === "ready");
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const [answer, setAnswer] = useState("");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setRunning(true);
    setError(null);
    setAnswer("");
    try {
      setAnswer((await api.compareDocuments(a, b, language)).answer);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Comparison failed.");
    } finally {
      setRunning(false);
    }
  }

  if (ready.length < 2) {
    return <p className="text-sm text-parchmentDim">Add at least two documents to compare them.</p>;
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <select value={a} onChange={(e) => setA(e.target.value)} className={selectClass}>
          <option value="">Document A…</option>
          {ready.map((d) => (
            <option key={d.id} value={d.id} disabled={d.id === b}>
              {d.filename}
            </option>
          ))}
        </select>
        <span className="text-xs text-parchmentDim">vs</span>
        <select value={b} onChange={(e) => setB(e.target.value)} className={selectClass}>
          <option value="">Document B…</option>
          {ready.map((d) => (
            <option key={d.id} value={d.id} disabled={d.id === a}>
              {d.filename}
            </option>
          ))}
        </select>
        <button
          onClick={run}
          disabled={!a || !b || a === b || running}
          className="rounded-md bg-brass px-4 py-2 text-sm font-medium text-ink transition disabled:cursor-not-allowed disabled:opacity-40"
        >
          {running ? "Comparing…" : "Compare"}
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-error">{error}</p>}
      {answer && (
        <div dir="auto" className="prose-doc mt-4 rounded-lg border border-line/70 bg-panel/40 px-4 py-3 text-sm text-parchment">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{answer}</ReactMarkdown>
        </div>
      )}
    </div>
  );
}
