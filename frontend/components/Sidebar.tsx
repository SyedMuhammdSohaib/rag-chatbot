"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import type { Conversation } from "@/lib/api";

export default function Sidebar({
  conversations,
  activeId,
  onSelect,
  onNew,
  onRename,
  onDelete,
  loading,
}: {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
  loading: boolean;
}) {
  const pathname = usePathname();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-line bg-panel">
      <div className="px-5 pt-6 pb-4">
        <h1 className="font-serif text-lg tracking-tight text-parchment">Reading Room</h1>
        <p className="mt-1 text-xs text-parchmentDim">Answers, footnoted to your files.</p>
      </div>

      <div className="px-3">
        <button
          onClick={onNew}
          className="w-full rounded-md border border-brassSoft/50 bg-transparent py-2 text-sm text-parchment transition hover:border-brass hover:text-brass"
        >
          + New conversation
        </button>
      </div>

      <nav className="mt-4 flex-1 overflow-y-auto px-2">
        {loading && <p className="px-3 py-2 text-xs text-parchmentDim">Loading…</p>}
        {!loading && conversations.length === 0 && (
          <p className="px-3 py-2 text-xs text-parchmentDim">No conversations yet.</p>
        )}
        <ul className="space-y-0.5">
          {conversations.map((c) => (
            <li key={c.id} className="group relative">
              {editingId === c.id ? (
                <input
                  autoFocus
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onBlur={() => {
                    if (editValue.trim()) onRename(c.id, editValue.trim());
                    setEditingId(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") e.currentTarget.blur();
                    if (e.key === "Escape") setEditingId(null);
                  }}
                  className="w-full rounded bg-surface px-3 py-2 text-sm text-parchment outline-none ring-1 ring-brass"
                />
              ) : (
                <button
                  onClick={() => onSelect(c.id)}
                  className={`w-full truncate rounded px-3 py-2 text-left text-sm transition ${
                    c.id === activeId
                      ? "bg-surface text-parchment"
                      : "text-parchmentDim hover:bg-surface/60 hover:text-parchment"
                  }`}
                >
                  {c.title || "Untitled"}
                </button>
              )}

              {editingId !== c.id && (
                <div className="absolute right-1 top-1.5 hidden gap-1 group-hover:flex">
                  <button
                    title="Rename"
                    onClick={() => {
                      setEditingId(c.id);
                      setEditValue(c.title);
                    }}
                    className="rounded px-1.5 py-1 text-xs text-parchmentDim hover:text-brass"
                  >
                    ✎
                  </button>
                  <button
                    title="Delete"
                    onClick={() => onDelete(c.id)}
                    className="rounded px-1.5 py-1 text-xs text-parchmentDim hover:text-error"
                  >
                    ✕
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </nav>

      <div className="space-y-0.5 border-t border-line p-3">
        {[
          { href: "/documents", label: "📄 Documents" },
          { href: "/quiz", label: "📝 Quiz" },
        ].map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={`block rounded-md px-3 py-2 text-sm transition ${
              pathname === link.href
                ? "bg-surface text-brass"
                : "text-parchmentDim hover:bg-surface/60 hover:text-parchment"
            }`}
          >
            {link.label}
          </Link>
        ))}
      </div>
    </aside>
  );
}
