// Painel de sparklines multi-stat no hero (abas PTS/REB/AST) — tokenizado (Etapa 4).

import { useState } from "react";

import { Sparkline } from "../../components/atoms";
import { cn } from "../../lib/cn";

export function HeroSparkPanel({ ptsSpark, rebSpark, astSpark }: { ptsSpark: number[]; rebSpark: number[]; astSpark: number[] }) {
  const [activeTab, setActiveTab] = useState("PTS");
  const tabs = [
    { key: "PTS", data: ptsSpark, color: "var(--c-accent)" },
    { key: "REB", data: rebSpark, color: "var(--c-ev-strong)" },
    { key: "AST", data: astSpark, color: "var(--c-info)" },
  ];
  const active = tabs.find((t) => t.key === activeTab);
  const data = active && active.data && active.data.length > 0 ? active.data : null;

  return (
    <div className="min-w-[190px] flex-shrink-0 rounded-lg border border-border bg-canvas p-3.5">
      <div className="mb-2.5 flex gap-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={cn(
              "flex-1 rounded-sm border px-0 py-1 font-mono text-[9.5px] font-semibold uppercase tracking-wide transition-colors cursor-pointer",
              activeTab === t.key
                ? "border-accent/45 bg-accent/15 text-accent"
                : "border-border text-fg-subtle hover:text-fg-muted",
            )}
          >
            {t.key}
          </button>
        ))}
      </div>
      <Sparkline data={data || [0]} color={active ? active.color : "var(--c-accent)"} w={155} h={28} />
      <div className="mt-1 flex justify-between font-mono text-[10px] text-fg-muted tabular-nums">
        {data ? (
          <>
            <span>min {Math.min(...data)}</span>
            <span>μ {(data.reduce((a, b) => a + b, 0) / data.length).toFixed(1)}</span>
            <span>max {Math.max(...data)}</span>
          </>
        ) : (
          <span className="text-fg-subtle">—</span>
        )}
      </div>
    </div>
  );
}
