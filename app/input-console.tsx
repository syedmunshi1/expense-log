"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { ArrowRight, Mic, MicOff, Sparkles, CircleCheck, AlertCircle } from "lucide-react";
import { processInput, type ProcessResult } from "./actions";
import { formatAmount } from "@/lib/currency";
import { visualFor } from "@/lib/categories";
import { CategoryIcon } from "./category-icon";

// Minimal Web Speech API types
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

const EXAMPLES = [
  'lunch 250',
  'auto 340 yesterday',
  'groceries 1200 at dmart',
  'how much did I spend on food this week?',
  'total for this month',
];

export function InputConsole({ currency }: { currency: string }) {
  const [text, setText] = useState("");
  const [listening, setListening] = useState(false);
  const [micSupported, setMicSupported] = useState(false);
  const [result, setResult] = useState<ProcessResult | null>(null);
  const [isPending, startTransition] = useTransition();
  const [placeholderIdx, setPlaceholderIdx] = useState(0);
  const recogRef = useRef<SpeechRecognitionInstance | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMicSupported(getSpeechRecognitionCtor() !== null);
  }, []);

  // Rotate placeholder examples
  useEffect(() => {
    const t = setInterval(() => {
      setPlaceholderIdx((i) => (i + 1) % EXAMPLES.length);
    }, 3200);
    return () => clearInterval(t);
  }, []);

  const submit = useCallback((value: string) => {
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
  }, []);

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
        return (finalTranscript + interim).trimStart() || prev;
      });
    };
    recog.onerror = () => {
      setListening(false);
    };
    recog.onend = () => {
      setListening(false);
      recogRef.current = null;
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

  const placeholder = listening
    ? "Listening…"
    : `Try "${EXAMPLES[placeholderIdx]}"`;

  return (
    <div className="flex flex-col gap-3">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(text);
        }}
        className="flex flex-col gap-2"
      >
        <div className="hero-input-wrap">
          <input
            ref={inputRef}
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={placeholder}
            className="hero-input"
            disabled={isPending}
            autoFocus
            aria-label="Expense input"
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            type="submit"
            disabled={isPending || !text.trim()}
            className="btn btn-primary flex-1 sm:flex-none"
          >
            {isPending ? (
              <>
                <span className="spinner" /> Working…
              </>
            ) : (
              <>
                <Sparkles size={14} />
                Submit
                <ArrowRight size={14} />
              </>
            )}
          </button>
          {micSupported && (
            <button
              type="button"
              onClick={toggleMic}
              aria-pressed={listening}
              aria-label={listening ? "Stop recording" : "Start voice input"}
              className={`btn btn-ghost ${listening ? "mic-listening" : ""}`}
            >
              {listening ? <MicOff size={16} /> : <Mic size={16} />}
              <span>{listening ? "Stop" : "Speak"}</span>
            </button>
          )}
        </div>
        {!micSupported && (
          <p className="text-xs text-[color:var(--muted)]">
            Voice input not supported in this browser — typing works fine.
          </p>
        )}
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
      <div className="card fade-in flex items-start gap-3 px-4 py-3">
        <AlertCircle
          size={18}
          className="mt-0.5 shrink-0"
          color="var(--danger)"
        />
        <div className="text-sm text-[color:var(--fg)]">{result.message}</div>
      </div>
    );
  }
  if (result.kind === "logged") {
    const e = result.expense;
    const v = visualFor(e.category);
    return (
      <div className="card-gradient fade-in flex items-center gap-3 px-4 py-3">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-xl"
          style={{ background: v.bg, color: v.color }}
        >
          <CategoryIcon name={v.icon} size={18} color={v.color} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-xs font-medium text-[color:var(--success)]">
            <CircleCheck size={12} /> Logged
          </div>
          <div className="mt-0.5 truncate text-sm font-medium capitalize">
            {e.description}
          </div>
          <div className="text-xs text-[color:var(--muted)]">
            {e.category} · {e.date}
          </div>
        </div>
        <div className="font-mono text-base font-semibold tabular-nums">
          {formatAmount(e.amount, currency)}
        </div>
      </div>
    );
  }
  return (
    <div className="card-gradient fade-in px-4 py-4">
      <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-[color:var(--accent)]">
        <Sparkles size={12} /> Summary
      </div>
      <p className="text-sm leading-relaxed text-[color:var(--fg)]">
        {result.message}
      </p>
      <p className="mt-2 text-xs text-[color:var(--muted)]">
        {result.count} matching expense{result.count === 1 ? "" : "s"}
      </p>
    </div>
  );
}
