"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import { Send, Mic } from "lucide-react";
import { processInput, type ProcessResult } from "@/app/actions";
import { formatAmount } from "@/lib/currency";
import { visualFor } from "@/lib/categories";
import { CategoryIcon } from "@/app/category-icon";

// Web Speech API types
type SpeechRecognitionAlternative = { transcript: string };
type SpeechRecognitionResult = { 0: SpeechRecognitionAlternative; isFinal: boolean };
type SpeechRecognitionResultList = { length: number; [index: number]: SpeechRecognitionResult };
type SpeechRecognitionEvent = { resultIndex: number; results: SpeechRecognitionResultList };
type SpeechRecognitionInstance = {
  lang: string; continuous: boolean; interimResults: boolean;
  onresult: ((e: SpeechRecognitionEvent) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void; stop: () => void;
};

function getSpeechCtor(): (new () => SpeechRecognitionInstance) | null {
  if (typeof window === "undefined") return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any;
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

type Message =
  | { id: number; role: "user"; text: string; time: string }
  | { id: number; role: "assistant"; result: ProcessResult; time: string };

function nowTime() {
  return new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export function FluidChat({ currency }: { currency: string }) {
  const [text, setText] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isPending, startTransition] = useTransition();
  const [listening, setListening] = useState(false);
  const [interimText, setInterimText] = useState("");
  const recogRef = useRef<SpeechRecognitionInstance | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const idRef = useRef(0);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, isPending]);

  const submit = useCallback((value: string) => {
    const v = value.trim();
    if (!v) return;
    const time = nowTime();
    setMessages((prev) => [...prev, { id: ++idRef.current, role: "user", text: v, time }]);
    setText("");
    startTransition(async () => {
      const res = await processInput(v);
      setMessages((prev) => [
        ...prev,
        { id: ++idRef.current, role: "assistant", result: res, time: nowTime() },
      ]);
      inputRef.current?.focus();
    });
  }, []);

  const startListening = useCallback(() => {
    const Ctor = getSpeechCtor();
    if (!Ctor) return;
    const recog = new Ctor();
    recog.lang = navigator.language || "en-IN";
    recog.continuous = false;
    recog.interimResults = true;
    let final = "";
    recog.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) final += r[0].transcript;
        else interim += r[0].transcript;
      }
      setInterimText(interim || final);
    };
    recog.onerror = () => { setListening(false); setInterimText(""); };
    recog.onend = () => {
      setListening(false);
      setInterimText("");
      if (final.trim()) submit(final.trim());
    };
    recogRef.current = recog;
    setListening(true);
    setInterimText("");
    try { recog.start(); } catch { setListening(false); }
  }, [submit]);

  const stopListening = useCallback(() => {
    recogRef.current?.stop();
  }, []);

  return (
    <>
      {/* Voice overlay */}
      {listening && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "#f8fafa",
            zIndex: 100,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "24px",
          }}
        >
          <h2
            style={{
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              fontSize: "32px",
              fontWeight: 800,
              color: "#2d3435",
            }}
          >
            Listening…
          </h2>
          {interimText && (
            <p
              style={{
                fontSize: "16px",
                color: "#596061",
                maxWidth: "280px",
                textAlign: "center",
                fontStyle: "italic",
              }}
            >
              &ldquo;{interimText}&rdquo;
            </p>
          )}
          <div style={{ margin: "40px 0" }}>
            <button
              onClick={stopListening}
              style={{
                width: 96,
                height: 96,
                borderRadius: "50%",
                background: "linear-gradient(135deg, #006a6a 0%, #005d5d 100%)",
                border: "none",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#e0fffe",
                boxShadow: "0 0 0 16px rgba(0,106,106,0.12), 0 0 0 32px rgba(0,106,106,0.06)",
                animation: "pulse-ring 2s ease-in-out infinite",
              }}
            >
              <Mic size={36} />
            </button>
          </div>
          <button
            onClick={stopListening}
            style={{
              background: "none",
              border: "none",
              color: "#006a6a",
              fontSize: "16px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
        </div>
      )}

      {/* Messages */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "8px 16px 16px",
          display: "flex",
          flexDirection: "column",
          gap: "6px",
        }}
      >
        {messages.length === 0 && (
          <div
            style={{
              margin: "auto",
              textAlign: "center",
              color: "#596061",
              fontSize: "14px",
              paddingTop: "40px",
            }}
          >
            <p style={{ fontSize: "32px", marginBottom: "12px" }}>👋</p>
            <p style={{ fontWeight: 600, color: "#2d3435" }}>Hi! I&apos;m your Fluid Ledger.</p>
            <p style={{ marginTop: "4px" }}>Log an expense or ask me anything.</p>
            <div style={{ display: "flex", gap: "8px", justifyContent: "center", marginTop: "16px", flexWrap: "wrap" }}>
              {["lunch 250", "auto 340 yesterday", "this week?"].map((ex) => (
                <button
                  key={ex}
                  onClick={() => submit(ex)}
                  style={{
                    background: "#eaefef",
                    border: "none",
                    borderRadius: "999px",
                    padding: "6px 14px",
                    fontSize: "13px",
                    color: "#006a6a",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => {
          const prevMsg = i > 0 ? messages[i - 1] : null;
          const isNewGroup = !prevMsg || prevMsg.time !== m.time;

          return (
            <div key={m.id}>
              {isNewGroup && (
                <div
                  style={{
                    textAlign: "center",
                    fontSize: "11px",
                    color: "#757c7d",
                    margin: "12px 0 8px",
                    fontWeight: 500,
                  }}
                >
                  Today, {m.time}
                </div>
              )}
              {m.role === "user" ? (
                <UserBubble text={m.text} time={m.time} />
              ) : (
                <AssistantBubble result={m.result} time={m.time} currency={currency} />
              )}
            </div>
          );
        })}

        {isPending && (
          <div style={{ display: "flex", justifyContent: "flex-start", padding: "4px 0" }}>
            <div
              style={{
                background: "#c9e7f7",
                borderRadius: "24px 24px 24px 0",
                padding: "14px 18px",
                display: "flex",
                gap: "5px",
                alignItems: "center",
              }}
            >
              {[0, 150, 300].map((delay) => (
                <div
                  key={delay}
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    background: "#395663",
                    opacity: 0.5,
                    animation: `bounce 1.2s ease-in-out ${delay}ms infinite`,
                  }}
                />
              ))}
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div
        style={{
          padding: "12px 16px",
          background: "#f8fafa",
          display: "flex",
          gap: "10px",
          alignItems: "center",
        }}
      >
        <div
          style={{
            flex: 1,
            background: "#dde4e4",
            borderRadius: "999px",
            display: "flex",
            alignItems: "center",
            padding: "0 16px",
            height: "48px",
          }}
        >
          <input
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(text); } }}
            placeholder="Type an expense…"
            disabled={isPending}
            style={{
              flex: 1,
              background: "none",
              border: "none",
              outline: "none",
              fontSize: "15px",
              color: "#2d3435",
              fontFamily: "inherit",
            }}
          />
          <button
            onClick={() => submit(text)}
            disabled={!text.trim() || isPending}
            style={{
              background: "none",
              border: "none",
              cursor: text.trim() ? "pointer" : "default",
              color: text.trim() ? "#006a6a" : "#acb3b4",
              display: "flex",
              alignItems: "center",
              padding: "4px",
            }}
          >
            <Send size={18} />
          </button>
        </div>

        {/* Mic button */}
        <button
          onClick={startListening}
          style={{
            width: 48,
            height: 48,
            borderRadius: "50%",
            background: "linear-gradient(135deg, #006a6a 0%, #005d5d 100%)",
            border: "none",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#e0fffe",
            flexShrink: 0,
            boxShadow: "0 4px 12px rgba(0,106,106,0.3)",
          }}
        >
          <Mic size={20} />
        </button>
      </div>

      <style>{`
        @keyframes bounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
          30% { transform: translateY(-5px); opacity: 1; }
        }
        @keyframes pulse-ring {
          0%, 100% { box-shadow: 0 0 0 16px rgba(0,106,106,0.12), 0 0 0 32px rgba(0,106,106,0.06); }
          50% { box-shadow: 0 0 0 22px rgba(0,106,106,0.08), 0 0 0 44px rgba(0,106,106,0.03); }
        }
      `}</style>
    </>
  );
}

