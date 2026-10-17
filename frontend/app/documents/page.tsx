"use client";

import { useCallback, useEffect, useState } from "react";
import { api, type Conversation, type DocumentItem } from "@/lib/api";
import { LANGUAGES, useLanguage, type Language } from "@/lib/language";
import Sidebar from "@/components/Sidebar";
import CompareDocuments from "@/components/CompareDocuments";
import DocumentUpload from "@/components/DocumentUpload";
import DocumentList from "@/components/DocumentList";

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [convosLoading, setConvosLoading] = useState(true);
  const [language, setLanguage] = useLanguage();

  const refresh = useCallback(async () => {
    try {
      const data = await api.listDocuments();
      setDocuments(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    api
      .listConversations()
      .then(setConversations)
      .finally(() => setConvosLoading(false));

    // Poll while any document is still ingesting or being summarized, so
    // status updates live.
    const interval = setInterval(() => {
      setDocuments((current) => {
        if (
          current.some(
            (d) => d.status === "pending" || d.status === "processing" || d.summary_status === "pending"
          )
        ) {
          refresh();
        }
        return current;
      });
    }, 2500);
    return () => clearInterval(interval);
  }, [refresh]);

  return (
    <div className="flex h-screen">
      <Sidebar
        conversations={conversations}
        activeId={null}
        loading={convosLoading}
        onSelect={() => {
          window.location.href = "/";
        }}
        onNew={() => {
          window.location.href = "/";
        }}
        onRename={async () => {}}
        onDelete={async () => {}}
      />

      <main className="flex-1 overflow-y-auto bg-surface px-8 py-10">
        <div className="mx-auto max-w-3xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-serif text-2xl text-parchment">Documents</h2>
              <p className="mt-1 text-sm text-parchmentDim">
                Files uploaded here are chunked, embedded, and made searchable for chat answers. Each one
                also gets a short summary and suggested questions.
              </p>
            </div>
            <label className="flex shrink-0 flex-col gap-1 text-xs text-parchmentDim">
              Summary language
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value as Language)}
                className="rounded-md border border-line bg-panel px-2 py-1.5 text-sm text-parchment outline-none focus:border-brass"
              >
                {LANGUAGES.map((l) => (
                  <option key={l.value} value={l.value}>
                    {l.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-6">
            <DocumentUpload onUploaded={refresh} language={language} />
          </div>

          <div className="mt-10">
            <DocumentList
              documents={documents}
              loading={loading}
              onDelete={async (id) => {
                await api.deleteDocument(id);
                refresh();
              }}
              onResummarize={async (id) => {
                await api.resummarize(id, language).catch(() => {});
                refresh();
              }}
              onAsk={(question) => {
                window.location.href = `/?ask=${encodeURIComponent(question)}`;
              }}
            />
          </div>

          <div className="mt-10">
            <h3 className="font-serif text-lg text-parchment">Compare two documents</h3>
            <p className="mt-1 text-sm text-parchmentDim">
              What do they share, what's only in one, and where do they disagree?
            </p>
            <div className="mt-3">
              <CompareDocuments documents={documents} language={language} />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
