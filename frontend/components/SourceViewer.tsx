"use client";

import { useEffect, useRef, useState } from "react";
import { api, type ChunkContext } from "@/lib/api";

/** Pop-up showing the exact passage a source came from, highlighted, with
 * the text just before and after it so it reads in context. */
export default function SourceViewer({ chunkId, onClose }: { chunkId: string; onClose: () => void }) {
  const [data, setData] = useState<ChunkContext | null>(null);
  const [error, setError] = useState<string | null>(null);
  const highlightRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    setData(null);
    setError(null);
    api
      .getChunkContext(chunkId)
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "Couldn't load this source."));
  }, [chunkId]);

  useEffect(() => {
    highlightRef.current?.scrollIntoView({ block: "center" });
  }, [data]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-xl border border-line bg-panel shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <p className="truncate font-serif text-parchment">{data?.filename ?? "Source"}</p>
            {data && (
              <p className="mt-0.5 text-xs text-parchmentDim">
                Part {data.chunk_index + 1} of {data.chunk_count || "?"} · highlighted text is what the answer used
              </p>
            )}
          </div>
          <button onClick={onClose} title="Close" className="text-parchmentDim hover:text-parchment">
            ✕
          </button>
        </div>

        <div dir="auto" className="flex-1 overflow-y-auto whitespace-pre-wrap px-5 py-4 text-sm leading-relaxed">
          {!data && !error && <p className="text-parchmentDim">Loading…</p>}
          {error && <p className="text-error">{error}</p>}
          {data && (
            <>
              {data.before && <span className="text-parchmentDim/70">{data.before}</span>}
              <span
                ref={highlightRef}
                className="rounded bg-brass/20 text-parchment shadow-[0_0_0_3px_rgba(176,141,87,0.2)]"
              >
                {data.content}
              </span>
              {data.after && <span className="text-parchmentDim/70">{data.after}</span>}
            </>
          )}
        </div>

        {data && (
          <div className="border-t border-line px-5 py-3 text-right">
            <a
              href={api.documentFileUrl(data.document_id)}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-brass hover:underline"
            >
              Open original file ↗
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
