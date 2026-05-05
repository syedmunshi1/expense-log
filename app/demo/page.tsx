import { getCurrency, getStats } from "@/lib/db";
import { formatAmount } from "@/lib/currency";
import { FluidChat } from "@/app/fluid/fluid-chat";
import { processInput } from "./actions";

const DEMO_USER = "demo";
export const dynamic = "force-dynamic";

export default async function DemoPage() {
  const [currency, stats] = await Promise.all([
    getCurrency(DEMO_USER),
    getStats(DEMO_USER),
  ]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100dvh - 108px)" }}>
      <div style={{ padding: "12px 20px 4px", background: "#f8fafa" }}>
        <span
          style={{
            fontFamily: "var(--font-jakarta), sans-serif",
            fontWeight: 700,
            fontSize: "17px",
            color: "#2d3435",
          }}
        >
          The Fluid Ledger
        </span>
      </div>

      <div style={{ padding: "4px 20px 16px" }}>
        <p style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", color: "#596061", textTransform: "uppercase", marginBottom: "4px" }}>
          Demo Month Spend
        </p>
        <p style={{ fontFamily: "var(--font-jakarta), sans-serif", fontSize: "36px", fontWeight: 800, color: "#2d3435", lineHeight: 1.1, letterSpacing: "-0.02em" }}>
          {formatAmount(stats.month, currency)}
        </p>
      </div>

      <FluidChat currency={currency} processInputAction={processInput} />
    </div>
  );
}
