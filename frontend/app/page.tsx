"use client";

import { useEffect, useState } from "react";
import { api, type Conversation, type Message } from "@/lib/api";
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
  }, []);

  useEffect(() => {
    if (!activeId) {
      setMessages([]);
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
        <div className="flex items-center justify-end border-b border-line bg-surface px-4 py-2">
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
