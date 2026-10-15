"use client";

import { useCallback, useEffect, useState } from "react";
import { api, type Conversation, type DocumentItem } from "@/lib/api";
import Sidebar from "@/components/Sidebar";
import DocumentUpload from "@/components/DocumentUpload";
import DocumentList from "@/components/DocumentList";

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [convosLoading, setConvosLoading] = useState(true);

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

    // Poll while any document is still ingesting, so status updates live.
    const interval = setInterval(() => {
      setDocuments((current) => {
        if (current.some((d) => d.status === "pending" || d.status === "processing")) {
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
          <h2 className="font-serif text-2xl text-parchment">Documents</h2>
          <p className="mt-1 text-sm text-parchmentDim">
            Files uploaded here are chunked, embedded, and made searchable for chat answers.
          </p>

          <div className="mt-6">
            <DocumentUpload onUploaded={refresh} />
          </div>

          <div className="mt-10">
            <DocumentList
              documents={documents}
              loading={loading}
              onDelete={async (id) => {
                await api.deleteDocument(id);
                refresh();
              }}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
