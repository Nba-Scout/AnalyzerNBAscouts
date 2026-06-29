// Card individual de prop (variação Cards / mobile) — tokenizado (Etapa 3).

import { type ReactNode } from "react";

import { StarButton } from "../../components/StarButton";
import { RatingBadge, Tooltip } from "../../components/ui";
import { evColorClass, hitColor, hitColorClass } from "../../lib/colors";
import { cn } from "../../lib/cn";
import { fmtKelly, fmtOdd, fmtPct, fmtProb, type KellyMode, type OddMode } from "../../lib/format";
import type { Prop } from "../../types/api";
import { OddsShoppingBadge } from "./OddsShoppingBadge";
import { kellyStake, ratingAccentClass } from "./shared";

function Stat({
  label,
  value,
  valueClass,
  tip,
  sub,
}: {
  label: string;
  value: string;
  valueClass?: string;
  tip?: string;
  sub?: ReactNode;
}) {
  return (
    <div className="bg-surface px-2.5 py-2">
      <div className="mb-0.5 font-mono text-[9.5px] uppercase tracking-wide text-fg-subtle">
        {tip ? (
          <Tooltip text={tip}>
            <span>{label}</span>
            <span className="ml-1 text-[8px] text-fg-subtle/60">ⓘ</span>
          </Tooltip>
        ) : (
          label
        )}
      </div>
      <div className={cn("font-mono text-[13px] font-semibold tabular-nums", valueClass ?? "text-fg")}>{value}</div>
      {sub && <div className="mt-0.5 font-mono text-[9.5px] text-fg-subtle">{sub}</div>}
    </div>
  );
}

export function PropCard({
  prop,
  onPlayer,
  oddMode,
  kellyMode,
  bankroll = 0,
}: {
  prop: Prop;
  onPlayer: (name: string) => void;
  oddMode: OddMode;
  kellyMode: KellyMode;
  bankroll?: number;
}) {
  const isStrong = prop.rating === "STRONG";
  return (
    <div
      className={cn(
        "prop-card relative overflow-hidden rounded-lg border p-3.5",
        isStrong ? "strong border-accent/40 bg-raised" : "border-border bg-surface",
      )}
    >
      <div className={cn("absolute inset-y-0 left-0 w-[3px]", ratingAccentClass(prop.rating))} />

      {/* Header: nome + badge */}
      <div className="mb-2.5 flex items-start justify-between gap-2.5">
        <div className="min-w-0 flex-1">
          <button
            onClick={() => onPlayer(prop.player_name)}
            className="block w-full truncate text-left font-sans text-[14.5px] font-semibold leading-tight text-fg transition-colors hover:text-accent cursor-pointer"
          >
            {prop.player_name}
          </button>
          <div className="mt-0.5 truncate font-mono text-[11px] text-fg-muted">
            {prop.team} · {prop.game}
          </div>
        </div>
        <div className="flex flex-shrink-0 items-center gap-1.5">
          <StarButton prop={prop} />
          <RatingBadge rating={prop.rating} />
        </div>
      </div>

      {/* Linha / mercado */}
      <div className="mb-2.5 flex items-center gap-2 rounded-md border border-border bg-canvas px-2.5 py-2 font-mono">
        <span className="rounded-sm border border-border bg-raised px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-wide text-fg-subtle">
          {prop.market}
        </span>
        <span className={cn("text-xs font-bold tracking-wide", prop.direction === "OVER" ? "text-ev-pos" : "text-ev-neg")}>
          {prop.direction === "OVER" ? "OVER" : "UNDER"}
        </span>
        <span className="text-xl font-bold tracking-tight text-fg tabular-nums">{prop.line}</span>
        {Math.abs(prop.line_movement) >= 0.5 && (
          <Tooltip text={`Abriu em ${prop.line_opened} · movimento ${prop.line_movement > 0 ? "+" : ""}${prop.line_movement}`}>
            <span className={cn("text-xs", prop.line_movement > 0 ? "text-ev-strong" : "text-ev-neg")}>
              {prop.line_movement > 0 ? "⬆" : "⬇"}
            </span>
          </Tooltip>
        )}
        <span className="flex-1" />
        <span className="text-xs font-medium text-fg-muted tabular-nums">{fmtOdd(prop.odd, oddMode)}</span>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-3 gap-px overflow-hidden rounded-md border border-border bg-border">
        <Stat
          label="EV%"
          value={fmtPct(prop.ev_pct)}
          valueClass={evColorClass(prop.ev_pct)}
          tip="Expected Value: quanto acima do valor justo está a odd. Positivo = vantagem matemática."
        />
        <Stat
          label="Prob Real"
          value={fmtProb(prop.prob_real)}
          valueClass="text-fg-muted"
          tip="Probabilidade real estimada com base na forma recente + média da temporada."
        />
        <Stat
          label="Kelly"
          value={fmtKelly(prop.kelly_full_pct, kellyMode)}
          valueClass={prop.kelly_pct > 0 ? "text-accent" : "text-fg-subtle"}
          tip="Fração de bankroll sugerida pelo critério de Kelly. Use apenas como referência."
          sub={bankroll > 0 && prop.kelly_pct > 0 ? `R$${kellyStake(bankroll, prop.kelly_full_pct, kellyMode)}` : null}
        />
      </div>

      {/* Hit rate bar */}
      <div className="mt-2">
        <div className="mb-1 flex justify-between font-mono text-[9.5px] text-fg-subtle">
          <span>Hit rate · últimos jogos</span>
          <span className={cn("font-semibold", hitColorClass(prop.games_over_line_pct))}>
            {(prop.games_over_line_pct * 100).toFixed(0)}%
          </span>
        </div>
        <div className="h-[3px] overflow-hidden rounded-full bg-border">
          <div
            className="h-full rounded-full transition-[width] duration-500"
            style={{ width: `${prop.games_over_line_pct * 100}%`, background: hitColor(prop.games_over_line_pct) }}
          />
        </div>
      </div>

      <div className="mt-2.5 font-mono text-[10.5px] text-fg-subtle">
        <OddsShoppingBadge bookmaker={prop.bookmaker} allOdds={prop.all_odds} />
      </div>
    </div>
  );
}
