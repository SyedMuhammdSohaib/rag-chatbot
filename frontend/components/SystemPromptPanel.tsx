"use client";

import { useEffect, useState } from "react";
import { api, type PromptPreset } from "@/lib/api";

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
          : "Set this before sending your first message to a new conversation."}
      </p>

      <textarea
        value={draftPrompt}
        onChange={(e) => onDraftChange(e.target.value)}
        rows={8}
        placeholder="You are a helpful assistant answering questions using the provided document context..."
        className="mt-3 w-full resize-y rounded-lg border border-line bg-surface px-3 py-2 text-sm text-parchment outline-none placeholder:text-parchmentDim/60 focus:border-brass"
      />

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
