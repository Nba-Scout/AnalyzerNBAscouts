// Botão "Atualizar" com countdown — migrado de static/dashboard.jsx::RefreshCountdown.
//
// Em vez do setInterval + NBA_DATA.init() do legado, agora:
//   - clique manual → useRefresh() (POST /api/refresh, enfileira análise no worker;
//     o onSuccess invalida props+status).
//   - ao zerar o countdown → invalida as props (refetch do snapshot que o cron mantém).
// O próprio useProps já tem refetchInterval de 5min; o countdown é o reflexo visual disso.

import { useCallback, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { queryKeys, useRefresh } from "../../api/queries";

const INTERVAL = 300;

export function RefreshCountdown() {
  const qc = useQueryClient();
  const refresh = useRefresh();
  const [secs, setSecs] = useState(INTERVAL);
  const refreshing = refresh.isPending;

  const doRefresh = useCallback(() => {
    if (refresh.isPending) return;
    refresh.mutate();
    setSecs(INTERVAL);
  }, [refresh]);

  useEffect(() => {
    const id = setInterval(() => {
      setSecs((s) => {
        if (s <= 1) {
          void qc.invalidateQueries({ queryKey: queryKeys.props });
          return INTERVAL;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [qc]);

  const mm = String(Math.floor(secs / 60)).padStart(2, "0");
  const ss = String(secs % 60).padStart(2, "0");

  return (
    <button
      onClick={doRefresh}
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
