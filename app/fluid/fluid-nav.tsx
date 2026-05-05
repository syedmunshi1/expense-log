"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessageSquare, History, BarChart2 } from "lucide-react";

export function FluidNav({ basePath = "/fluid" }: { basePath?: string }) {
  const path = usePathname();

  const TABS = [
    { href: basePath, icon: MessageSquare, label: "Chat" },
    { href: `${basePath}/history`, icon: History, label: "History" },
    { href: `${basePath}/analytics`, icon: BarChart2, label: "Analytics" },
  ];

  return (
    <nav
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        background: "#f8fafa",
        borderTop: "1px solid #eaefef",
        display: "flex",
        justifyContent: "space-around",
        alignItems: "center",
        height: "72px",
        zIndex: 50,
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
    >
      {TABS.map(({ href, icon: Icon, label }) => {
        const active = path === href;
        return (
          <Link
            key={href}
            href={href}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "4px",
              padding: "8px 20px",
              borderRadius: "999px",
              background: active ? "#006a6a" : "transparent",
              color: active ? "#e0fffe" : "#596061",
              transition: "all 200ms ease",
              textDecoration: "none",
              minWidth: "64px",
            }}
          >
            <Icon size={22} />
            <span style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "0.03em" }}>
              {label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
