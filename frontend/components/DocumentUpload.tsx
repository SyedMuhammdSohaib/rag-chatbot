"use client";

import { useRef, useState } from "react";
import { api } from "@/lib/api";

const FILE_PATTERN = /\.(pdf|txt|docx|png|jpe?g|webp|bmp)$/i;

export default function DocumentUpload({ onUploaded, language }: { onUploaded: () => void; language: string }) {
  const [dragging, setDragging] = useState(false);
  const [link, setLink] = useState("");
  const [adding, setAdding] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        if (!FILE_PATTERN.test(file.name)) {
          throw new Error(`${file.name}: only .pdf, .txt, .docx and images (.png, .jpg) are supported`);
        }
        await api.uploadDocument(file, language);
      }
      onUploaded();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  async function handleLink() {
    if (!link.trim()) return;
    setError(null);
    setAdding(true);
    try {
      await api.addLink(link.trim(), language);
      setLink("");
      onUploaded();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't add that link.");
    } finally {
      setAdding(false);
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
          accept=".pdf,.txt,.docx,.png,.jpg,.jpeg,.webp,.bmp"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <p className="font-serif text-parchment">
          {uploading ? "Uploading…" : "Drop files here, or click to choose"}
        </p>
        <p className="mt-1 text-xs text-parchmentDim">
          PDF, TXT, DOCX, or a photo/scan (PNG, JPG). Scanned pages are read with OCR (English text).
        </p>
      </div>

      <div className="mt-3 flex gap-2">
        <input
          value={link}
          onChange={(e) => setLink(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleLink()}
          placeholder="…or paste a web page or YouTube link"
          className="min-w-0 flex-1 rounded-lg border border-line bg-panel px-3 py-2 text-sm text-parchment outline-none placeholder:text-parchmentDim/70 focus:border-brass"
        />
        <button
          onClick={handleLink}
          disabled={adding || !link.trim()}
          className="rounded-lg border border-brassSoft/60 px-4 py-2 text-sm text-parchment transition hover:border-brass hover:text-brass disabled:opacity-40"
        >
          {adding ? "Reading…" : "Add link"}
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-error">{error}</p>}
    </div>
  );
}
