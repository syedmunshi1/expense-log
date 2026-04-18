"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { ArrowUp, Mic, MicOff, CircleCheck, Sparkles } from "lucide-react";
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
  "lunch 250",
  "auto 340 yesterday",
  "groceries 1200 at dmart",
  "how much on food this week?",
  "total for this month",
];

type Message =
  | { id: number; role: "user"; text: string }
  | { id: number; role: "assistant"; result: ProcessResult };

export function InputConsole({ currency }: { currency: string }) {
  const [text, setText] = useState("");
  const [listening, setListening] = useState(false);
  const [micSupported, setMicSupported] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isPending, startTransition] = useTransition();
  const [placeholderIdx, setPlaceholderIdx] = useState(0);
  const recogRef = useRef<SpeechRecognitionInstance | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listEndRef = useRef<HTMLDivElement>(null);
  const idRef = useRef(0);

  useEffect(() => {
    setMicSupported(getSpeechRecognitionCtor() !== null);
  }, []);

  useEffect(() => {
    const t = setInterval(() => {
      setPlaceholderIdx((i) => (i + 1) % EXAMPLES.length);
    }, 3200);
    return () => clearInterval(t);
  }, []);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages.length > 0) {
      listEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [messages.length, isPending]);

  const submit = useCallback((value: string) => {
    const v = value.trim();
    if (!v) return;

    const userId = ++idRef.current;
    setMessages((prev) => [...prev, { id: userId, role: "user", text: v }]);
    setText("");

    startTransition(async () => {
      const res = await processInput(v);
      const assistantId = ++idRef.current;
      setMessages((prev) => [
        ...prev,
        { id: assistantId, role: "assistant", result: res },
      ]);
      inputRef.current?.focus();
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
      setText(() => (finalTranscript + interim).trimStart());
    };
    recog.onerror = () => setListening(false);
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
      {/* Conversation thread */}
      {messages.length > 0 && (
        <div className="flex flex-col gap-2">
          {messages.map((m) =>
            m.role === "user" ? (
              <UserBubble key={m.id} text={m.text} />
            ) : (
              <AssistantBubble
                key={m.id}
                result={m.result}
                currency={currency}
              />
            ),
          )}
          {isPending && <TypingBubble />}
          <div ref={listEndRef} />
        </div>
      )}

      {/* Input bar */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(text);
        }}
      >
        <div className="hero-input-wrap">
          <div className="flex items-center gap-2 rounded-[1.1rem] bg-[color:var(--bg-elevated)] pl-1 pr-1">
            <input
              ref={inputRef}
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={placeholder}
              className="hero-input !py-3"
              style={{ background: "transparent" }}
              disabled={isPending}
              autoFocus
              aria-label="Message input"
            />
            {micSupported && (
              <button
                type="button"
                onClick={toggleMic}
                aria-pressed={listening}
                aria-label={listening ? "Stop recording" : "Start voice input"}
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition ${
                  listening
                    ? "mic-listening"
                    : "text-[color:var(--fg-secondary)] hover:bg-[color:var(--border)]"
                }`}
              >
                {listening ? <MicOff size={18} /> : <Mic size={18} />}
              </button>
            )}
            <button
              type="submit"
              disabled={isPending || !text.trim()}
              aria-label="Send"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[color:var(--accent)] text-white transition hover:bg-[color:var(--accent-hover)] disabled:opacity-40"
            >
              {isPending ? <span className="spinner" /> : <ArrowUp size={18} />}
            </button>
          </div>
        </div>
      </form>

      {!micSupported && (
        <p className="text-center text-xs text-[color:var(--muted)]">
          Voice input not supported in this browser — typing works fine.
        </p>
      )}

      {messages.length === 0 && (
        <div className="mt-1 flex flex-wrap gap-1.5">
          {["lunch 250", "coffee 80 yesterday", "total this week"].map(
            (ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => submit(ex)}
                className="pill border border-[color:var(--border)] bg-[color:var(--bg-elevated)] text-[color:var(--fg-secondary)] transition hover:border-[color:var(--accent)] hover:text-[color:var(--accent)]"
              >
                <Sparkles size={10} /> {ex}
              </button>
            ),
          )}
        </div>
      )}
    </div>
  );
}

function UserBubble({ text }: { text: string }) {
  return (
    <div className="flex justify-end">
      <div
        className="row-enter max-w-[85%] rounded-2xl rounded-br-md px-4 py-2.5 text-sm"
        style={{
          background: "var(--gradient-hero)",
          color: "#fff",
          boxShadow: "var(--shadow-sm)",
        }}
      >
        {text}
      </div>
    </div>
  );
}

function TypingBubble() {
  return (
    <div className="flex justify-start">
      <div className="card flex items-center gap-1 px-4 py-3">
        <span className="typing-dot" />
        <span className="typing-dot" style={{ animationDelay: "150ms" }} />
        <span className="typing-dot" style={{ animationDelay: "300ms" }} />
      </div>
    </div>
  );
}

function AssistantBubble({
  result,
  currency,
}: {
  result: ProcessResult;
  currency: string;
}) {
  if (result.kind === "error") {
    return (
      <div className="flex justify-start">
        <div className="card row-enter max-w-[85%] px-4 py-2.5 text-sm">
          {result.message}
        </div>
      </div>
    );
  }
  if (result.kind === "logged") {
    const e = result.expense;
    const v = visualFor(e.category);
    return (
      <div className="flex justify-start">
        <div className="card-gradient row-enter flex max-w-[85%] items-center gap-3 px-4 py-3">
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
      </div>
    );
  }
  // summary
  const expenses = result.kind === "summary" ? (result.expenses ?? []) : [];
  return (
    <div className="flex justify-start" style={{ maxWidth: "92%" }}>
      <div className="card row-enter w-full px-4 py-3 text-sm leading-relaxed">
        <p className={expenses.length > 0 ? "mb-3" : ""}>{result.message}</p>
        {expenses.length > 0 && (
          <div className="flex flex-col gap-1.5">
            {expenses.slice(0, 15).map((e) => {
              const v = visualFor(e.category);
              const dateLabel = new Date(e.date + "T00:00:00").toLocaleDateString(
                "en-US",
                { month: "short", day: "numeric" },
              );
              return (
                <div
                  key={e.id}
                  className="flex items-center gap-2.5 rounded-xl px-3 py-2"
                  style={{ background: "var(--bg-elevated)" }}
                >
                  <div
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                    style={{ background: v.bg }}
                  >
                    <CategoryIcon name={v.icon} size={13} color={v.color} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-semibold capitalize text-[color:var(--fg)]">
                      {e.description}
                    </div>
                    <div className="text-[11px] text-[color:var(--muted)]">
                      {dateLabel} · {e.category}
                    </div>
                  </div>
                  <div className="shrink-0 font-mono text-xs font-bold tabular-nums text-[color:var(--fg)]">
                    {formatAmount(e.amount, currency)}
                  </div>
                </div>
              );
            })}
            {expenses.length > 15 && (
              <p className="pt-1 text-center text-[11px] text-[color:var(--muted)]">
                +{expenses.length - 15} more
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
