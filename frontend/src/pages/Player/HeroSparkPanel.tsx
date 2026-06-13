// Painel de sparklines multi-stat no hero do jogador (abas PTS/REB/AST) — de static/player.jsx.

import { useState } from "react";

import { Sparkline } from "../../components/atoms";

export function HeroSparkPanel({ ptsSpark, rebSpark, astSpark }: { ptsSpark: number[]; rebSpark: number[]; astSpark: number[] }) {
  const [activeTab, setActiveTab] = useState("PTS");
  const tabs = [
    { key: "PTS", data: ptsSpark, color: "#6366f1" },
    { key: "REB", data: rebSpark, color: "#22c55e" },
    { key: "AST", data: astSpark, color: "#f59e0b" },
  ];
  const active = tabs.find((t) => t.key === activeTab);
  const data = active && active.data && active.data.length > 0 ? active.data : null;

  return (
    <div
      style={{
        padding: "12px 14px",
        borderRadius: 8,
        background: "#0f0f13",
        border: "1px solid #2a2a38",
        minWidth: 190,
        flexShrink: 0,
      }}
    >
      <div style={{ display: "flex", gap: 4, marginBottom: 10 }}>
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            style={{
              flex: 1,
              padding: "3px 0",
              borderRadius: 4,
              background: activeTab === t.key ? "rgba(99,102,241,0.18)" : "transparent",
              border: `1px solid ${activeTab === t.key ? "rgba(99,102,241,0.45)" : "#2a2a38"}`,
              color: activeTab === t.key ? "#c7d2fe" : "#5a5a72",
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 9.5,
              fontWeight: 600,
              cursor: "pointer",
              transition: "all .12s",
              textTransform: "uppercase",
              letterSpacing: 0.5,
            }}
          >
            {t.key}
          </button>
        ))}
      </div>
      <Sparkline data={data || [0]} color={active ? active.color : "#6366f1"} w={155} h={28} />
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginTop: 4,
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 10,
          color: "#8888a0",
        }}
      >
        {data ? (
          <>
            <span>min {Math.min(...data)}</span>
            <span>μ {(data.reduce((a, b) => a + b, 0) / data.length).toFixed(1)}</span>
            <span>max {Math.max(...data)}</span>
          </>
        ) : (
          <span style={{ color: "#3a3a4a" }}>—</span>
        )}
      </div>
    </div>
  );
}
