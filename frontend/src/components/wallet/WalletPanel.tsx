// Painel da carteira (conteúdo do dropdown do chip no header) — saldo + curva,
// 3 tiles, apostas abertas, liquidadas recentes e ações. Tokenizado: âmbar =
// ação/chrome; verde/vermelho reservados a sinal (P&L, W/L). "Gerenciar banca"
// leva à página completa da carteira (onManage); "Exportar" chama onExport.

import { bankrollSeries, computeWallet, isPending } from "../../lib/bets";
import { cn } from "../../lib/cn";
import type { Bet } from "../../types/api";
import { Button } from "../ui";

function brl(n: number, dec = 2): string {
  return `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: dec, maximumFractionDigits: dec })}`;
}
function signedBrl(n: number): string {
  const s = n > 0 ? "+" : n < 0 ? "−" : "";
  return `${s}${brl(Math.abs(n))}`;
}
function fmtDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}
const arrow = (dir: string) => (dir.toUpperCase() === "UNDER" ? "▼" : "▲");
const signalClass = (n: number) => (n > 0 ? "text-signal-pos" : n < 0 ? "text-signal-neg" : "text-fg-muted");

function BankrollCurve({ series, w = 120, h = 42 }: { series: number[]; w?: number; h?: number }) {
  if (series.length < 2) return null;
  const min = Math.min(...series);
  const max = Math.max(...series);
  const span = max - min || 1;
  const stepX = w / (series.length - 1);
  const pts = series.map((v, i) => `${(i * stepX).toFixed(1)},${(h - ((v - min) / span) * h).toFixed(1)}`);
  return (
    <svg width={w} height={h} className="block overflow-visible" role="img" aria-label="Curva de bankroll">
      <path d={`M 0,${h} L ${pts.join(" L ")} L ${w},${h} Z`} fill="currentColor" fillOpacity={0.12} />
      <path
        d={`M ${pts.join(" L ")}`}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle
        cx={(series.length - 1) * stepX}
        cy={h - ((series[series.length - 1] - min) / span) * h}
        r={2.2}
        fill="currentColor"
      />
    </svg>
  );
}

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="font-mono text-[9.5px] tracking-[0.1em] text-fg-subtle uppercase">{label}</span>
      <span className="font-mono text-[15px] font-bold tabular-nums text-fg">{value}</span>
      {sub && <span className="font-mono text-[10px] text-fg-subtle">{sub}</span>}
    </div>
  );
}

function BetLine({ bet }: { bet: Bet }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <div className="flex min-w-0 items-center gap-2">
        <span className="live-dot shrink-0" />
        <div className="min-w-0">
          <div className="truncate text-[13px] font-medium text-fg">{bet.player_name}</div>
          <div className="font-mono text-[10.5px] text-fg-subtle">
            {bet.market_key} {arrow(bet.direction)} {bet.line} @ {bet.odd_decimal.toFixed(2)}
          </div>
        </div>
      </div>
      <span className="shrink-0 font-mono text-[12px] tabular-nums text-fg-muted">{brl(bet.stake, 2)}</span>
    </div>
  );
}

const RESULT_BADGE: Record<string, string> = { win: "text-signal-pos", loss: "text-signal-neg", push: "text-fg-subtle" };
const RESULT_LETTER: Record<string, string> = { win: "W", loss: "L", push: "P" };

function SettledLine({ bet }: { bet: Bet }) {
  const r = bet.result ?? "";
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className={cn("w-3 shrink-0 text-center font-mono text-[11px] font-bold", RESULT_BADGE[r] ?? "text-fg-subtle")}>
          {RESULT_LETTER[r] ?? "•"}
        </span>
        <span className="truncate text-[13px] text-fg-muted">{bet.player_name}</span>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <span className="font-mono text-[10.5px] text-fg-subtle">{fmtDate(bet.settled_at ?? bet.added_at)}</span>
        <span className={cn("font-mono text-[12px] font-semibold tabular-nums", signalClass(bet.profit_loss ?? 0))}>
          {signedBrl(bet.profit_loss ?? 0)}
        </span>
      </div>
    </div>
  );
}

export function WalletPanel({
  bets,
  bankroll,
  units = 100,
  onManage,
  onExport,
}: {
  bets: Bet[];
  bankroll: number;
  units?: number;
  onManage?: () => void;
  onExport?: () => void;
}) {
  const w = computeWallet(bets);
  const series = bankrollSeries(bets, bankroll);
  const current = bankroll + w.pnl;

  const unitSize = units > 0 ? bankroll / units : 0;
  const openUnits = unitSize > 0 ? w.pendingStake / unitSize : 0;

  const open = bets.filter(isPending);
  const settled = bets
    .filter((b) => !isPending(b))
    .slice()
    .sort((a, b) => (b.settled_at ?? b.added_at).localeCompare(a.settled_at ?? a.added_at))
    .slice(0, 5);

  const decided = w.won + w.lost;
  const pnlClass = signalClass(w.pnl);

  return (
    <div className="flex flex-col gap-4 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-mono text-[9.5px] tracking-[0.12em] text-fg-subtle uppercase">Saldo da carteira</div>
          <div className="mt-1 font-mono text-2xl font-bold tabular-nums text-fg">{brl(current)}</div>
          <div className={cn("mt-1 font-mono text-[12px] font-semibold tabular-nums", pnlClass)}>
            {w.pnl >= 0 ? "▲" : "▼"} {signedBrl(w.pnl)} ({w.roi >= 0 ? "+" : ""}
            {w.roi.toFixed(1)}% ROI)
          </div>
        </div>
        <div className={pnlClass}>
          <BankrollCurve series={series} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 border-y border-border py-4">
        <Tile label="Banca" value={brl(bankroll, 2)} sub={`${units}u · 1u = ${brl(unitSize, 2)}`} />
        <Tile label="Em aberto" value={`${openUnits.toFixed(1)}u`} sub={brl(w.pendingStake, 2)} />
        <Tile
          label="Acerto"
          value={decided > 0 ? `${w.hitRate.toFixed(0)}%` : "—"}
          sub={decided > 0 ? `${w.won}/${decided}` : "sem liquidadas"}
        />
      </div>

      <div className="flex flex-col">
        <div className="mb-1 flex items-center justify-between">
          <span className="font-mono text-[9.5px] tracking-[0.12em] text-fg-subtle uppercase">Apostas abertas</span>
          <span className="font-mono text-[10px] text-fg-subtle">{open.length}</span>
        </div>
        {open.length === 0 ? (
          <div className="py-1.5 font-mono text-[11px] text-fg-subtle">nenhuma aposta aberta</div>
        ) : (
          <div className="max-h-52 divide-y divide-border/60 overflow-auto">
            {open.map((b) => (
              <BetLine key={b.id} bet={b} />
            ))}
          </div>
        )}
      </div>

      {settled.length > 0 && (
        <div className="flex flex-col">
          <div className="mb-1 font-mono text-[9.5px] tracking-[0.12em] text-fg-subtle uppercase">Liquidadas recentes</div>
          <div className="divide-y divide-border/60">
            {settled.map((b) => (
              <SettledLine key={b.id} bet={b} />
            ))}
          </div>
        </div>
      )}

      <div className="mt-1 flex gap-2">
        <Button variant="primary" className="flex-1" onClick={onManage}>
          Gerenciar banca
        </Button>
        {onExport && (
          <Button variant="outline" onClick={onExport}>
            Exportar
          </Button>
        )}
      </div>
    </div>
  );
}
