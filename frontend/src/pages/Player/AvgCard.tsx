// Card de média com sparkline — migrado de static/player.jsx::AvgCard.

import { Sparkline } from "../../components/atoms";

const STAT_COLORS: Record<string, string> = {
  PTS: "#6366f1",
  REB: "#22c55e",
  AST: "#f59e0b",
  PRA: "#8b5cf6",
  "P+R": "#3b82f6",
  "P+A": "#06b6d4",
  "3PM": "#ec4899",
  STOCKS: "#f97316",
};

export function AvgCard({ label, value, sub, spark }: { label: string; value: number; sub?: string; spark?: number[] }) {
  const color = STAT_COLORS[label] || "#6366f1";
  return (
    <div
      style={{
        padding: "12px 14px",
        background: "#1a1a23",
        border: "1px solid #2a2a38",
        borderRadius: 8,
        position: "relative",
        overflow: "hidden",
        transition: "border-color .15s",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#3a3a4a")}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#2a2a38")}
    >
      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 2, background: color, opacity: 0.6 }} />
      <div
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 9,
          color: "#5a5a72",
          textTransform: "uppercase",
          letterSpacing: 1,
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 8 }}>
        <div
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 23,
            fontWeight: 700,
            color: "#e8e8f0",
            lineHeight: 1,
            letterSpacing: -0.5,
          }}
        >
          {Number(value).toFixed(1)}
        </div>
        {spark && spark.length > 0 && <Sparkline data={spark} color={color} w={52} h={20} />}
      </div>
      {sub && (
        <div style={{ fontSize: 9.5, color: "#5a5a72", marginTop: 5, fontFamily: "'JetBrains Mono', monospace" }}>{sub}</div>
      )}
    </div>
  );
}
