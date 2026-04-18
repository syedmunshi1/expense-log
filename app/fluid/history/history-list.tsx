"use client";

import { useState, useTransition } from "react";
import { Trash2, AlertTriangle } from "lucide-react";
import { deleteExpense } from "@/app/actions";
import { formatAmount } from "@/lib/currency";
import { visualFor } from "@/lib/categories";
import { CategoryIcon } from "@/app/category-icon";
import type { MonthGroup } from "@/lib/db";

export function HistoryList({
  groups,
  currency,
}: {
  groups: MonthGroup[];
  currency: string;
}) {
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [removedIds, setRemovedIds] = useState<Set<number>>(new Set());
  const [, startTransition] = useTransition();

  function handleDeleteClick(id: number) {
    setConfirmId(id);
  }

  function handleCancel() {
    setConfirmId(null);
  }

  function handleConfirm(id: number) {
    setDeletingId(id);
    setConfirmId(null);
    startTransition(async () => {
      await deleteExpense(id);
      setRemovedIds((prev) => new Set([...prev, id]));
      setDeletingId(null);
    });
  }

  const visibleGroups = groups
    .map((g) => ({
      ...g,
      expenses: g.expenses.filter((e) => !removedIds.has(e.id)),
    }))
    .filter((g) => g.expenses.length > 0);

  if (visibleGroups.length === 0) {
    return (
      <div
        style={{
          textAlign: "center",
          padding: "60px 20px",
          color: "#596061",
          fontSize: "15px",
        }}
      >
        No expenses logged yet.
      </div>
    );
  }

  return (
    <>
      {visibleGroups.map((group) => (
        <div key={group.label}>
          {/* Month header */}
          <div
            style={{
              background: "#f0f4f4",
              padding: "10px 20px",
              marginTop: "20px",
            }}
          >
            <span
              style={{
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                fontWeight: 700,
                fontSize: "15px",
                color: "#006a6a",
              }}
            >
              {group.label}
            </span>
          </div>

          <div style={{ padding: "0 20px" }}>
            {group.expenses.map((e) => {
              const v = visualFor(e.category);
              const amt = parseFloat(e.amount);
              const dateLabel = new Date(
                e.date + "T00:00:00",
              ).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              });

              const isConfirming = confirmId === e.id;
              const isDeleting = deletingId === e.id;

              if (isConfirming) {
                return (
                  <div
                    key={e.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                      padding: "14px 16px",
                      margin: "8px 0",
                      borderRadius: "16px",
                      background: "#fff1f1",
                      border: "1px solid #fca5a5",
                    }}
                  >
                    <AlertTriangle size={18} color="#dc2626" />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: "13px",
                          fontWeight: 600,
                          color: "#dc2626",
                          marginBottom: "2px",
                        }}
                      >
                        Delete this expense?
                      </div>
                      <div
                        style={{
                          fontSize: "12px",
                          color: "#7f1d1d",
                          textTransform: "capitalize",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {e.description} · {formatAmount(amt, currency)}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
                      <button
                        onClick={handleCancel}
                        style={{
                          padding: "6px 14px",
                          borderRadius: "999px",
                          border: "1px solid #d1d5db",
                          background: "#fff",
                          color: "#596061",
                          fontSize: "13px",
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleConfirm(e.id)}
                        style={{
                          padding: "6px 14px",
                          borderRadius: "999px",
                          border: "none",
                          background: "#dc2626",
                          color: "#fff",
                          fontSize: "13px",
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={e.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "16px",
                    padding: "16px 0",
                    opacity: isDeleting ? 0.4 : 1,
                    transition: "opacity 300ms ease",
                    borderBottom: "1px solid #f0f4f4",
                  }}
                >
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: "50%",
                      background: v.bg,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <CategoryIcon name={v.icon} size={20} color={v.color} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontFamily: "'Plus Jakarta Sans', sans-serif",
                        fontWeight: 700,
                        fontSize: "15px",
                        color: "#2d3435",
                        textTransform: "capitalize",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {e.description}
                    </div>
                    <div
                      style={{
                        fontSize: "13px",
                        color: "#596061",
                        marginTop: "2px",
                      }}
                    >
                      {e.category} · {dateLabel}
                    </div>
                  </div>
                  <div
                    style={{
                      fontFamily: "'Plus Jakarta Sans', sans-serif",
                      fontWeight: 700,
                      fontSize: "15px",
                      color: "#2d3435",
                      flexShrink: 0,
                    }}
                  >
                    -{formatAmount(amt, currency)}
                  </div>
                  <button
                    onClick={() => handleDeleteClick(e.id)}
                    disabled={isDeleting}
                    aria-label={`Delete ${e.description}`}
                    style={{
                      flexShrink: 0,
                      width: 36,
                      height: 36,
                      borderRadius: "50%",
                      border: "none",
                      background: "transparent",
                      color: "#b0babb",
                      cursor: isDeleting ? "not-allowed" : "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      transition: "background 150ms ease, color 150ms ease",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.background =
                        "#fef2f2";
                      (e.currentTarget as HTMLButtonElement).style.color =
                        "#dc2626";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.background =
                        "transparent";
                      (e.currentTarget as HTMLButtonElement).style.color =
                        "#b0babb";
                    }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </>
  );
}