function UserBubble({ text }: { text: string; time: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "flex-end", padding: "3px 0" }}>
      <div
        style={{
          background: "linear-gradient(135deg, #006a6a 0%, #005d5d 100%)",
          color: "#e0fffe",
          borderRadius: "24px 24px 0 24px",
          padding: "12px 18px",
          maxWidth: "80%",
          fontSize: "15px",
          lineHeight: 1.5,
          fontWeight: 500,
        }}
      >
        {text}
      </div>
    </div>
  );
}

function AssistantBubble({ result, currency }: { result: ProcessResult; time: string; currency: string }) {
  if (result.kind === "error") {
    return (
      <div style={{ display: "flex", justifyContent: "flex-start", padding: "3px 0" }}>
        <div
          style={{
            background: "#c9e7f7",
            color: "#395663",
            borderRadius: "24px 24px 24px 0",
            padding: "12px 18px",
            maxWidth: "80%",
            fontSize: "15px",
            lineHeight: 1.5,
          }}
        >
          {result.message}
        </div>
      </div>
    );
  }

  if (result.kind === "logged") {
    const e = result.expense;
    const v = visualFor(e.category);
    return (
      <div style={{ display: "flex", justifyContent: "flex-start", padding: "3px 0" }}>
        <div
          style={{
            background: "#91f78e",
            color: "#004b10",
            borderRadius: "24px 24px 24px 0",
            padding: "14px 16px",
            maxWidth: "85%",
            fontSize: "15px",
          }}
        >
          <p style={{ fontWeight: 600, marginBottom: "10px" }}>
            Got it! Added {formatAmount(e.amount, currency)} for {e.category}.
          </p>
          {/* Mini expense card */}
          <div
            style={{
              background: "#ffffff",
              borderRadius: "16px",
              padding: "10px 14px",
              display: "flex",
              alignItems: "center",
              gap: "12px",
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: "50%",
                background: v.bg,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <CategoryIcon name={v.icon} size={16} color={v.color} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: "14px", color: "#2d3435", textTransform: "capitalize" }}>
                {e.description}
              </div>
              <div style={{ fontSize: "12px", color: "#596061" }}>{e.category}</div>
            </div>
            <div style={{ fontWeight: 700, fontSize: "15px", color: "#2d3435" }}>
              -{formatAmount(e.amount, currency)}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // summary
  return (
    <div style={{ display: "flex", justifyContent: "flex-start", padding: "3px 0" }}>
      <div
        style={{
          background: "#c9e7f7",
          color: "#395663",
          borderRadius: "24px 24px 24px 0",
          padding: "14px 18px",
          maxWidth: "85%",
          fontSize: "15px",
          lineHeight: 1.6,
        }}
      >
        {result.message}
      </div>
    </div>
  );
}
