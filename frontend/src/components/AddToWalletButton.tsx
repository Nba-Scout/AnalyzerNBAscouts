// Botão "+ carteira" — adiciona a prop direto à carteira (bet tracker) via useAddBet.
// Espelha a API do StarButton (prop + style opcional). O stake fica 0 e o usuário
// ajusta depois na página da carteira; os demais campos vêm da própria prop.

import { type CSSProperties, useEffect, useRef, useState } from "react";

import { useAddBet } from "../api/queries";
import type { Prop } from "../types/api";

type WalletProp = Pick<Prop, "player_name" | "market" | "line" | "direction" | "odd" | "ev_pct" | "kelly_pct">;

export function AddToWalletButton({ prop, style = {} }: { prop: WalletProp; style?: CSSProperties }) {
  const addBet = useAddBet();
  const [hover, setHover] = useState(false);
  const [justAdded, setJustAdded] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current !== null) clearTimeout(timer.current);
    };
  }, []);

  const failed = addBet.isError && !justAdded;
  const color = failed ? "#f87171" : justAdded ? "#5ee2a0" : hover ? "#8888a0" : "#3a3a4a";
  const glyph = addBet.isPending ? "…" : justAdded ? "✓" : failed ? "!" : "+";
  const title = failed ? "Falha ao adicionar — tentar de novo" : justAdded ? "Adicionado à carteira" : "Adicionar à carteira";

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        if (addBet.isPending) return;
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
          {
            onSuccess: () => {
              setJustAdded(true);
              if (timer.current !== null) clearTimeout(timer.current);
              timer.current = setTimeout(() => setJustAdded(false), 1600);
            },
          },
        );
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      disabled={addBet.isPending}
      title={title}
      aria-label={title}
      style={{
        background: "none",
        border: "none",
        cursor: addBet.isPending ? "default" : "pointer",
        padding: "2px 5px",
        lineHeight: 1,
        fontSize: 15,
        fontWeight: 600,
        fontFamily: "ui-monospace, monospace",
        color,
        transition: "color .15s, transform .1s",
        transform: justAdded ? "scale(1.15)" : "scale(1)",
        ...style,
      }}
    >
      {glyph}
    </button>
  );
}
