"use client";

import { useState, useTransition } from "react";
import { Trash2, AlertTriangle } from "lucide-react";
import { formatAmount } from "@/lib/currency";
import { visualFor } from "@/lib/categories";
import { CategoryIcon } from "./category-icon";
import type { Expense } from "@/lib/db";

function formatRelativeDate(iso: string): string {
  const today = new Date();
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, "0");
  const d = String(today.getDate()).padStart(2, "0");
  const todayISO = `${y}-${m}-${d}`;

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yestISO = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, "0")}-${String(yesterday.getDate()).padStart(2, "0")}`;

  if (iso === todayISO) return "Today";
  if (iso === yestISO) return "Yesterday";
  const date = new Date(iso + "T00:00:00");
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function RecentList({
  expenses: initial,
  currency,
  deleteExpenseAction,
}: {
  expenses: Expense[];
  currency: string;
  deleteExpenseAction: (id: number) => Promise<void>;
}) {
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [removedIds, setRemovedIds] = useState<Set<number>>(new Set());
  const [, startTransition] = useTransition();

  const expenses = initial.filter((e) => !removedIds.has(e.id));

  function handleConfirm(id: number) {
    setDeletingId(id);
    setConfirmId(null);
    startTransition(async () => {
      await deleteExpenseAction(id);
      setRemovedIds((prev) => new Set([...prev, id]));
      setDeletingId(null);
    });
  }

  if (expenses.length === 0) {
    return (
      <div className="card flex flex-col items-center gap-2 px-6 py-10 text-center">
        <p className="text-sm text-[color:var(--fg-secondary)]">
          No expenses yet.
        </p>
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {expenses.map((e, i) => {
        const v = visualFor(e.category);
        const isConfirming = confirmId === e.id;
        const isDeleting = deletingId === e.id;

        if (isConfirming) {
          return (
            <li
              key={e.id}
              className="card row-enter flex items-center gap-3 px-4 py-3"
              style={{
                background: "#fff1f1",
                border: "1px solid #fca5a5",
                animationDelay: `${i * 40}ms`,
              }}
            >
              <AlertTriangle
                size={18}
                color="#dc2626"
                style={{ flexShrink: 0 }}
              />
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold text-red-600">
                  Delete this expense?
                </div>
                <div className="truncate text-xs capitalize text-red-900">
                  {e.description} · {formatAmount(e.amount, currency)}
                </div>
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  onClick={() => setConfirmId(null)}
                  className="rounded-full border border-[color:var(--border)] bg-white px-3 py-1 text-xs font-semibold text-[color:var(--fg-secondary)] transition hover:bg-[color:var(--bg-elevated)]"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleConfirm(e.id)}
                  className="rounded-full bg-red-600 px-3 py-1 text-xs font-semibold text-white transition hover:bg-red-700"
                >
                  Delete
                </button>
              </div>
            </li>
          );
        }

        return (
          <li
            key={e.id}
            className="card row-enter flex items-center gap-3 px-4 py-3"
            style={{
              animationDelay: `${i * 40}ms`,
              opacity: isDeleting ? 0.4 : 1,
              transition: "opacity 300ms ease",
            }}
          >
            <div
              className="flex h-10 w-10 items-center justify-center rounded-xl"
              style={{ background: v.bg, color: v.color }}
            >
              <CategoryIcon name={v.icon} size={18} color={v.color} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium capitalize">
                {e.description}
              </div>
              <div className="mt-0.5 flex items-center gap-2 text-xs text-[color:var(--muted)]">
                <span>{formatRelativeDate(e.date)}</span>
                <span aria-hidden>·</span>
                <span>{e.category}</span>
              </div>
            </div>
            <div className="font-mono text-sm font-medium tabular-nums">
              {formatAmount(e.amount, currency)}
            </div>
            <button
              onClick={() => setConfirmId(e.id)}
              disabled={isDeleting}
              aria-label={`Delete ${e.description}`}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[color:var(--muted)] transition hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Trash2 size={15} />
            </button>
          </li>
        );
      })}
    </ul>
  );
}
