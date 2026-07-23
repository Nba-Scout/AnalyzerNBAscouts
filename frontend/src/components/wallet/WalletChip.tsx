// Chip da carteira no header — mostra saldo + ROI de relance; clicar abre um
// dropdown com o WalletPanel (saldo, tiles, abertas, liquidadas, ações).
// "Gerenciar banca" navega para a página completa da carteira (/bets).

import { useEffect, useRef, useState } from "react";

import { useBets } from "../../api/queries";
import { computeWallet } from "../../lib/bets";
import { cn } from "../../lib/cn";
import { exportBetsXls } from "../../lib/xls";
import { WalletPanel } from "./WalletPanel";

function WalletIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M20 7H5a2 2 0 0 1-2-2 2 2 0 0 1 2-2h13v4" />
      <path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-9a1 1 0 0 0-1-1" />
      <path d="M16 12h.01" />
    </svg>
  );
}

function brl(n: number): string {
  return `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function WalletChip({ bankroll, units = 100, onManage }: { bankroll: number; units?: number; onManage: () => void }) {
  const { data: bets } = useBets();
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  // Fecha ao clicar fora / Esc.
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const w = computeWallet(bets ?? []);
  const current = bankroll + w.pnl;
  const roiClass = w.roi > 0 ? "text-signal-pos" : w.roi < 0 ? "text-signal-neg" : "text-fg-subtle";

  return (
    <div ref={boxRef} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="dialog"
        title="Carteira"
        className={cn(
          "flex cursor-pointer items-center gap-2.5 rounded-md border px-2.5 py-1.5 transition-colors",
          open ? "border-border-strong bg-raised" : "border-border bg-surface hover:border-border-strong",
        )}
      >
        <span className="flex h-5 w-5 items-center justify-center rounded bg-accent/15 text-accent">
          <WalletIcon />
        </span>
        <span className="flex flex-col items-start leading-none">
          <span className="font-mono text-[12px] font-bold tabular-nums text-fg">{brl(current)}</span>
          <span className="mt-0.5 font-mono text-[8.5px] tracking-[0.14em] text-fg-subtle uppercase">Carteira</span>
        </span>
        {w.settled > 0 && (
          <span className={cn("rounded-sm bg-raised px-1 py-0.5 font-mono text-[10px] font-semibold tabular-nums", roiClass)}>
            {w.roi >= 0 ? "+" : ""}
            {w.roi.toFixed(1)}%
          </span>
        )}
        <span className={cn("font-mono text-[9px] text-fg-subtle transition-transform", open && "rotate-180")}>▾</span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Resumo da carteira"
          className="absolute right-0 z-30 mt-2 w-[340px] overflow-hidden rounded-xl border border-border-strong bg-surface shadow-lg"
        >
          <WalletPanel
            bets={bets ?? []}
            bankroll={bankroll}
            units={units}
            onManage={() => {
              setOpen(false);
              onManage();
            }}
            onExport={() => exportBetsXls(bets ?? [])}
          />
        </div>
      )}
    </div>
  );
}
