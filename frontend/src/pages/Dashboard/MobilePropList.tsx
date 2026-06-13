// Lista empilhada de cards para telas estreitas — migrado de static/dashboard.jsx.

import { PropCard } from "./PropCard";
import type { ViewProps } from "./shared";

export function MobilePropList({ props, onPlayer, oddMode, kellyMode, bankroll = 0 }: ViewProps) {
  if (props.length === 0) {
    return (
      <div style={{ padding: 48, textAlign: "center", color: "#5a5a72", fontFamily: "'Inter Tight', sans-serif" }}>
        Nenhuma prop bate seus filtros.
      </div>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {props.map((p, i) => (
        <PropCard key={i} prop={p} onPlayer={onPlayer} oddMode={oddMode} kellyMode={kellyMode} bankroll={bankroll} />
      ))}
    </div>
  );
}
