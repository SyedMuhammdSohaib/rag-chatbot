"use client";

import { useRef, useState } from "react";
import { api } from "@/lib/api";

export default function DocumentUpload({ onUploaded }: { onUploaded: () => void }) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        if (!/\.(pdf|txt|docx)$/i.test(file.name)) {
          throw new Error(`${file.name}: only .pdf, .txt, and .docx are supported`);
        }
        await api.uploadDocument(file);
      }
      onUploaded();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          handleFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className={`cursor-pointer rounded-xl border border-dashed px-6 py-10 text-center transition ${
          dragging ? "border-brass bg-brass/5" : "border-line hover:border-brassSoft"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".pdf,.txt,.docx"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <p className="font-serif text-parchment">
          {uploading ? "Uploading…" : "Drop files here, or click to choose"}
        </p>
        <p className="mt-1 text-xs text-parchmentDim">PDF, TXT, or DOCX</p>
      </div>
      {error && <p className="mt-2 text-sm text-error">{error}</p>}
    </div>
  );
}
