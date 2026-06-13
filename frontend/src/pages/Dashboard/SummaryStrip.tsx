// Faixa de métricas-resumo do dia — migrado de static/dashboard.jsx (MetricCard + SummaryStrip).

import type { Metrics } from "../../lib/props";

function MetricCard({
  label,
  value,
  sub,
  color = "#e8e8f0",
  accent,
}: {
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
  accent?: string;
}) {
  return (
    <div
      style={{
        flex: 1,
        minWidth: 0,
        padding: "14px 18px",
        background: "#1a1a23",
        border: "1px solid #2a2a38",
        borderRadius: 8,
        position: "relative",
        overflow: "hidden",
      }}
    >
      {accent && <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, background: accent }} />}
      <div
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 9.5,
          color: "#5a5a72",
          textTransform: "uppercase",
          letterSpacing: 1,
          marginBottom: 8,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 26,
          fontWeight: 700,
          color,
          lineHeight: 1,
          letterSpacing: -0.5,
        }}
      >
        {value}
      </div>
      {sub && (
        <div
          style={{ fontFamily: "'Inter Tight', sans-serif", fontSize: 11.5, color: "#5a5a72", marginTop: 6, letterSpacing: 0 }}
        >
          {sub}
        </div>
      )}
    </div>
  );
}

export function SummaryStrip({ metrics }: { metrics: Metrics }) {
  return (
    <div style={{ display: "flex", gap: 12 }}>
      <MetricCard label="Props analisadas" value={metrics.total} sub="props no resultado filtrado" />
      <MetricCard
        label="EV Positivo"
        value={metrics.evPositiveCount}
        sub={`${metrics.total ? ((metrics.evPositiveCount / metrics.total) * 100).toFixed(0) : 0}% do total`}
        color="#4ade80"
        accent="#22c55e"
      />
      <MetricCard label="Strong Bets" value={metrics.strong} sub="EV ≥ 8% e prob ≥ 60%" color="#a5b4fc" accent="#6366f1" />
      <MetricCard
        label="EV médio (positivos)"
        value={`${metrics.avgEv.toFixed(1)}%`}
        sub="apenas props com EV > 0"
        color="#4ade80"
        accent="#22c55e"
      />
    </div>
  );
}
