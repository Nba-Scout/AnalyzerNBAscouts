// Tabela da carteira: lista as apostas, liquida pendentes (win/loss/push) e
// mostra resultado + P&L das já liquidadas. Reusa .props-table do global.css.

import { useSettleBet } from "../../api/queries";
import { Badge, type BadgeTone } from "../../components/ui";
import { cn } from "../../lib/cn";
import { isPending } from "../../lib/bets";
import { fmtOdd } from "../../lib/format";
import type { Bet, BetResult } from "../../types/api";

const RESULT_TONE: Record<string, BadgeTone> = { win: "pos", loss: "neg", push: "neutral" };
const RESULT_LABEL: Record<string, string> = { win: "GANHOU", loss: "PERDEU", push: "PUSH" };

function brl(n: number): string {
  const sign = n > 0 ? "+" : n < 0 ? "−" : "";
  return `${sign}R$ ${Math.abs(n).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`;
}

function SettleButtons({ id }: { id: number }) {
  const settle = useSettleBet();
  const act = (result: BetResult) => settle.mutate({ id, result });
  const base =
    "h-6 rounded-sm border px-2 font-mono text-[10.5px] font-semibold cursor-pointer transition-colors disabled:opacity-50";
  return (
    <div className="flex justify-end gap-1">
      <button
        disabled={settle.isPending}
        onClick={() => act("win")}
        className={cn(base, "border-ev-strong/35 text-ev-strong hover:bg-ev-strong/12")}
      >
        ✓ W
      </button>
      <button
        disabled={settle.isPending}
        onClick={() => act("loss")}
        className={cn(base, "border-ev-neg/35 text-ev-neg hover:bg-ev-neg/12")}
      >
        ✗ L
      </button>
      <button
        disabled={settle.isPending}
        onClick={() => act("push")}
        className={cn(base, "border-border text-fg-muted hover:bg-raised")}
      >
        = P
      </button>
    </div>
  );
}

export function BetsTable({ bets }: { bets: Bet[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-surface">
      <table className="props-table w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border text-left font-mono text-[10px] uppercase tracking-wide text-fg-subtle">
            <th className="px-3 py-2.5 font-medium">Jogador</th>
            <th className="px-3 py-2.5 font-medium">Aposta</th>
            <th className="px-3 py-2.5 text-right font-medium">Odd</th>
            <th className="px-3 py-2.5 text-right font-medium">Stake</th>
            <th className="px-3 py-2.5 font-medium">Status</th>
            <th className="px-3 py-2.5 text-right font-medium">P&L</th>
            <th className="px-3 py-2.5 text-right font-medium">Ações</th>
          </tr>
        </thead>
        <tbody>
          {bets.map((b) => {
            const pending = isPending(b);
            const pnl = b.profit_loss ?? 0;
            return (
              <tr key={b.id} className={cn("border-b border-border/60", pending && "row-strong")}>
                <td className="px-3 py-2.5 font-sans font-medium text-fg">{b.player_name}</td>
                <td className="px-3 py-2.5 font-mono text-[12.5px] text-fg-muted">
                  {b.market_key} {b.direction} {b.line}
                </td>
                <td className="px-3 py-2.5 text-right font-mono tabular-nums text-fg">{fmtOdd(b.odd_decimal)}</td>
                <td className="px-3 py-2.5 text-right font-mono tabular-nums text-fg">
                  R$ {b.stake.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
                </td>
                <td className="px-3 py-2.5">
                  {pending ? (
                    <Badge tone="warn">PENDENTE</Badge>
                  ) : (
                    <Badge tone={RESULT_TONE[b.result ?? ""] ?? "neutral"}>{RESULT_LABEL[b.result ?? ""] ?? b.result}</Badge>
                  )}
                </td>
                <td
                  className={cn(
                    "px-3 py-2.5 text-right font-mono font-semibold tabular-nums",
                    pending ? "text-fg-subtle" : pnl > 0 ? "text-ev-strong" : pnl < 0 ? "text-ev-neg" : "text-fg",
                  )}
                >
                  {pending ? "—" : brl(pnl)}
                </td>
                <td className="px-3 py-2.5">
                  {pending ? (
                    <SettleButtons id={b.id} />
                  ) : (
                    <div className="text-right font-mono text-[10px] text-fg-subtle">liquidada</div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
