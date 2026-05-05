import { getExpensesByMonth, getCurrency } from "@/lib/db";
import { HistoryList } from "@/app/fluid/history/history-list";
import { deleteExpense } from "@/app/demo/actions";

const DEMO_USER = "demo";
export const dynamic = "force-dynamic";

export default async function DemoHistoryPage() {
  const [groups, currency] = await Promise.all([
    getExpensesByMonth(DEMO_USER),
    getCurrency(DEMO_USER),
  ]);

  return (
    <div>
      <div style={{ padding: "16px 20px 0" }}>
        <h1
          style={{
            fontFamily: "var(--font-jakarta), sans-serif",
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
          Shared demo expenses — visible to all visitors.
        </p>
      </div>
      <HistoryList groups={groups} currency={currency} deleteExpenseAction={deleteExpense} />
    </div>
  );
}
