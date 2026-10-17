"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { SourceChunk } from "@/lib/api";

export default function MessageBubble({
  role,
  content,
  sources,
  streaming,
  speaking,
  rating,
  model,
  onSpeak,
  onRate,
  onSourceClick,
}: {
  role: "user" | "assistant";
  content: string;
  sources?: SourceChunk[];
  streaming?: boolean;
  speaking?: boolean;
  rating?: number | null;
  // "provider:model" that answered, or "cache"
  model?: string | null;
  // Absent when the browser can't read aloud
  onSpeak?: () => void;
  // Absent until the answer is saved
  onRate?: (value: number) => void;
  onSourceClick?: (chunkId: string) => void;
}) {
  const isUser = role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-prose ${isUser ? "" : "w-full"}`}>
        <div
          className={
            isUser
              ? "rounded-xl bg-surface px-4 py-3 text-parchment"
              : "rounded-xl border border-line/70 bg-panel/40 px-4 py-3 text-parchment"
          }
        >
          {/* dir="auto" lays Urdu out right-to-left and English left-to-right */}
          <div dir="auto" className="prose-doc text-[0.95rem] leading-relaxed">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{content || (streaming ? "…" : "")}</ReactMarkdown>
          </div>
        </div>

        {!isUser && content && !streaming && (
          <div className="mt-1 flex items-center gap-3 px-1 text-[11px] text-parchmentDim">
            {onSpeak && (
              <button
                onClick={onSpeak}
                title={speaking ? "Stop reading" : "Read aloud"}
                className={`transition ${speaking ? "text-brass" : "hover:text-brass"}`}
              >
                {speaking ? "■ Stop" : "🔊 Listen"}
              </button>
            )}
            {onRate &&
              [
                { value: 1, icon: "👍", label: "Good answer" },
                { value: -1, icon: "👎", label: "Bad answer" },
              ].map((r) => (
                <button
                  key={r.value}
                  onClick={() => onRate(r.value)}
                  title={r.label}
                  aria-pressed={rating === r.value}
                  className={`rounded px-1 transition ${
                    rating === r.value ? "bg-brass/25 opacity-100" : "opacity-50 hover:opacity-100"
                  }`}
                >
                  {r.icon}
                </button>
              ))}
            {model && (
              <span className="ml-auto text-parchmentDim/70">
                {model === "cache" ? "⚡ from cache" : `via ${model.split(":").slice(1).join(":") || model}`}
              </span>
            )}
          </div>
        )}

        {!isUser && sources && sources.length > 0 && (
          <div className="mt-2 space-y-1 px-1">
            <p className="text-[11px] text-parchmentDim">Sources · click to see the passage</p>
            <ol className="space-y-1">
              {sources.map((s, i) => (
                <li key={s.chunk_id} className="text-[11px] text-parchmentDim">
                  <button
                    onClick={() => onSourceClick?.(s.chunk_id)}
                    className="text-left hover:underline decoration-brass underline-offset-2"
                  >
                    <span className="text-brass">[{i + 1}]</span>{" "}
                    <span className="text-parchment/80">{s.filename}</span>{" "}
                    {s.score !== null && (
                      <span className="text-parchmentDim">— {Math.round(s.score * 100)}% match</span>
                    )}
                  </button>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </div>
  );
}
