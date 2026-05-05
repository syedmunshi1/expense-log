import { Settings } from "lucide-react";
import Link from "next/link";
import { getCurrency, getStats } from "@/lib/db";
import { formatAmount } from "@/lib/currency";
import { FluidChat } from "./fluid-chat";
import { auth } from "@/auth";
import { processInput } from "@/app/actions";

export const dynamic = "force-dynamic";

export default async function FluidHome() {
  const session = await auth();
  const userId = session?.user?.email ?? "";
  const [currency, stats] = await Promise.all([getCurrency(userId), getStats(userId)]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "16px 20px 12px",
          background: "#f8fafa",
        }}
      >
        {session?.user?.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={session.user.image}
            alt={session.user.name ?? "Profile"}
            style={{ width: 40, height: 40, borderRadius: "50%", objectFit: "cover" }}
          />
        ) : (
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
        )}
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
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <Link href="/settings" style={{ color: "#596061" }}>
            <Settings size={22} />
          </Link>
          {/* Toggle back to original UI */}
          <Link
            href="/"
            title="Switch to original UI"
            style={{
              fontSize: "11px",
              fontWeight: 600,
              color: "#006a6a",
              background: "#eaefef",
              padding: "4px 10px",
              borderRadius: "999px",
              textDecoration: "none",
              letterSpacing: "0.02em",
            }}
          >
            SWITCH UI
          </Link>
          <Link
            href="/demo"
            style={{
              fontSize: "11px",
              fontWeight: 600,
              color: "#596061",
              background: "#eaefef",
              padding: "4px 10px",
              borderRadius: "999px",
              textDecoration: "none",
            }}
          >
            DEMO
          </Link>
        </div>
      </div>

      {/* Monthly total */}
      <div style={{ padding: "8px 20px 20px" }}>
        <p
          style={{
            fontSize: "11px",
            fontWeight: 700,
            letterSpacing: "0.1em",
            color: "#596061",
            textTransform: "uppercase",
            marginBottom: "4px",
          }}
        >
          Total Month Spend
        </p>
        <p
          style={{
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontSize: "36px",
            fontWeight: 800,
            color: "#2d3435",
            lineHeight: 1.1,
            letterSpacing: "-0.02em",
          }}
        >
          {formatAmount(stats.month, currency)}
        </p>
      </div>

      {/* Chat area */}
      <FluidChat currency={currency} processInputAction={processInput} />
    </div>
  );
}
