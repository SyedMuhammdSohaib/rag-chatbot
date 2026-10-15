export const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export type Conversation = {
  id: string;
  title: string;
  created_at: string;
  system_prompt: string | null;
};

export type PromptPreset = {
  id: string;
  name: string;
  content: string;
  created_at: string;
};

export type Message = {
  id: string;
  conversation_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
  cited_chunk_ids: string[];
};

export type SourceChunk = {
  chunk_id: string;
  document_id: string;
  filename: string;
  content: string;
  score: number;
};

export type DocumentItem = {
  id: string;
  filename: string;
  content_type: string;
  status: "pending" | "processing" | "ready" | "failed";
  error_message: string | null;
  uploaded_at: string;
  chunk_count: number;
};

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Request failed with status ${res.status}`);
  }
  return res.json();
}

export const api = {
  listConversations: () => fetch(`${API_BASE}/conversations`).then((r) => json<Conversation[]>(r)),

  createConversation: (title?: string, systemPrompt?: string | null) =>
    fetch(`${API_BASE}/conversations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, system_prompt: systemPrompt }),
    }).then((r) => json<Conversation>(r)),

  renameConversation: (id: string, title: string) =>
    fetch(`${API_BASE}/conversations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    }).then((r) => json<Conversation>(r)),

  updateSystemPrompt: (id: string, systemPrompt: string | null) =>
    fetch(`${API_BASE}/conversations/${id}/system-prompt`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ system_prompt: systemPrompt }),
    }).then((r) => json<Conversation>(r)),

  listPresets: () => fetch(`${API_BASE}/presets`).then((r) => json<PromptPreset[]>(r)),

  createPreset: (name: string, content: string) =>
    fetch(`${API_BASE}/presets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, content }),
    }).then((r) => json<PromptPreset>(r)),

  deletePreset: (id: string) => fetch(`${API_BASE}/presets/${id}`, { method: "DELETE" }).then((r) => json(r)),

  deleteConversation: (id: string) =>
    fetch(`${API_BASE}/conversations/${id}`, { method: "DELETE" }).then((r) => json(r)),

  getMessages: (id: string) =>
    fetch(`${API_BASE}/conversations/${id}/messages`).then((r) => json<Message[]>(r)),

  listDocuments: () => fetch(`${API_BASE}/documents`).then((r) => json<DocumentItem[]>(r)),

  uploadDocument: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return fetch(`${API_BASE}/documents/upload`, { method: "POST", body: form }).then((r) =>
      json<DocumentItem>(r)
    );
  },

  deleteDocument: (id: string) =>
    fetch(`${API_BASE}/documents/${id}`, { method: "DELETE" }).then((r) => json(r)),
};

/**
 * Streams a chat response via SSE (POST + fetch/ReadableStream, since
 * EventSource doesn't support POST bodies). Calls onToken for each chunk
 * of text, and onDone once the stream finishes with the final source list
 * and conversation id.
 */
export async function streamChat(
  message: string,
  conversationId: string | null,
  handlers: {
    onToken: (text: string) => void;
    onDone: (data: { conversation_id: string; sources: SourceChunk[]; system_prompt: string }) => void;
    onError: (message: string) => void;
  },
  // Only applied when conversationId is null (starting a brand-new
  // conversation) — sets its system prompt from the first message.
  newConversationSystemPrompt?: string | null
) {
  const res = await fetch(`${API_BASE}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      conversation_id: conversationId,
      system_prompt: conversationId ? undefined : newConversationSystemPrompt,
    }),
  });

  if (!res.ok || !res.body) {
    handlers.onError(`Chat request failed (${res.status})`);
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    // sse-starlette separates events with \r\n, so normalise before splitting
    buffer = (buffer + decoder.decode(value, { stream: true })).replace(/\r\n/g, "\n");

    const events = buffer.split("\n\n");
    buffer = events.pop() || "";

    for (const raw of events) {
      const lines = raw.split("\n");
      let event = "message";
      let data = "";
      for (const line of lines) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        if (line.startsWith("data:")) data += line.slice(5).trim();
      }
      if (!data) continue;
      try {
        const parsed = JSON.parse(data);
        if (event === "token") handlers.onToken(parsed.text);
        else if (event === "done") handlers.onDone(parsed);
        else if (event === "error") handlers.onError(parsed.message);
      } catch {
        // ignore malformed frame
      }
    }
  }
}
