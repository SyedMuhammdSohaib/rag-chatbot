"use client";

import { useEffect, useState } from "react";
import { api, type PromptPreset } from "@/lib/api";

// Every persona keeps the grounding rules, so answers still come from the
// documents and cite [Source N]; only the voice changes.
const GROUNDING =
  "Answer using the provided document context and cite sources by their [Source N] label. " +
  "If the context doesn't contain the answer, say so plainly rather than guessing.";

const PERSONAS = [
  {
    name: "👩‍🏫 Teacher",
    prompt:
      "You are a patient teacher. Explain step by step in simple words, give a small everyday example, " +
      "and end with one short question that checks the student understood. " +
      GROUNDING,
  },
  {
    name: "😎 Dost",
    prompt:
      "You are the user's friendly, casual best friend (dost). Keep it short, warm and fun, use an " +
      "emoji or two, and explain things the way friends chat, without sounding like a textbook. " +
      GROUNDING,
  },
  {
    name: "🧐 Strict Examiner",
    prompt:
      "You are a strict examiner. Be brief and precise, point out anything vague or wrong in the " +
      "question, and when the user states an answer, mark it out of 10 with exact corrections. " +
      "No small talk. " +
      GROUNDING,
  },
];

export default function SystemPromptPanel({
  conversationId,
  draftPrompt,
  onDraftChange,
  onSaved,
}: {
  // null when practicing on a brand-new (not-yet-created) conversation
  conversationId: string | null;
  draftPrompt: string;
  onDraftChange: (value: string) => void;
  onSaved?: () => void;
}) {
  const [presets, setPresets] = useState<PromptPreset[]>([]);
  const [presetName, setPresetName] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedTick, setSavedTick] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.listPresets().then(setPresets).catch(() => setPresets([]));
  }, []);

  async function handleSaveToConversation() {
    if (!conversationId) return; // nothing to persist yet — draft applies on first send
    setSaving(true);
    setError(null);
    try {
      await api.updateSystemPrompt(conversationId, draftPrompt.trim() || null);
      setSavedTick(true);
      setTimeout(() => setSavedTick(false), 1500);
      onSaved?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveAsPreset() {
    if (!presetName.trim() || !draftPrompt.trim()) return;
    try {
      const preset = await api.createPreset(presetName.trim(), draftPrompt.trim());
      setPresets((prev) => [preset, ...prev]);
      setPresetName("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save preset.");
    }
  }

  async function handleDeletePreset(id: string) {
    try {
      await api.deletePreset(id);
      setPresets((prev) => prev.filter((p) => p.id !== id));
    } catch {
      // Non-critical — the preset stays in the list if delete fails.
    }
  }

  return (
    <div className="w-80 shrink-0 border-l border-line bg-panel p-4 overflow-y-auto">
      <h3 className="font-serif text-parchment">System Prompt</h3>
      <p className="mt-1 text-xs text-parchmentDim">
        {conversationId
          ? "Edit and save to change how this conversation behaves."
          : "Set this before sending your first message to a new conversation."}{" "}
        Or pick a persona below.
      </p>

      <textarea
        value={draftPrompt}
        onChange={(e) => onDraftChange(e.target.value)}
        rows={8}
        placeholder="You are a helpful assistant answering questions using the provided document context..."
        className="mt-3 w-full resize-y rounded-lg border border-line bg-surface px-3 py-2 text-sm text-parchment outline-none placeholder:text-parchmentDim/60 focus:border-brass"
      />

      <div className="mt-2 flex flex-wrap gap-1.5">
        {PERSONAS.map((p) => (
          <button
            key={p.name}
            onClick={() => onDraftChange(p.prompt)}
            title={p.prompt}
            className={`rounded-full border px-2.5 py-1 text-xs transition ${
              draftPrompt === p.prompt
                ? "border-brass bg-brass/15 text-brass"
                : "border-line text-parchment hover:border-brass hover:text-brass"
            }`}
          >
            {p.name}
          </button>
        ))}
      </div>

      {conversationId && (
        <button
          onClick={handleSaveToConversation}
          disabled={saving}
          className="mt-2 w-full rounded-md bg-brass py-2 text-sm font-medium text-ink transition disabled:opacity-50"
        >
          {savedTick ? "Saved ✓" : saving ? "Saving…" : "Save to this conversation"}
        </button>
      )}

      {error && <p className="mt-2 text-xs text-error">{error}</p>}

      <div className="mt-6 border-t border-line pt-4">
        <p className="text-xs text-parchmentDim">Save current prompt as a preset</p>
        <div className="mt-2 flex gap-2">
          <input
            value={presetName}
            onChange={(e) => setPresetName(e.target.value)}
            placeholder="Preset name"
            className="min-w-0 flex-1 rounded-md border border-line bg-surface px-2 py-1.5 text-sm text-parchment outline-none placeholder:text-parchmentDim/60 focus:border-brass"
          />
          <button
            onClick={handleSaveAsPreset}
            disabled={!presetName.trim() || !draftPrompt.trim()}
            className="rounded-md border border-brassSoft/60 px-3 py-1.5 text-xs text-parchment transition hover:border-brass hover:text-brass disabled:opacity-40"
          >
            Save
          </button>
        </div>
      </div>

      <div className="mt-6 border-t border-line pt-4">
        <p className="text-xs text-parchmentDim">Presets</p>
        {presets.length === 0 && <p className="mt-2 text-xs text-parchmentDim">No saved presets yet.</p>}
        <ul className="mt-2 space-y-1.5">
          {presets.map((p) => (
            <li
              key={p.id}
              className="group flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-surface/60"
            >
              <button
                onClick={() => onDraftChange(p.content)}
                title={p.content}
                className="min-w-0 flex-1 truncate text-left text-sm text-parchment hover:text-brass"
              >
                {p.name}
              </button>
              <button
                onClick={() => handleDeletePreset(p.id)}
                className="ml-2 hidden text-xs text-parchmentDim hover:text-error group-hover:block"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
