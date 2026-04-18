import type { ReactNode } from "react";
import { FluidNav } from "./fluid-nav";

export default function FluidLayout({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        fontFamily: "'Plus Jakarta Sans', 'Manrope', system-ui, sans-serif",
        background: "#f8fafa",
        color: "#2d3435",
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div style={{ flex: 1, overflowY: "auto", paddingBottom: "80px" }}>
        {children}
      </div>
      <FluidNav />
    </div>
  );
}
