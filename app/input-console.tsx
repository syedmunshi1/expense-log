"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { processInput, type ProcessResult } from "./actions";
import { formatAmount } from "@/lib/currency";

// Minimal subset of the Web Speech API we actually use.
// (TypeScript doesn't ship types for it.)
type SpeechRecognitionAlternative = { transcript: string; confidence: number };
type SpeechRecognitionResult = { 0: SpeechRecognitionAlternative; isFinal: boolean };
type SpeechRecognitionResultList = {
  length: number;
  [index: number]: SpeechRecognitionResult;
};
type SpeechRecognitionEvent = {
  resultIndex: number;
  results: SpeechRecognitionResultList;
};
type SpeechRecognitionErrorEvent = { error: string };
type SpeechRecognitionInstance = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: SpeechRecognitionEvent) => void) | null;
  onerror: ((e: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

function getSpeechRecognitionCtor():
  | (new () => SpeechRecognitionInstance)
  | null {
  if (typeof window === "undefined") return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any;
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function InputConsole({ currency }: { currency: string }) {
  const [text, setText] = useState("");
  const [listening, setListening] = useState(false);
  const [micSupported, setMicSupported] = useState(false);
  const [result, setResult] = useState<ProcessResult | null>(null);
  const [isPending, startTransition] = useTransition();
  const recogRef = useRef<SpeechRecognitionInstance | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMicSupported(getSpeechRecognitionCtor() !== null);
  }, []);

  const submit = useCallback(
    (value: string) => {
      const v = value.trim();
      if (!v) return;
      startTransition(async () => {
        const res = await processInput(v);
        setResult(res);
        if (res.kind === "logged") {
          setText("");
          inputRef.current?.focus();
        }
      });
    },
    [],
  );

  const toggleMic = useCallback(() => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) return;

    if (listening && recogRef.current) {
      recogRef.current.stop();
      return;
    }

    const recog = new Ctor();
    recog.lang = navigator.language || "en-US";
    recog.continuous = false;
    recog.interimResults = true;
    let finalTranscript = "";
    recog.onresult = (event) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const r = event.results[i];
        if (r.isFinal) finalTranscript += r[0].transcript;
        else interim += r[0].transcript;
      }
      setText((prev) => {
        // Replace text entirely during a listening session for a clean UX.
        // Use finalTranscript when available, else the interim.
        return (finalTranscript + interim).trimStart() || prev;
      });
    };
    recog.onerror = () => {
      setListening(false);
    };
    recog.onend = () => {
      setListening(false);
      recogRef.current = null;
      // If we captured something, auto-submit.
      const captured = finalTranscript.trim();
      if (captured) submit(captured);
    };
    recogRef.current = recog;
    setListening(true);
    try {
      recog.start();
    } catch {
      setListening(false);
    }
  }, [listening, submit]);

  return (
    <div className="flex flex-col gap-3">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(text);
        }}
        className="flex flex-col gap-2"
      >
        <input
          ref={inputRef}
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder='Try "lunch 250" or "how much did I spend on food this week?"'
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-base outline-none focus:border-[var(--accent)]"
          disabled={isPending}
          autoFocus
        />
        <div className="flex items-center gap-2">
          <button
            type="submit"
            disabled={isPending || !text.trim()}
            className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {isPending ? "Working…" : "Submit"}
          </button>
          {micSupported && (
            <button
              type="button"
              onClick={toggleMic}
              aria-pressed={listening}
              className={`rounded-lg border border-[var(--border)] px-3 py-2 text-sm ${
                listening
                  ? "bg-[var(--danger)] text-white"
                  : "bg-[var(--card)]"
              }`}
            >
              {listening ? "◼ Stop" : "🎤 Speak"}
            </button>
          )}
          {!micSupported && (
            <span className="text-xs text-[var(--muted)]">
              (Voice not supported in this browser)
            </span>
          )}
        </div>
      </form>

      {result && <ResultCard result={result} currency={currency} />}
    </div>
  );
}

function ResultCard({
  result,
  currency,
}: {
  result: ProcessResult;
  currency: string;
}) {
  if (result.kind === "error") {
    return (
      <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-sm text-[var(--danger)]">
        {result.message}
      </div>
    );
  }
  if (result.kind === "logged") {
    const e = result.expense;
    return (
      <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-sm">
        <span className="text-[var(--success)]">✅ Logged</span>{" "}
        <span className="font-mono">{formatAmount(e.amount, currency)}</span>
        {" · "}
        {e.category} · {e.description} · {e.date}
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-sm">
      <p>{result.message}</p>
      <p className="mt-1 text-xs text-[var(--muted)]">
        {result.count} matching expense{result.count === 1 ? "" : "s"}
      </p>
    </div>
  );
}
