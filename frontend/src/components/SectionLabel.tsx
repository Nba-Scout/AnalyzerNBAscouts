// Rótulo de seção com linha divisória — migrado de static/dashboard.jsx / player.jsx.

import { type ReactNode } from "react";

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        marginBottom: 10,
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 10.5,
        color: "#5a5a72",
        textTransform: "uppercase",
        letterSpacing: 1,
      }}
    >
      <span>{children}</span>
      <span style={{ flex: 1, height: 1, background: "#2a2a38" }} />
    </div>
  );
}
