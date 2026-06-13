// Abas de categoria das props do jogador (Todos/Simples/Combos) — de static/player.jsx.

import { type CSSProperties, useState } from "react";

import { type KellyMode, type OddMode } from "../../lib/format";
import type { Prop, RecentGame } from "../../types/api";
import { PlayerPropCard } from "./PlayerPropCard";

interface Category {
  key: string;
  label: string;
  markets: Set<string> | null;
}

const PROP_CATEGORIES: Category[] = [
  { key: "ALL", label: "Todos", markets: null },
  { key: "SIMPLE", label: "Simples", markets: new Set(["PTS", "REB", "AST", "FG3M", "BLK", "STL"]) },
  { key: "COMBO", label: "Combos", markets: new Set(["PRA", "PR", "PA", "RA", "STOCKS"]) },
];

export function PropsTabs({
  props,
  oddMode,
  kellyMode,
  recentGames,
}: {
  props: Prop[];
  oddMode: OddMode;
  kellyMode: KellyMode;
  recentGames: RecentGame[];
}) {
  const [activeTab, setActiveTab] = useState("ALL");
  const cat = PROP_CATEGORIES.find((c) => c.key === activeTab);
  const visible = cat && cat.markets ? props.filter((p) => cat.markets!.has(p.market)) : props;

  const tabStyle = (key: string): CSSProperties => ({
    padding: "5px 14px",
    borderRadius: 20,
    background: activeTab === key ? "rgba(99,102,241,0.2)" : "transparent",
    border: `1px solid ${activeTab === key ? "rgba(99,102,241,0.55)" : "#2a2a38"}`,
    color: activeTab === key ? "#c7d2fe" : "#8888a0",
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 11.5,
    fontWeight: activeTab === key ? 600 : 400,
    cursor: "pointer",
    transition: "all .12s",
  });

  return (
    <div>
      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
        {PROP_CATEGORIES.map((c) => {
          const count = c.markets ? props.filter((p) => c.markets!.has(p.market)).length : props.length;
          return (
            <button key={c.key} onClick={() => setActiveTab(c.key)} style={tabStyle(c.key)}>
              {c.label}
              {count > 0 && <span style={{ marginLeft: 6, fontSize: 10, opacity: 0.7 }}>{count}</span>}
            </button>
          );
        })}
      </div>
      {visible.length > 0 ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 10 }}>
          {visible.map((p, i) => (
            <PlayerPropCard key={i} prop={p} oddMode={oddMode} kellyMode={kellyMode} recentGames={recentGames} />
          ))}
        </div>
      ) : (
        <div
          style={{
            padding: 32,
            textAlign: "center",
            color: "#3a3a4a",
            fontFamily: "'Inter Tight', sans-serif",
            background: "#141419",
            border: "1px dashed #2a2a38",
            borderRadius: 8,
          }}
        >
          Nenhum prop nessa categoria
        </div>
      )}
    </div>
  );
}
