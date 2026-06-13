// Variação C — editorial split: Strong Bets em destaque + tabela com o restante.
// Migrado de static/dashboard.jsx.

import { type ReactNode } from "react";

import { FeaturedCard } from "./FeaturedCard";
import { PropsTableTerminal } from "./PropsTableTerminal";
import { type SortHandlers, type ViewProps } from "./shared";

function SectionLabel({ children }: { children: ReactNode }) {
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

export function PropsEditorial({
  props,
  onPlayer,
  oddMode,
  kellyMode,
  bankroll = 0,
  sortBy,
  sortDir,
  onSort,
}: ViewProps & Partial<SortHandlers>) {
  const featured = props.filter((p) => p.rating === "STRONG").slice(0, 3);
  const rest = props.filter((p) => !featured.includes(p));

  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr)", gap: 18 }}>
      {featured.length > 0 && (
        <div>
          <SectionLabel>Strong Bets em destaque</SectionLabel>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 }}>
            {featured.map((p, i) => (
              <FeaturedCard key={i} prop={p} onPlayer={onPlayer} oddMode={oddMode} kellyMode={kellyMode} />
            ))}
          </div>
        </div>
      )}
      <div>
        <SectionLabel>Demais oportunidades</SectionLabel>
        <PropsTableTerminal
          props={rest}
          onPlayer={onPlayer}
          oddMode={oddMode}
          kellyMode={kellyMode}
          bankroll={bankroll}
          sortBy={sortBy}
          sortDir={sortDir}
          onSort={onSort}
        />
      </div>
    </div>
  );
}
