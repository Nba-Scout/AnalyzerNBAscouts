// Abas de categoria das props do jogador (Todos/Simples/Combos) — tokenizado (Etapa 4).

import { useState } from "react";

import { EmptyState, Pill } from "../../components/ui";
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

  return (
    <div>
      <div className="mb-3 flex gap-1.5">
        {PROP_CATEGORIES.map((c) => {
          const count = c.markets ? props.filter((p) => c.markets!.has(p.market)).length : props.length;
          return (
            <Pill key={c.key} active={activeTab === c.key} onClick={() => setActiveTab(c.key)}>
              {c.label}
              {count > 0 && <span className="ml-1.5 text-[10px] opacity-70">{count}</span>}
            </Pill>
          );
        })}
      </div>
      {visible.length > 0 ? (
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((p, i) => (
            <PlayerPropCard key={i} prop={p} oddMode={oddMode} kellyMode={kellyMode} recentGames={recentGames} />
          ))}
        </div>
      ) : (
        <EmptyState title="Nenhum prop nessa categoria" />
      )}
    </div>
  );
}
