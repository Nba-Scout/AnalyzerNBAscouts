// Variação B — grade de cards. Migrado de static/dashboard.jsx.

import { useState } from "react";

import type { Prop } from "../../types/api";
import { PropCard } from "./PropCard";
import { pageBtnStyle, type ViewProps } from "./shared";

const PAGE = 12;

export function PropsCards({ props, onPlayer, oddMode, kellyMode, bankroll = 0 }: ViewProps) {
  const [page, setPage] = useState(0);

  // Volta à 1ª página quando o conjunto de props muda (filtros/refetch) — ajuste
  // de estado durante o render (em vez de setState num effect; regra react-hooks).
  const [trackedProps, setTrackedProps] = useState<Prop[]>(props);
  if (trackedProps !== props) {
    setTrackedProps(props);
    setPage(0);
  }

  const pageData = props.slice(page * PAGE, (page + 1) * PAGE);
  const pageCount = Math.max(1, Math.ceil(props.length / PAGE));

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
        {pageData.map((p, i) => (
          <PropCard key={i} prop={p} onPlayer={onPlayer} oddMode={oddMode} kellyMode={kellyMode} bankroll={bankroll} />
        ))}
        {pageData.length === 0 && (
          <div
            style={{
              gridColumn: "1 / -1",
              padding: 60,
              textAlign: "center",
              color: "#5a5a72",
              fontFamily: "'Inter Tight', sans-serif",
              background: "#141419",
              border: "1px dashed #2a2a38",
              borderRadius: 8,
            }}
          >
            Nenhuma prop bate seus filtros.
          </div>
        )}
      </div>
      {pageCount > 1 && (
        <div
          style={{
            marginTop: 16,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 11,
            color: "#8888a0",
          }}
        >
          <span>
            Página {page + 1} de {pageCount} · {props.length} props
          </span>
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} style={pageBtnStyle(page === 0)}>
              ← Anterior
            </button>
            <button
              onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
              disabled={page >= pageCount - 1}
              style={pageBtnStyle(page >= pageCount - 1)}
            >
              Próxima →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
