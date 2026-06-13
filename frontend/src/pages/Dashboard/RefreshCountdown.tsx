// Botão "Atualizar" com countdown — migrado de static/dashboard.jsx::RefreshCountdown.
//
// O refetch periódico é responsabilidade do `useProps` (refetchInterval 5min). Aqui
// o countdown é puramente VISUAL: deriva de `dataUpdatedAt` do query, então fica em
// sincronia com o refetch real (quando os dados atualizam, o contador zera sozinho).
// O clique manual enfileira uma análise no worker (POST /api/refresh via useRefresh).

import { useEffect, useState } from "react";

import { useProps, useRefresh } from "../../api/queries";

const INTERVAL = 300; // segundos — espelha o refetchInterval do useProps

export function RefreshCountdown() {
  const { dataUpdatedAt } = useProps();
  const refresh = useRefresh();
  const [now, setNow] = useState(() => Date.now());
  const refreshing = refresh.isPending;

  // Tick só para atualizar o display do contador (não dispara fetch).
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const elapsed = dataUpdatedAt ? Math.floor((now - dataUpdatedAt) / 1000) : 0;
  const secs = Math.max(0, INTERVAL - elapsed);
  const mm = String(Math.floor(secs / 60)).padStart(2, "0");
  const ss = String(secs % 60).padStart(2, "0");

  return (
    <button
      onClick={() => {
        if (!refreshing) refresh.mutate();
      }}
      disabled={refreshing}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        flexShrink: 0,
        whiteSpace: "nowrap",
        padding: "7px 14px",
        borderRadius: 6,
        background: refreshing ? "rgba(99,102,241,0.45)" : "#6366f1",
        border: "1px solid #4f46e5",
        color: "#fff",
        fontFamily: "'Inter Tight', sans-serif",
        fontSize: 13,
        fontWeight: 600,
        cursor: refreshing ? "default" : "pointer",
        transition: "background .15s",
      }}
    >
      <svg
        width="13"
        height="13"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={refreshing ? { animation: "spin 0.7s linear infinite" } : undefined}
      >
        <path d="M21 12a9 9 0 0 1-9 9c-2.4 0-4.6-.94-6.2-2.5" />
        <path d="M3 12a9 9 0 0 1 9-9c2.4 0 4.6.94 6.2 2.5" />
        <path d="M21 5v4h-4M3 19v-4h4" />
      </svg>
      {refreshing ? (
        "Buscando…"
      ) : (
        <>
          <span>Atualizar</span>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, opacity: 0.65, marginLeft: 2 }}>
            {mm}:{ss}
          </span>
        </>
      )}
    </button>
  );
}
