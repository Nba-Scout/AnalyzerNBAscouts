// Botão-toggle "carteira" — adiciona a prop à carteira; clicar de novo REMOVE.
// Identidade da aposta = jogador+mercado+linha+direção+odd; mudar linha/odd cria
// outra entrada. Design (Fable): âmbar = camada de AÇÃO ("na carteira"), nunca
// verde — verde fica exclusivo do sinal de EV na linha. Hover no estado ativo
// troca ✓→✕ e drena a cor (comunica remoção sem roubar o vermelho de sinal).
// Glyphs em mono com largura fixa 1ch → zero layout shift entre estados.

import { type CSSProperties, useEffect, useRef, useState } from "react";
import { m } from "motion/react";

import { useAddBet, useBets, useDeleteBet } from "../api/queries";
import { findPendingDuplicate } from "../lib/bets";
import { cn } from "../lib/cn";
import type { Prop } from "../types/api";

type WalletProp = Pick<Prop, "player_name" | "market" | "line" | "direction" | "odd" | "ev_pct" | "kelly_pct">;

// Carteira minimalista (aba dobrada + fecho), stroke=currentColor — herda a cor
// do estado e rende idêntico em qualquer plataforma (diferente do emoji 💼).
const WALLET_ICON = (
  <svg
    width="12"
    height="12"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M19 7V6a1 1 0 0 0-1-1H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h14a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1H5a2 2 0 0 1-2-2" />
    <path d="M16 13.5h.01" />
  </svg>
);

const STATE_CLS: Record<string, string> = {
  idle: "border-border text-fg-subtle hover:border-accent/40 hover:bg-accent/12 hover:text-accent",
  in: "border-accent/40 bg-accent/12 text-accent hover:border-border-strong hover:bg-transparent hover:text-fg-muted",
  pending: "border-border text-fg-subtle cursor-wait pointer-events-none",
  failed: "border-signal-neg/40 text-signal-neg",
};

export function AddToWalletButton({ prop, style = {} }: { prop: WalletProp; style?: CSSProperties }) {
  const addBet = useAddBet();
  const deleteBet = useDeleteBet();
  const { data: bets } = useBets();
  const [failed, setFailed] = useState(false);
  const failTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (failTimer.current !== null) clearTimeout(failTimer.current);
    };
  }, []);

  // Falha transiente: pisca ~1.5s e volta ao estado normal.
  function flashFail() {
    setFailed(true);
    if (failTimer.current !== null) clearTimeout(failTimer.current);
    failTimer.current = setTimeout(() => setFailed(false), 1500);
  }

  // Aposta pendente idêntica já na carteira? → o clique vira "remover".
  const existing = findPendingDuplicate(bets, {
    player_name: prop.player_name,
    market_key: prop.market,
    line: prop.line,
    direction: prop.direction,
    odd_decimal: prop.odd,
  });
  const inWallet = existing !== undefined;
  const pending = addBet.isPending || deleteBet.isPending;
  const state = failed ? "failed" : pending ? "pending" : inWallet ? "in" : "idle";

  function toggle(e: React.MouseEvent) {
    e.stopPropagation();
    if (pending) return;
    if (inWallet && existing) {
      deleteBet.mutate(existing.id, { onError: flashFail });
      return;
    }
    addBet.mutate(
      {
        player_name: prop.player_name,
        market_key: prop.market,
        line: prop.line,
        direction: prop.direction,
        odd_decimal: prop.odd,
        ev_pct: prop.ev_pct,
        kelly_pct: prop.kelly_pct,
      },
      { onError: flashFail },
    );
  }

  return (
    <m.button
      type="button"
      onClick={toggle}
      aria-pressed={inWallet}
      title={inWallet ? "Na carteira — clique para remover" : "Adicionar à carteira"}
      whileTap={{ scale: 0.92 }}
      animate={failed ? { x: [0, -2, 2, -1, 1, 0] } : { x: 0 }}
      transition={{ duration: 0.25 }}
      style={style}
      className={cn(
        "group inline-flex h-5 items-center gap-1 rounded border px-1.5 align-middle font-mono text-[10px] leading-none select-none",
        "cursor-pointer transition-colors duration-150",
        STATE_CLS[state],
      )}
    >
      {WALLET_ICON}
      <m.span
        key={state}
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.12 }}
        className="w-[1ch] text-center"
        aria-hidden
      >
        {state === "idle" && "+"}
        {state === "in" && (
          <>
            <span className="group-hover:hidden">✓</span>
            <span className="hidden group-hover:inline">✕</span>
          </>
        )}
        {state === "pending" && (
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" className="animate-spin" aria-hidden>
            <circle
              cx="12"
              cy="12"
              r="9"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray="42"
              strokeDashoffset="14"
            />
          </svg>
        )}
        {state === "failed" && "!"}
      </m.span>
    </m.button>
  );
}
