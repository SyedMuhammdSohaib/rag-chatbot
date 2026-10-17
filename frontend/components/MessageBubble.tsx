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
  onSpeak,
  onSourceClick,
}: {
  role: "user" | "assistant";
  content: string;
  sources?: SourceChunk[];
  streaming?: boolean;
  speaking?: boolean;
  // Absent when the browser can't read aloud
  onSpeak?: () => void;
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

        {!isUser && content && !streaming && onSpeak && (
          <button
            onClick={onSpeak}
            title={speaking ? "Stop reading" : "Read aloud"}
            className={`mt-1 px-1 text-[11px] transition ${
              speaking ? "text-brass" : "text-parchmentDim hover:text-brass"
            }`}
          >
            {speaking ? "■ Stop" : "🔊 Listen"}
          </button>
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
                    <span className="text-parchmentDim">— {Math.round(s.score * 100)}% match</span>
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
