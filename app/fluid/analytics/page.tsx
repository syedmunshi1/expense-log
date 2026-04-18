import { TrendingUp, TrendingDown } from "lucide-react";
import { getAnalytics, getCurrency } from "@/lib/db";
import { formatAmount } from "@/lib/currency";
import { visualFor } from "@/lib/categories";
import { CategoryIcon } from "@/app/category-icon";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  const [analytics, currency] = await Promise.all([getAnalytics(), getCurrency()]);
  const {
    monthTotal,
    prevMonthTotal,
    topCategory,
    dailyAverage,
    weeklyTotals,
    categoryBreakdown,
  } = analytics;

  const changeVsPrev =
    prevMonthTotal > 0
      ? Math.round(((monthTotal - prevMonthTotal) / prevMonthTotal) * 100)
      : null;
  const maxWeek = Math.max(1, ...weeklyTotals.map((w) => w.amount));

  return (
    <div style={{ padding: "16px 20px 24px" }}>
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
        Analytics
      </h1>
      <p style={{ fontSize: "14px", color: "#596061", marginTop: "4px", marginBottom: "24px" }}>
        Your financial dialogue, visualised.
      </p>

      {/* Stat cards */}
      <StatCard label="TOTAL SPENT THIS MONTH">
        <div style={{ display: "flex", alignItems: "baseline", gap: "4px" }}>
          <span
            style={{
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              fontSize: "34px",
              fontWeight: 800,
              color: "#2d3435",
              letterSpacing: "-0.02em",
            }}
          >
            {formatAmount(monthTotal, currency)}
          </span>
        </div>
        {changeVsPrev !== null && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "4px",
              marginTop: "4px",
              fontSize: "13px",
              fontWeight: 600,
              color: changeVsPrev > 0 ? "#a83836" : "#006f1d",
            }}
          >
            {changeVsPrev > 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
            {changeVsPrev > 0 ? "+" : ""}{changeVsPrev}% vs last month
          </div>
        )}
      </StatCard>

      {topCategory && (
        <StatCard label="MOST EXPENSIVE CATEGORY">
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "2px" }}>
            {(() => {
              const v = visualFor(topCategory.name);
              return (
                <>
                  <CategoryIcon name={v.icon} size={20} color="#006a6a" />
                  <span
                    style={{
                      fontFamily: "'Plus Jakarta Sans', sans-serif",
                      fontSize: "20px",
                      fontWeight: 800,
                      color: "#006a6a",
                    }}
                  >
                    {topCategory.name}
                  </span>
                </>
              );
            })()}
          </div>
          <p style={{ fontSize: "15px", color: "#596061", marginTop: "4px" }}>
            {formatAmount(topCategory.amount, currency)}
          </p>
        </StatCard>
      )}

      <StatCard label="DAILY AVERAGE">
        <div
          style={{
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontSize: "34px",
            fontWeight: 800,
            color: "#2d3435",
            letterSpacing: "-0.02em",
          }}
        >
          {formatAmount(dailyAverage, currency)}
        </div>
        <p style={{ fontSize: "13px", color: "#596061", marginTop: "2px" }}>
          Based on {new Date().getDate()} day{new Date().getDate() !== 1 ? "s" : ""}
        </p>
      </StatCard>

      {/* Weekly bar chart */}
      <div
        style={{
          background: "#ffffff",
          borderRadius: "20px",
          padding: "20px",
          marginBottom: "16px",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: "20px",
          }}
        >
          <h2
            style={{
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              fontWeight: 800,
              fontSize: "18px",
              color: "#2d3435",
            }}
          >
            Weekly Totals
          </h2>
          <div
            style={{
              background: "#006a6a",
              color: "#e0fffe",
              borderRadius: "999px",
              padding: "4px 14px",
              fontSize: "13px",
              fontWeight: 600,
            }}
          >
            Month
          </div>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            gap: "12px",
            height: "120px",
          }}
        >
          {weeklyTotals.map((w, i) => {
            const pct = maxWeek > 0 ? (w.amount / maxWeek) * 100 : 0;
            const isMax = w.amount === maxWeek && w.amount > 0;
            return (
              <div
                key={w.label}
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "8px",
                  height: "100%",
                  justifyContent: "flex-end",
                }}
              >
                <div
                  style={{
                    width: "100%",
                    height: `${Math.max(pct, 4)}%`,
                    background: isMax ? "#006a6a" : "#dde4e4",
                    borderRadius: "8px 8px 0 0",
                    transition: "height 0.4s ease",
                  }}
                />
                <span
                  style={{
                    fontSize: "12px",
                    fontWeight: 600,
                    color: isMax ? "#006a6a" : "#596061",
                  }}
                >
                  {w.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* By Category */}
      {categoryBreakdown.length > 0 && (
        <div
          style={{
            background: "#ffffff",
            borderRadius: "20px",
            padding: "20px",
          }}
        >
          <h2
            style={{
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              fontWeight: 800,
              fontSize: "18px",
              color: "#2d3435",
              marginBottom: "16px",
            }}
          >
            By Category
          </h2>

          {/* Simple ring */}
          <div style={{ textAlign: "center", marginBottom: "16px" }}>
            <p style={{ fontSize: "11px", color: "#596061", letterSpacing: "0.06em", textTransform: "uppercase" }}>
              Top
            </p>
            <p
              style={{
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                fontSize: "22px",
                fontWeight: 800,
                color: "#006a6a",
              }}
            >
              {categoryBreakdown[0]?.name}
            </p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            {categoryBreakdown.map((c) => {
              const v = visualFor(c.name);
              return (
                <div key={c.name}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: "6px",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <CategoryIcon name={v.icon} size={14} color={v.color} />
                      <span style={{ fontSize: "14px", fontWeight: 600, color: "#2d3435" }}>
                        {c.name}
                      </span>
                    </div>
                    <span style={{ fontSize: "14px", fontWeight: 700, color: "#596061" }}>
                      {c.pct}%
                    </span>
                  </div>
                  <div
                    style={{
                      height: "6px",
                      background: "#eaefef",
                      borderRadius: "999px",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: `${c.pct}%`,
                        background: v.color,
                        borderRadius: "999px",
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: "#f0f4f4",
        borderRadius: "20px",
        padding: "16px 20px",
        marginBottom: "12px",
      }}
    >
      <p
        style={{
          fontSize: "11px",
          fontWeight: 700,
          letterSpacing: "0.1em",
          color: "#596061",
          textTransform: "uppercase",
          marginBottom: "6px",
        }}
      >
        {label}
      </p>
      {children}
    </div>
  );
}
