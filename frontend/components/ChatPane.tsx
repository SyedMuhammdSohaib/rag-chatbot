"use client";

import { useEffect, useRef, useState } from "react";
import { streamChat, type Message, type SourceChunk } from "@/lib/api";
import MessageBubble from "./MessageBubble";

type DisplayMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: SourceChunk[];
};

export default function ChatPane({
  conversationId,
  initialMessages,
  onConversationCreated,
  draftSystemPrompt,
}: {
  conversationId: string | null;
  initialMessages: Message[];
  onConversationCreated: (id: string) => void;
  // Only used when conversationId is null — applied to the conversation
  // this first message creates.
  draftSystemPrompt?: string;
}) {
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMessages(
      initialMessages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
      }))
    );
  }, [initialMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend() {
    const text = input.trim();
    if (!text || streaming) return;
    setError(null);
    setInput("");

    const userMsg: DisplayMessage = { id: `local-${Date.now()}`, role: "user", content: text };
    const assistantId = `local-assistant-${Date.now()}`;
    setMessages((prev) => [...prev, userMsg, { id: assistantId, role: "assistant", content: "" }]);
    setStreaming(true);

    try {
      await streamChat(
        text,
        conversationId,
        {
          onToken: (token) => {
            setMessages((prev) =>
              prev.map((m) => (m.id === assistantId ? { ...m, content: m.content + token } : m))
            );
          },
          onDone: (data) => {
            setMessages((prev) =>
              prev.map((m) => (m.id === assistantId ? { ...m, sources: data.sources } : m))
            );
            if (!conversationId) onConversationCreated(data.conversation_id);
            setStreaming(false);
          },
          onError: (msg) => {
            setError(msg);
            // Show the reason inside the empty bubble instead of leaving it blank
            setMessages((prev) =>
              prev.map((m) => (m.id === assistantId && !m.content ? { ...m, content: `⚠ ${msg}` } : m))
            );
            setStreaming(false);
          },
        },
        draftSystemPrompt
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      // Never leave the UI stuck on "Sending…" even if the stream ended early
      setStreaming(false);
    }
  }

  return (
    <div className="flex h-full flex-1 flex-col bg-surface">
      <div className="flex-1 overflow-y-auto px-6 py-8">
        <div className="mx-auto flex max-w-3xl flex-col gap-6">
          {messages.length === 0 && (
            <div className="rounded-xl border border-dashed border-line py-14 text-center">
              <p className="font-serif text-lg text-parchment">Ask something about your documents</p>
              <p className="mt-2 text-sm text-parchmentDim">
                Upload files on the Documents page, then ask a question here — answers are
                grounded in what you've uploaded, with sources listed underneath.
              </p>
            </div>
          )}
          {messages.map((m) => (
            <MessageBubble
              key={m.id}
              role={m.role}
              content={m.content}
              sources={m.sources}
              streaming={streaming && m.role === "assistant" && m.content === ""}
            />
          ))}
          {error && (
            <div className="rounded-md border border-error/40 bg-error/10 px-4 py-2 text-sm text-error">
              {error}
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      <div className="border-t border-line px-6 py-4">
        <div className="mx-auto flex max-w-3xl items-end gap-3">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Ask a question…"
            rows={1}
            className="max-h-40 flex-1 resize-none rounded-lg border border-line bg-panel px-4 py-3 text-sm text-parchment outline-none placeholder:text-parchmentDim focus:border-brass"
          />
          <button
            onClick={handleSend}
            disabled={streaming || !input.trim()}
            className="rounded-lg bg-brass px-4 py-3 text-sm font-medium text-ink transition disabled:cursor-not-allowed disabled:opacity-40"
          >
            {streaming ? "Sending…" : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}
