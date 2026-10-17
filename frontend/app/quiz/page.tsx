"use client";

import { useEffect, useState } from "react";
import { api, type Conversation, type DocumentItem, type QuizQuestion } from "@/lib/api";
import { LANGUAGES, useLanguage, type Language } from "@/lib/language";
import Sidebar from "@/components/Sidebar";
import SourceViewer from "@/components/SourceViewer";

const QUESTION_COUNTS = [3, 5, 10];

function scoreMessage(score: number, total: number) {
  const pct = score / total;
  if (pct === 1) return "Perfect score! 🏆";
  if (pct >= 0.7) return "Great job! 🎉";
  if (pct >= 0.4) return "Not bad. Review the explanations and try again. 📖";
  return "Keep studying, then take a new quiz. 💪";
}

export default function QuizPage() {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [convosLoading, setConvosLoading] = useState(true);

  const [documentId, setDocumentId] = useState<string>("");
  const [count, setCount] = useState(5);
  const [language, setLanguage] = useLanguage();

  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  // Chosen option per question; undefined = not answered yet
  const [picked, setPicked] = useState<(number | undefined)[]>([]);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openChunkId, setOpenChunkId] = useState<string | null>(null);

  useEffect(() => {
    api
      .listDocuments()
      .then((docs) => setDocuments(docs.filter((d) => d.status === "ready")))
      .catch(() => setDocuments([]));
    api
      .listConversations()
      .then(setConversations)
      .finally(() => setConvosLoading(false));
  }, []);

  async function generate() {
    setGenerating(true);
    setError(null);
    setQuestions([]);
    setPicked([]);
    try {
      const quiz = await api.createQuiz(documentId || null, count, language);
      setQuestions(quiz.questions);
      setPicked(quiz.questions.map(() => undefined));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't make a quiz.");
    } finally {
      setGenerating(false);
    }
  }

  const answered = picked.filter((p) => p !== undefined).length;
  const score = questions.filter((q, i) => picked[i] === q.answer_index).length;
  const finished = questions.length > 0 && answered === questions.length;

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
          <h2 className="font-serif text-2xl text-parchment">Quiz</h2>
          <p className="mt-1 text-sm text-parchmentDim">
            Test yourself: the bot writes multiple-choice questions from your own documents.
          </p>

          <div className="mt-6 flex flex-wrap items-end gap-3 rounded-xl border border-line bg-panel/40 p-4">
            <label className="flex min-w-[12rem] flex-1 flex-col gap-1 text-xs text-parchmentDim">
              Document
              <select
                value={documentId}
                onChange={(e) => setDocumentId(e.target.value)}
                className="rounded-md border border-line bg-surface px-2 py-2 text-sm text-parchment outline-none focus:border-brass"
              >
                <option value="">All documents</option>
                {documents.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.filename}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-parchmentDim">
              Questions
              <select
                value={count}
                onChange={(e) => setCount(Number(e.target.value))}
                className="rounded-md border border-line bg-surface px-2 py-2 text-sm text-parchment outline-none focus:border-brass"
              >
                {QUESTION_COUNTS.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-parchmentDim">
              Language
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value as Language)}
                className="rounded-md border border-line bg-surface px-2 py-2 text-sm text-parchment outline-none focus:border-brass"
              >
                {LANGUAGES.map((l) => (
                  <option key={l.value} value={l.value}>
                    {l.label}
                  </option>
                ))}
              </select>
            </label>
            <button
              onClick={generate}
              disabled={generating || documents.length === 0}
              className="rounded-md bg-brass px-4 py-2 text-sm font-medium text-ink transition disabled:cursor-not-allowed disabled:opacity-40"
            >
              {generating ? "Writing questions…" : questions.length ? "New quiz" : "Start quiz"}
            </button>
          </div>

          {documents.length === 0 && (
            <p className="mt-4 text-sm text-parchmentDim">
              No ready documents yet. Upload a file on the Documents page first.
            </p>
          )}
          {generating && (
            <p className="mt-4 text-sm text-parchmentDim">
              Reading your documents and writing questions. This can take a minute on a local model…
            </p>
          )}
          {error && (
            <div className="mt-4 rounded-md border border-error/40 bg-error/10 px-4 py-2 text-sm text-error">
              {error}
            </div>
          )}

          {questions.length > 0 && (
            <div className="sticky top-0 z-10 mt-6 flex items-center justify-between rounded-lg border border-line bg-panel px-4 py-3 text-sm">
              <span className="text-parchmentDim">
                Answered {answered} / {questions.length}
              </span>
              <span className="font-serif text-lg text-brass">
                Score: {score} / {questions.length}
              </span>
            </div>
          )}

          {finished && (
            <div className="mt-4 rounded-xl border border-brass/50 bg-brass/10 px-5 py-4 text-center">
              <p className="font-serif text-xl text-parchment">
                {score} / {questions.length} correct
              </p>
              <p className="mt-1 text-sm text-parchmentDim">{scoreMessage(score, questions.length)}</p>
            </div>
          )}

          <ol className="mt-6 space-y-5">
            {questions.map((q, qi) => {
              const choice = picked[qi];
              const done = choice !== undefined;
              return (
                <li key={qi} className="rounded-xl border border-line/70 bg-panel/40 p-5">
                  <p dir="auto" className="text-parchment">
                    <span className="mr-2 text-brass">{qi + 1}.</span>
                    {q.question}
                  </p>
                  <div className="mt-3 grid gap-2">
                    {q.options.map((opt, oi) => {
                      const isRight = oi === q.answer_index;
                      const isChosen = oi === choice;
                      let style = "border-line hover:border-brass hover:bg-surface";
                      if (done && isRight) style = "border-green-500/70 bg-green-500/10";
                      else if (done && isChosen) style = "border-error bg-error/10";
                      else if (done) style = "border-line opacity-60";
                      return (
                        <button
                          key={oi}
                          disabled={done}
                          dir="auto"
                          onClick={() => setPicked((prev) => prev.map((p, i) => (i === qi ? oi : p)))}
                          className={`rounded-lg border px-4 py-2.5 text-left text-sm text-parchment transition ${style}`}
                        >
                          <span className="mr-2 text-parchmentDim">{"ABCDEF"[oi]}.</span>
                          {opt}
                          {done && isRight && <span className="ml-2">✓</span>}
                          {done && isChosen && !isRight && <span className="ml-2">✗</span>}
                        </button>
                      );
                    })}
                  </div>
                  {done && (
                    <div className="mt-3 text-sm">
                      <p className={choice === q.answer_index ? "text-green-500/90" : "text-error"}>
                        {choice === q.answer_index ? "Correct!" : "Not quite."}
                      </p>
                      {q.explanation && (
                        <p dir="auto" className="mt-1 text-parchmentDim">
                          {q.explanation}
                        </p>
                      )}
                      <button
                        onClick={() => setOpenChunkId(q.chunk_id)}
                        className="mt-2 text-xs text-brass hover:underline"
                      >
                        See it in {q.filename} ↗
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      </main>

      {openChunkId && <SourceViewer chunkId={openChunkId} onClose={() => setOpenChunkId(null)} />}
    </div>
  );
}
