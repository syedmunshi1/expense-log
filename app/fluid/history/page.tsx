import { Settings } from "lucide-react";
import Link from "next/link";
import { getExpensesByMonth, getCurrency } from "@/lib/db";
import { HistoryList } from "./history-list";

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

      <HistoryList groups={groups} currency={currency} />
    </div>
  );
}
