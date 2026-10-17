"use client";

import { useEffect, useRef, useState } from "react";
import { streamChat, type Message, type SourceChunk } from "@/lib/api";
import { LANGUAGES, micLangFor, speechLangFor, useLanguage, type Language } from "@/lib/language";
import { canListen, canSpeak, listen, speak, stopSpeaking } from "@/lib/speech";
import MessageBubble from "./MessageBubble";
import SourceViewer from "./SourceViewer";

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
  const [language, setLanguage] = useLanguage();
  const [listening, setListening] = useState(false);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [openChunkId, setOpenChunkId] = useState<string | null>(null);
  // Checked after mount: the server render has no window to ask
  const [voice, setVoice] = useState({ listen: false, speak: false });
  const stopListeningRef = useRef<() => void>(() => {});
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setVoice({ listen: canListen(), speak: canSpeak() });
    return () => {
      stopListeningRef.current();
      stopSpeaking();
    };
  }, []);

  useEffect(() => {
    // Saved messages come back without sources; keep the ones already on
    // screen (e.g. the first answer of a conversation that was just created)
    setMessages((prev) =>
      initialMessages.map((m, i) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        sources: prev[i]?.role === m.role && prev[i]?.content === m.content ? prev[i].sources : undefined,
      }))
    );
  }, [initialMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function toggleSpeak(id: string, text: string, lang: Language = language) {
    if (speakingId === id) {
      stopSpeaking();
      setSpeakingId(null);
      return;
    }
    setSpeakingId(id);
    speak(text, speechLangFor(lang), () => setSpeakingId((cur) => (cur === id ? null : cur)));
  }

  function toggleMic() {
    if (listening) {
      stopListeningRef.current();
      return;
    }
    setError(null);
    stopSpeaking();
    setSpeakingId(null);
    setListening(true);
    let heard = "";
    stopListeningRef.current = listen(micLangFor(language), {
      onText: (text) => {
        heard = text;
        setInput(text);
      },
      onError: setError,
      onEnd: () => {
        setListening(false);
        // A spoken question gets a spoken answer
        if (heard.trim()) handleSend(heard, true);
      },
    });
  }

  async function handleSend(spokenText?: string, readAnswerAloud = false) {
    const text = (spokenText ?? input).trim();
    if (!text || streaming) return;
    setError(null);
    setInput("");

    const userMsg: DisplayMessage = { id: `local-${Date.now()}`, role: "user", content: text };
    const assistantId = `local-assistant-${Date.now()}`;
    setMessages((prev) => [...prev, userMsg, { id: assistantId, role: "assistant", content: "" }]);
    setStreaming(true);
    let answer = "";
    const answerLanguage = language;

    try {
      await streamChat(
        text,
        conversationId,
        {
          onToken: (token) => {
            answer += token;
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
            if (readAnswerAloud && answer.trim()) toggleSpeak(assistantId, answer, answerLanguage);
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
        draftSystemPrompt,
        language
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
              speaking={speakingId === m.id}
              onSpeak={voice.speak ? () => toggleSpeak(m.id, m.content) : undefined}
              onSourceClick={setOpenChunkId}
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
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value as Language)}
            title="Answer language"
            className="rounded-lg border border-line bg-panel px-2 py-3 text-sm text-parchment outline-none focus:border-brass"
          >
            {LANGUAGES.map((l) => (
              <option key={l.value} value={l.value}>
                {l.label}
              </option>
            ))}
          </select>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={listening ? "Listening… speak now" : "Ask a question…"}
            dir="auto"
            rows={1}
            className="max-h-40 flex-1 resize-none rounded-lg border border-line bg-panel px-4 py-3 text-sm text-parchment outline-none placeholder:text-parchmentDim focus:border-brass"
          />
          {voice.listen && (
            <button
              onClick={toggleMic}
              disabled={streaming}
              title={listening ? "Stop listening" : "Ask by voice"}
              className={`rounded-lg border px-3 py-3 text-sm transition disabled:opacity-40 ${
                listening
                  ? "animate-pulse border-error bg-error/20 text-parchment"
                  : "border-line bg-panel text-parchmentDim hover:border-brass hover:text-brass"
              }`}
            >
              🎤
            </button>
          )}
          <button
            onClick={() => handleSend()}
            disabled={streaming || !input.trim()}
            className="rounded-lg bg-brass px-4 py-3 text-sm font-medium text-ink transition disabled:cursor-not-allowed disabled:opacity-40"
          >
            {streaming ? "Sending…" : "Send"}
          </button>
        </div>
      </div>

      {openChunkId && <SourceViewer chunkId={openChunkId} onClose={() => setOpenChunkId(null)} />}
    </div>
  );
}
