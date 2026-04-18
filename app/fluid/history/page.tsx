import { Settings } from "lucide-react";
import Link from "next/link";
import { getExpensesByMonth, getCurrency } from "@/lib/db";
import { formatAmount } from "@/lib/currency";
import { visualFor } from "@/lib/categories";
import { CategoryIcon } from "@/app/category-icon";

export const dynamic = "force-dynamic";

export default async function HistoryPage() {
  const [groups, currency] = await Promise.all([
    getExpensesByMonth(),
    getCurrency(),
  ]);

  return (
    <div>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "16px 20px 12px",
        }}
      >
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: "50%",
            background: "#eaefef",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "18px",
          }}
        >
          👤
        </div>
        <span
          style={{
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontWeight: 700,
            fontSize: "17px",
            color: "#2d3435",
          }}
        >
          The Fluid Ledger
        </span>
        <Link href="/settings" style={{ color: "#596061" }}>
          <Settings size={22} />
        </Link>
      </div>

      <div style={{ padding: "8px 20px 0" }}>
        <h1
          style={{
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontSize: "36px",
            fontWeight: 800,
            color: "#2d3435",
            letterSpacing: "-0.02em",
            lineHeight: 1.1,
          }}
        >
          History
        </h1>
        <p style={{ fontSize: "14px", color: "#596061", marginTop: "4px" }}>
          Your recent chronological feed.
        </p>
      </div>

      {groups.length === 0 ? (
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
      ) : (
        groups.map((group) => (
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

            <div style={{ padding: "8px 20px" }}>
              {group.expenses.map((e) => {
                const v = visualFor(e.category);
                const amt = parseFloat(e.amount);
                const dateLabel = new Date(e.date + "T00:00:00").toLocaleDateString(
                  "en-US",
                  { month: "short", day: "numeric" },
                );
                return (
                  <div
                    key={e.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "16px",
                      padding: "16px 0",
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
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
