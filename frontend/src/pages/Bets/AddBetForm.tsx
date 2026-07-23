// Formulário de adição manual de aposta à carteira. Consome useAddBet.

import { type FormEvent, useState } from "react";

import { useAddBet, useBets } from "../../api/queries";
import { PlayerAutocomplete } from "../../components/PlayerAutocomplete";
import { Button } from "../../components/ui";
import { hasPendingDuplicate } from "../../lib/bets";
import { cn } from "../../lib/cn";
import { MARKETS } from "../../lib/teams";

const MARKET_OPTS = MARKETS.filter((m) => m.key !== "ALL");

const inputCls = "h-9 rounded-md border border-border bg-canvas px-2.5 font-mono text-sm text-fg placeholder:text-fg-subtle";
const labelCls = "font-mono text-[10px] uppercase tracking-[0.08em] text-fg-subtle";

export function AddBetForm({ onAdded }: { onAdded?: () => void }) {
  const addBet = useAddBet();
  const { data: bets } = useBets();
  const [player, setPlayer] = useState("");
  const [market, setMarket] = useState("PTS");
  const [line, setLine] = useState("");
  const [direction, setDirection] = useState<"OVER" | "UNDER">("OVER");
  const [odd, setOdd] = useState("");
  const [stake, setStake] = useState("");

  const dup = hasPendingDuplicate(bets, {
    player_name: player.trim(),
    market_key: market,
    line: Number(line),
    direction,
    odd_decimal: Number(odd),
  });
  const valid = Boolean(player.trim()) && Number(line) > 0 && Number(odd) > 1 && Number(stake) > 0 && !dup;

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!valid) return;
    addBet.mutate(
      {
        player_name: player.trim(),
        market_key: market,
        line: Number(line),
        direction,
        odd_decimal: Number(odd),
        stake: Number(stake),
      },
      {
        onSuccess: () => {
          setPlayer("");
          setLine("");
          setOdd("");
          setStake("");
          onAdded?.();
        },
      },
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-surface p-4">
      <label className="flex min-w-[160px] flex-1 flex-col gap-1">
        <span className={labelCls}>Jogador</span>
        <PlayerAutocomplete
          value={player}
          onChange={setPlayer}
          placeholder="Nikola Jokić"
          inputClassName={cn(inputCls, "w-full")}
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className={labelCls}>Mercado</span>
        <select className={cn(inputCls, "cursor-pointer")} value={market} onChange={(e) => setMarket(e.target.value)}>
          {MARKET_OPTS.map((m) => (
            <option key={m.key} value={m.key}>
              {m.label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex w-20 flex-col gap-1">
        <span className={labelCls}>Linha</span>
        <input
          className={inputCls}
          type="number"
          step="0.5"
          value={line}
          onChange={(e) => setLine(e.target.value)}
          placeholder="26.5"
        />
      </label>
      <div className="flex flex-col gap-1">
        <span className={labelCls}>Direção</span>
        <div className="flex h-9 overflow-hidden rounded-md border border-border">
          {(["OVER", "UNDER"] as const).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDirection(d)}
              className={cn(
                "px-3 font-mono text-xs font-semibold cursor-pointer transition-colors",
                direction === d ? "bg-accent text-accent-fg" : "bg-canvas text-fg-muted hover:text-fg",
              )}
            >
              {d === "OVER" ? "OVER" : "UNDER"}
            </button>
          ))}
        </div>
      </div>
      <label className="flex w-20 flex-col gap-1">
        <span className={labelCls}>Odd</span>
        <input
          className={inputCls}
          type="number"
          step="0.01"
          value={odd}
          onChange={(e) => setOdd(e.target.value)}
          placeholder="1.90"
        />
      </label>
      <label className="flex w-24 flex-col gap-1">
        <span className={labelCls}>Stake (R$)</span>
        <input
          className={inputCls}
          type="number"
          step="1"
          value={stake}
          onChange={(e) => setStake(e.target.value)}
          placeholder="100"
        />
      </label>
      <Button type="submit" variant="primary" disabled={!valid || addBet.isPending}>
        {addBet.isPending ? "Adicionando…" : "+ Adicionar"}
      </Button>
      {dup && <span className="font-mono text-xs text-hit-mid">Aposta idêntica já pendente. Mude a linha ou a odd.</span>}
      {addBet.isError && <span className="font-mono text-xs text-ev-neg">Falha ao salvar.</span>}
    </form>
  );
}
