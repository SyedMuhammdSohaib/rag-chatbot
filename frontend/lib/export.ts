import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Message } from "./api";

function sourcesLine(m: Message) {
  const names = Array.from(new Set(m.sources.map((s) => s.filename)));
  return names.length ? `Sources: ${names.join(", ")}` : "";
}

function fileName(title: string, ext: string) {
  return `${title.replace(/[\\/:*?"<>|]+/g, " ").trim().slice(0, 80) || "conversation"}.${ext}`;
}

export function conversationMarkdown(title: string, messages: Message[]) {
  const parts = [`# ${title}`, `_Exported from Reading Room on ${new Date().toLocaleString()}_`];
  for (const m of messages) {
    if (m.role === "user") {
      parts.push(`## 🧑 ${m.content}`);
    } else {
      parts.push(m.content);
      const sources = sourcesLine(m);
      if (sources) parts.push(`> ${sources}`);
    }
  }
  return parts.join("\n\n") + "\n";
}

export function downloadMarkdown(title: string, messages: Message[]) {
  const blob = new Blob([conversationMarkdown(title, messages)], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName(title, "md");
  a.click();
  URL.revokeObjectURL(url);
}

function escapeHtml(text: string) {
  return text.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}

/** Opens a print-ready page; the browser's print dialog has "Save as PDF". */
export function printAsPdf(title: string, messages: Message[]) {
  const body = messages
    .map((m) => {
      if (m.role === "user") return `<h2 dir="auto">${escapeHtml(m.content)}</h2>`;
      const html = renderToStaticMarkup(createElement(ReactMarkdown, { remarkPlugins: [remarkGfm] }, m.content));
      const sources = sourcesLine(m);
      return `<div class="answer" dir="auto">${html}</div>${sources ? `<p class="sources">${escapeHtml(sources)}</p>` : ""}`;
    })
    .join("\n");

  const win = window.open("", "_blank");
  if (!win) {
    alert("Please allow pop-ups for this page to export a PDF.");
    return;
  }
  win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(fileName(title, "pdf"))}</title>
<style>
  body { font-family: Georgia, serif; color: #1d1b17; max-width: 720px; margin: 40px auto; padding: 0 20px; line-height: 1.55; }
  h1 { font-size: 24px; margin-bottom: 4px; }
  .meta { color: #6e6656; font-size: 12px; margin-bottom: 28px; }
  h2 { font-size: 16px; margin: 28px 0 8px; padding: 8px 12px; background: #f1ece1; border-radius: 6px; }
  .answer { font-size: 14px; }
  .sources { color: #6e6656; font-size: 11px; border-left: 3px solid #b08d57; padding-left: 8px; }
  pre, code { background: #f4f1ea; border-radius: 4px; }
  table { border-collapse: collapse; } td, th { border: 1px solid #ccc; padding: 4px 8px; }
</style></head><body>
<h1>${escapeHtml(title)}</h1><p class="meta">Exported from Reading Room on ${escapeHtml(new Date().toLocaleString())}</p>
${body}
<script>window.onload = () => window.print();</script>
</body></html>`);
  win.document.close();
}
