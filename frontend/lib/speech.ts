/**
 * Voice in and out with the browser's own Web Speech API: free, no keys.
 * Speech-to-text works in Chrome and Edge (they send the audio to their
 * own servers, so it needs internet). Text-to-speech works everywhere.
 */

type Recognition = any;

function recognitionClass(): Recognition | null {
  if (typeof window === "undefined") return null;
  const w = window as any;
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export function canListen() {
  return recognitionClass() !== null;
}

export function canSpeak() {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

/** Listens once. Calls onText with the live transcript and onEnd when done. */
export function listen(
  lang: string,
  handlers: { onText: (text: string, final: boolean) => void; onEnd: () => void; onError: (msg: string) => void }
) {
  const Cls = recognitionClass();
  if (!Cls) {
    handlers.onError("Voice input needs Chrome or Edge.");
    handlers.onEnd();
    return () => {};
  }
  const rec: Recognition = new Cls();
  rec.lang = lang;
  rec.interimResults = true;
  rec.continuous = false;

  rec.onresult = (e: Recognition) => {
    let text = "";
    let final = false;
    for (let i = 0; i < e.results.length; i++) {
      text += e.results[i][0].transcript;
      final = e.results[i].isFinal;
    }
    handlers.onText(text, final);
  };
  rec.onerror = (e: Recognition) => {
    if (e.error === "no-speech" || e.error === "aborted") return;
    handlers.onError(
      e.error === "not-allowed" ? "Microphone permission was blocked." : `Voice input error: ${e.error}`
    );
  };
  rec.onend = handlers.onEnd;
  rec.start();
  return () => rec.stop();
}

/** Markdown and [Source N] labels sound awful read aloud, so strip them. */
function plainText(markdown: string) {
  return markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/\[Source \d+\]/gi, "")
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[*_#>`|~]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function pickVoice(lang: string) {
  const voices = window.speechSynthesis.getVoices();
  const base = lang.split("-")[0];
  return voices.find((v) => v.lang.replace("_", "-") === lang) || voices.find((v) => v.lang.startsWith(base)) || null;
}

export function speak(text: string, lang: string, onEnd?: () => void) {
  if (!canSpeak()) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(plainText(text));
  utterance.lang = lang;
  const voice = pickVoice(lang);
  if (voice) utterance.voice = voice;
  utterance.onend = () => onEnd?.();
  utterance.onerror = () => onEnd?.();
  window.speechSynthesis.speak(utterance);
}

export function stopSpeaking() {
  if (canSpeak()) window.speechSynthesis.cancel();
}
