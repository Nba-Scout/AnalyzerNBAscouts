// Card de destaque (Strong Bet) da variação Editorial — tokenizado (Etapa 3).

import { AddToWalletButton } from "../../components/AddToWalletButton";
import { StarButton } from "../../components/StarButton";
import { RatingBadge, Tooltip } from "../../components/ui";
import { evColorClass, hitColorClass } from "../../lib/colors";
import { cn } from "../../lib/cn";
import { fmtKelly, fmtOdd, fmtPct, fmtProb, type KellyMode, type OddMode } from "../../lib/format";
import type { Prop } from "../../types/api";
import { OddsShoppingBadge } from "./OddsShoppingBadge";

function BigStat({ label, value, valueClass = "text-fg" }: { label: string; value: string; valueClass?: string }) {
  return (
    <div>
      <div className="mb-1 font-mono text-[9.5px] uppercase tracking-wide text-fg-subtle">{label}</div>
      <div className={cn("text-[17px] font-semibold tabular-nums", valueClass)}>{value}</div>
    </div>
  );
}

export function FeaturedCard({
  prop,
  onPlayer,
  oddMode,
  kellyMode,
}: {
  prop: Prop;
  onPlayer: (name: string) => void;
  oddMode: OddMode;
  kellyMode: KellyMode;
}) {
  return (
    <div className="prop-card strong relative overflow-hidden rounded-xl border border-accent/35 bg-gradient-to-b from-raised to-surface p-5">
      <div className="pointer-events-none absolute -right-6 -top-6 h-36 w-36 rounded-full bg-accent/15 blur-2xl" />
      <div className="absolute inset-y-0 left-0 w-[3px] bg-accent" />

      <div className="relative">
        {/* Header */}
        <div className="mb-3.5 flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <button
              onClick={() => onPlayer(prop.player_name)}
              className="block w-full truncate text-left font-sans text-xl font-bold leading-tight text-fg transition-colors hover:text-accent cursor-pointer"
            >
              {prop.player_name}
            </button>
            <div className="mt-1 truncate font-mono text-[11px] text-fg-muted">
              {prop.team} · {prop.game}
            </div>
          </div>
          <div className="flex flex-shrink-0 items-center gap-2">
            <StarButton prop={prop} />
            <AddToWalletButton prop={prop} />
            <RatingBadge rating={prop.rating} size="md" />
          </div>
        </div>

        {/* Linha principal */}
        <div className="mb-4 flex items-center gap-2.5 rounded-lg border border-border bg-canvas px-3 py-2.5 font-mono">
          <span className="text-[10.5px] uppercase tracking-wide text-fg-subtle">{prop.market}</span>
          <span className={cn("text-[13px] font-bold", prop.direction === "OVER" ? "text-ev-pos" : "text-ev-neg")}>
            {prop.direction}
          </span>
          <span className="text-3xl font-bold tracking-tighter text-fg tabular-nums">{prop.line}</span>
          {Math.abs(prop.line_movement) >= 0.5 && (
            <Tooltip text={`Abriu em ${prop.line_opened} · movimento ${prop.line_movement > 0 ? "+" : ""}${prop.line_movement}`}>
              <span className={cn("text-[13px]", prop.line_movement > 0 ? "text-ev-strong" : "text-ev-neg")}>
                {prop.line_movement > 0 ? "⬆" : "⬇"}
              </span>
            </Tooltip>
          )}
          <span className="flex-1" />
          <span className="text-[11px] text-fg-subtle">@</span>
          <span className="text-base font-semibold text-fg-muted tabular-nums">{fmtOdd(prop.odd, oddMode)}</span>
        </div>

        {/* Stats + hit rate */}
        <div className="mb-3 flex gap-6 font-mono">
          <BigStat label="EV%" value={fmtPct(prop.ev_pct)} valueClass={evColorClass(prop.ev_pct)} />
          <BigStat label="Prob Real" value={fmtProb(prop.prob_real)} valueClass="text-fg-muted" />
          <BigStat label="Kelly" value={fmtKelly(prop.kelly_full_pct, kellyMode)} valueClass="text-accent" />
          <BigStat
            label="Hit%"
            value={`${(prop.games_over_line_pct * 100).toFixed(0)}%`}
            valueClass={hitColorClass(prop.games_over_line_pct)}
          />
        </div>

        {/* Bookmaker */}
        <div className="font-mono text-[10.5px] text-fg-subtle">
          <OddsShoppingBadge bookmaker={prop.bookmaker} allOdds={prop.all_odds} />
        </div>
      </div>
    </div>
  );
}
