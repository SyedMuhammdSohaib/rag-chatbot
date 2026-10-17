"use client";

import { useEffect, useState } from "react";
import { api, type Conversation, type Message } from "@/lib/api";
import { downloadMarkdown, printAsPdf } from "@/lib/export";
import Sidebar from "@/components/Sidebar";
import ChatPane from "@/components/ChatPane";
import SystemPromptPanel from "@/components/SystemPromptPanel";

export default function HomePage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loadingConvos, setLoadingConvos] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [showPromptPanel, setShowPromptPanel] = useState(false);
  const [draftPrompt, setDraftPrompt] = useState("");
  const [askOnLoad, setAskOnLoad] = useState<string | null>(null);

  async function refreshConversations() {
    setLoadingConvos(true);
    try {
      const data = await api.listConversations();
      setConversations(data);
    } catch {
      // Sidebar shows an empty state; the chat pane surfaces send errors.
    } finally {
      setLoadingConvos(false);
    }
  }

  useEffect(() => {
    refreshConversations();
    // A suggested question clicked on the Documents page arrives as ?ask=
    const ask = new URLSearchParams(window.location.search).get("ask");
    if (ask) {
      setAskOnLoad(ask);
      window.history.replaceState(null, "", "/");
    }
  }, []);

  async function exportChat(format: "md" | "pdf") {
    if (!activeId) return;
    const title = conversations.find((c) => c.id === activeId)?.title || "Conversation";
    // Fetch fresh so answers given since the chat was opened are included
    const latest = await api.getMessages(activeId);
    if (format === "md") downloadMarkdown(title, latest);
    else printAsPdf(title, latest);
  }

  useEffect(() => {
    if (!activeId) {
      // Keep the same empty array when already empty: a new array would make
      // ChatPane reset and wipe a question that is being sent right now
      setMessages((prev) => (prev.length ? [] : prev));
      setDraftPrompt(""); // fresh conversation starts from the app default
      return;
    }
    api
      .getMessages(activeId)
      .then(setMessages)
      .catch(() => setMessages([]));
    const convo = conversations.find((c) => c.id === activeId);
    setDraftPrompt(convo?.system_prompt || "");
  }, [activeId, conversations]);

  return (
    <div className="flex h-screen">
      <Sidebar
        conversations={conversations}
        activeId={activeId}
        loading={loadingConvos}
        onSelect={setActiveId}
        onNew={() => setActiveId(null)}
        onRename={async (id, title) => {
          await api.renameConversation(id, title);
          refreshConversations();
        }}
        onDelete={async (id) => {
          await api.deleteConversation(id);
          if (activeId === id) setActiveId(null);
          refreshConversations();
        }}
      />

      <div className="flex flex-1 flex-col">
        <div className="flex items-center justify-end gap-1 border-b border-line bg-surface px-4 py-2">
          {activeId &&
            (["md", "pdf"] as const).map((format) => (
              <button
                key={format}
                onClick={() => exportChat(format)}
                title={format === "md" ? "Download as Markdown" : "Save as PDF (print dialog)"}
                className="rounded-md px-3 py-1.5 text-xs text-parchmentDim transition hover:bg-panel hover:text-parchment"
              >
                ⬇ {format === "md" ? "Markdown" : "PDF"}
              </button>
            ))}
          <button
            onClick={() => setShowPromptPanel((v) => !v)}
            className={`rounded-md px-3 py-1.5 text-xs transition ${
              showPromptPanel
                ? "bg-brass text-ink"
                : "text-parchmentDim hover:bg-panel hover:text-parchment"
            }`}
          >
            ⚙ System Prompt
          </button>
        </div>

        <div className="flex min-h-0 flex-1">
          <ChatPane
            conversationId={activeId}
            initialMessages={messages}
            draftSystemPrompt={draftPrompt}
            askOnLoad={askOnLoad}
            onAsked={() => setAskOnLoad(null)}
            onConversationCreated={(id) => {
              setActiveId(id);
              refreshConversations();
            }}
          />
          {showPromptPanel && (
            <SystemPromptPanel
              conversationId={activeId}
              draftPrompt={draftPrompt}
              onDraftChange={setDraftPrompt}
              onSaved={refreshConversations}
            />
          )}
        </div>
      </div>
    </div>
  );
}
