import Link from "next/link";
import { FluidNav } from "@/app/fluid/fluid-nav";
import { Plus_Jakarta_Sans } from "next/font/google";

const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-jakarta" });

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={jakarta.variable} style={{ minHeight: "100dvh", background: "#f8fafa" }}>
      {/* Sticky demo banner */}
      <div
        style={{
          background: "#006a6a",
          color: "#e0fffe",
          padding: "10px 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          fontSize: "13px",
          fontWeight: 600,
          position: "sticky",
          top: 0,
          zIndex: 60,
        }}
      >
        <span>⚡ Demo — data is shared with everyone</span>
        <Link
          href="/login"
          style={{ color: "#e0fffe", textDecoration: "underline", whiteSpace: "nowrap" }}
        >
          Sign in →
        </Link>
      </div>

      <div style={{ paddingBottom: "72px" }}>{children}</div>

      {/* Nav tabs point to /demo/* routes */}
      <FluidNav basePath="/demo" />
    </div>
  );
}
