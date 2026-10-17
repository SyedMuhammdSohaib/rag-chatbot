"use client";

import { useState } from "react";
import type { DocumentItem } from "@/lib/api";

const STATUS_LABEL: Record<DocumentItem["status"], string> = {
  pending: "Queued",
  processing: "Ingesting…",
  ready: "Ready",
  failed: "Failed",
};

const STATUS_COLOR: Record<DocumentItem["status"], string> = {
  pending: "text-parchmentDim",
  processing: "text-brass",
  ready: "text-green-500/80",
  failed: "text-error",
};

function SummaryPanel({
  doc,
  onResummarize,
  onAsk,
}: {
  doc: DocumentItem;
  onResummarize: (id: string) => void;
  onAsk: (question: string) => void;
}) {
  if (doc.summary_status === "pending") {
    return <p className="text-xs text-brass">Writing summary and questions…</p>;
  }
  if (doc.summary_status !== "done" || !doc.summary) {
    return (
      <p className="text-xs text-parchmentDim">
        {doc.summary_status === "failed" ? "The summary couldn't be written (is the model running?). " : ""}
        <button onClick={() => onResummarize(doc.id)} className="text-brass hover:underline">
          {doc.summary_status === "failed" ? "Try again" : "✨ Summarize"}
        </button>
      </p>
    );
  }
  return (
    <div dir="auto" className="space-y-3 text-sm">
      <p className="leading-relaxed text-parchment">{doc.summary}</p>
      {doc.key_points && doc.key_points.length > 0 && (
        <div>
          <p className="text-xs text-parchmentDim">Key points</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-parchment/90">
            {doc.key_points.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ul>
        </div>
      )}
      {doc.suggested_questions && doc.suggested_questions.length > 0 && (
        <div>
          <p className="text-xs text-parchmentDim">Ask about it</p>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {doc.suggested_questions.map((q, i) => (
              <button
                key={i}
                onClick={() => onAsk(q)}
                className="rounded-full border border-brassSoft/50 px-3 py-1 text-left text-xs text-parchment transition hover:border-brass hover:text-brass"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}
      <button onClick={() => onResummarize(doc.id)} className="text-xs text-parchmentDim hover:text-brass">
        ↻ Rewrite summary
      </button>
    </div>
  );
}

export default function DocumentList({
  documents,
  loading,
  onDelete,
  onResummarize,
  onAsk,
}: {
  documents: DocumentItem[];
  loading: boolean;
  onDelete: (id: string) => void;
  onResummarize: (id: string) => void;
  onAsk: (question: string) => void;
}) {
  const [openId, setOpenId] = useState<string | null>(null);

  if (loading) {
    return <p className="text-sm text-parchmentDim">Loading documents…</p>;
  }

  if (documents.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-line py-10 text-center">
        <p className="text-sm text-parchmentDim">No documents uploaded yet.</p>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-line/50 border-y border-line text-sm">
      {documents.map((d) => {
        const open = openId === d.id;
        return (
          <li key={d.id} className="py-3">
            <div className="flex items-start gap-4">
              <div className="min-w-0 flex-1">
                <p className="truncate text-parchment" title={d.filename}>
                  {d.source_url ? "🔗 " : ""}
                  {d.filename}
                </p>
                <p className="mt-0.5 text-xs text-parchmentDim">
                  <span className={STATUS_COLOR[d.status]}>{STATUS_LABEL[d.status]}</span>
                  {d.chunk_count > 0 && ` · ${d.chunk_count} chunks`}
                  {` · ${new Date(d.uploaded_at).toLocaleDateString()}`}
                  {d.source_url && (
                    <>
                      {" · "}
                      <a href={d.source_url} target="_blank" rel="noreferrer" className="hover:text-brass">
                        source ↗
                      </a>
                    </>
                  )}
                </p>
                {d.status === "failed" && d.error_message && (
                  <p className="mt-0.5 text-xs text-error">{d.error_message}</p>
                )}
              </div>
              {d.status === "ready" && (
                <button
                  onClick={() => setOpenId(open ? null : d.id)}
                  className={`shrink-0 text-xs transition ${open ? "text-brass" : "text-parchmentDim hover:text-brass"}`}
                >
                  {d.summary_status === "pending" ? "Summarizing…" : open ? "Hide summary ▴" : "Summary ▾"}
                </button>
              )}
              <button onClick={() => onDelete(d.id)} className="shrink-0 text-xs text-parchmentDim hover:text-error">
                Delete
              </button>
            </div>
            {open && (
              <div className="mt-3 rounded-lg border border-line/70 bg-panel/40 p-4">
                <SummaryPanel doc={d} onResummarize={onResummarize} onAsk={onAsk} />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
