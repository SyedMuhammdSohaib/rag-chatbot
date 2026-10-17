"use client";

import { useEffect, useState } from "react";
import { api, type Conversation, type Stats } from "@/lib/api";
import Sidebar from "@/components/Sidebar";

function Tile({ label, value, note }: { label: string; value: number | string; note?: string }) {
  return (
    <div className="rounded-xl border border-line/70 bg-panel/40 px-4 py-3">
      <p className="text-xs text-parchmentDim">{label}</p>
      <p className="mt-1 font-serif text-2xl text-parchment">{value}</p>
      {note && <p className="mt-0.5 text-xs text-parchmentDim">{note}</p>}
    </div>
  );
}

/** Questions per day: one series, so one hue and no legend. */
function DailyChart({ days }: { days: Stats["questions_per_day"] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...days.map((d) => d.count));
  const fmt = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" });

  return (
    <div>
      <div className="relative flex h-40 items-end gap-[2px] border-b border-line" onMouseLeave={() => setHover(null)}>
        {days.map((d, i) => (
          // The full-height column is the hover target; the bar inside is the mark
          <div
            key={d.date}
            onMouseEnter={() => setHover(i)}
            className="relative flex h-full flex-1 items-end"
            aria-label={`${fmt(d.date)}: ${d.count} questions`}
          >
            <div
              className={`w-full rounded-t-[4px] transition-opacity ${hover === null || hover === i ? "opacity-100" : "opacity-50"} bg-brass`}
              style={{ height: d.count ? `${Math.max(3, (d.count / max) * 100)}%` : "0" }}
            />
          </div>
        ))}
        {hover !== null && (
          <div
            className="pointer-events-none absolute -top-2 z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md border border-line bg-panel px-2 py-1 text-xs text-parchment shadow-lg"
            style={{ left: `${((hover + 0.5) / days.length) * 100}%` }}
          >
            {fmt(days[hover].date)} · <strong>{days[hover].count}</strong> question{days[hover].count === 1 ? "" : "s"}
          </div>
        )}
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-parchmentDim">
        <span>{fmt(days[0].date)}</span>
        <span>{fmt(days[days.length - 1].date)}</span>
      </div>
    </div>
  );
}

/** Horizontal bars with the value written at the end, so no axis is needed. */
function BarList({ rows }: { rows: { label: string; value: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => (
        <li key={r.label} title={`${r.label}: ${r.value}`}>
          <div className="flex justify-between gap-3 text-xs">
            <span className="truncate text-parchment">{r.label}</span>
            <span className="shrink-0 text-parchmentDim">{r.value}</span>
          </div>
          <div className="mt-1 h-2 rounded-r-[4px] bg-brass" style={{ width: `${(r.value / max) * 100}%` }} />
        </li>
      ))}
    </ul>
  );
}

export default function StatsPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [convosLoading, setConvosLoading] = useState(true);
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .listConversations()
      .then(setConversations)
      .finally(() => setConvosLoading(false));
    api
      .getStats()
      .then(setStats)
      .catch((e) => setError(e instanceof Error ? e.message : "Couldn't load stats."));
  }, []);

  const cachePct = stats && stats.answers ? Math.round((stats.cache_hits / stats.answers) * 100) : 0;

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
        <div className="mx-auto max-w-4xl">
          <h2 className="font-serif text-2xl text-parchment">Stats</h2>
          <p className="mt-1 text-sm text-parchmentDim">How you've been using Reading Room.</p>

          {error && <p className="mt-6 text-sm text-error">{error}</p>}
          {!stats && !error && <p className="mt-6 text-sm text-parchmentDim">Loading…</p>}

          {stats && (
            <>
              <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                <Tile label="Questions asked" value={stats.questions} />
                <Tile label="Conversations" value={stats.conversations} />
                <Tile label="Documents" value={stats.documents} note={`${stats.chunks} chunks`} />
                <Tile label="Answered from cache" value={stats.cache_hits} note={`${cachePct}% of answers`} />
                <Tile
                  label="Ratings"
                  value={`👍 ${stats.models.reduce((n, m) => n + m.thumbs_up, 0)}  👎 ${stats.models.reduce((n, m) => n + m.thumbs_down, 0)}`}
                />
              </div>

              <section className="mt-8 rounded-xl border border-line/70 bg-panel/40 p-5">
                <h3 className="text-sm text-parchment">Questions per day</h3>
                <p className="mb-6 text-xs text-parchmentDim">Last {stats.questions_per_day.length} days</p>
                <DailyChart days={stats.questions_per_day} />
              </section>

              <div className="mt-6 grid gap-6 md:grid-cols-2">
                <section className="rounded-xl border border-line/70 bg-panel/40 p-5">
                  <h3 className="text-sm text-parchment">Most-used documents</h3>
                  <p className="mb-4 text-xs text-parchmentDim">Times a document was cited in an answer</p>
                  {stats.top_documents.length ? (
                    <BarList rows={stats.top_documents.map((d) => ({ label: d.filename, value: d.citations }))} />
                  ) : (
                    <p className="text-xs text-parchmentDim">No answers with sources yet.</p>
                  )}
                </section>

                <section className="rounded-xl border border-line/70 bg-panel/40 p-5">
                  <h3 className="text-sm text-parchment">Models</h3>
                  <p className="mb-4 text-xs text-parchmentDim">Who answered, and how you rated them</p>
                  {stats.models.length ? (
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-line text-parchmentDim">
                          <th className="pb-2 font-normal">Model</th>
                          <th className="pb-2 text-right font-normal">Answers</th>
                          <th className="pb-2 text-right font-normal">👍</th>
                          <th className="pb-2 text-right font-normal">👎</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stats.models.map((m) => (
                          <tr key={m.model} className="border-b border-line/40 text-parchment">
                            <td className="py-2 pr-2">{m.model === "cache" ? "⚡ cache" : m.model}</td>
                            <td className="py-2 text-right">{m.answers}</td>
                            <td className="py-2 text-right">{m.thumbs_up}</td>
                            <td className="py-2 text-right">{m.thumbs_down}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <p className="text-xs text-parchmentDim">No answers yet.</p>
                  )}
                </section>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
