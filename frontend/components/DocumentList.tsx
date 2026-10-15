"use client";

import type { DocumentItem } from "@/lib/api";

const STATUS_LABEL: Record<DocumentItem["status"], string> = {
  pending: "Queued",
  processing: "Ingesting…",
  ready: "Ready",
  failed: "Failed",
};

const STATUS_COLOR: Record<DocumentItem["status"], string> = {
  pending: "text-parchmentDim",
  processing: "text-brass",
  ready: "text-green-500/80",
  failed: "text-error",
};

export default function DocumentList({
  documents,
  loading,
  onDelete,
}: {
  documents: DocumentItem[];
  loading: boolean;
  onDelete: (id: string) => void;
}) {
  if (loading) {
    return <p className="text-sm text-parchmentDim">Loading documents…</p>;
  }

  if (documents.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-line py-10 text-center">
        <p className="text-sm text-parchmentDim">No documents uploaded yet.</p>
      </div>
    );
  }

  return (
    <table className="w-full text-left text-sm">
      <thead>
        <tr className="border-b border-line text-xs text-parchmentDim">
          <th className="py-2 font-normal">File</th>
          <th className="py-2 font-normal">Status</th>
          <th className="py-2 font-normal">Chunks</th>
          <th className="py-2 font-normal">Uploaded</th>
          <th className="py-2 font-normal"></th>
        </tr>
      </thead>
      <tbody>
        {documents.map((d) => (
          <tr key={d.id} className="border-b border-line/50">
            <td className="py-3 pr-4">
              <p className="text-parchment">{d.filename}</p>
              {d.status === "failed" && d.error_message && (
                <p className="mt-0.5 text-xs text-error">{d.error_message}</p>
              )}
            </td>
            <td className={`py-3 pr-4 ${STATUS_COLOR[d.status]}`}>{STATUS_LABEL[d.status]}</td>
            <td className="py-3 pr-4 text-parchmentDim">{d.chunk_count || "—"}</td>
            <td className="py-3 pr-4 text-parchmentDim">
              {new Date(d.uploaded_at).toLocaleDateString()}
            </td>
            <td className="py-3 text-right">
              <button
                onClick={() => onDelete(d.id)}
                className="text-xs text-parchmentDim hover:text-error"
              >
                Delete
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
