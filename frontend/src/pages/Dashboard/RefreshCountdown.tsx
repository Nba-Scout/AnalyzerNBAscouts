// Botão "Atualizar" com countdown — tokenizado (Etapa 3).
//
// O refetch periódico é do `useProps` (refetchInterval 5min). O countdown é VISUAL:
// deriva de `dataUpdatedAt` (zera sozinho quando os dados atualizam). O clique
// enfileira uma análise no worker (POST /api/refresh via useRefresh).

import { useEffect, useState } from "react";

import { useProps, useRefresh } from "../../api/queries";
import { Button } from "../../components/ui";

const INTERVAL = 300; // segundos — espelha o refetchInterval do useProps

export function RefreshCountdown() {
  const { dataUpdatedAt } = useProps();
  const refresh = useRefresh();
  const [now, setNow] = useState(() => Date.now());
  const refreshing = refresh.isPending;

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const elapsed = dataUpdatedAt ? Math.floor((now - dataUpdatedAt) / 1000) : 0;
  const secs = Math.max(0, INTERVAL - elapsed);
  const mm = String(Math.floor(secs / 60)).padStart(2, "0");
  const ss = String(secs % 60).padStart(2, "0");

  return (
    <Button variant="primary" onClick={() => !refreshing && refresh.mutate()} disabled={refreshing}>
      <svg
        width="13"
        height="13"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={refreshing ? "motion-safe:animate-spin" : undefined}
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
          <span className="ml-0.5 font-mono text-[10px] opacity-65 tabular-nums">
            {mm}:{ss}
          </span>
        </>
      )}
    </Button>
  );
}
