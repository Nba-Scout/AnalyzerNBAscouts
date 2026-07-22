// Painel expandido de uma prop (tabela Terminal) — tokenizado (Etapa 3).

import { TrendSparkline } from "../../components/atoms";
import { LineMovementGraph } from "../../components/LineMovementGraph";
import { evColorClass, hitColorClass } from "../../lib/colors";
import { cn } from "../../lib/cn";
import { fmtKelly, fmtPct, fmtProb } from "../../lib/format";
import type { Prop } from "../../types/api";
import { bookmakerUrl } from "./bookmakers";

function AccStat({ label, value, valueClass = "text-fg-muted" }: { label: string; value: string | number; valueClass?: string }) {
  return (
    <div>
      <div className="mb-1 font-mono text-[9.5px] uppercase tracking-wide text-fg-subtle">{label}</div>
      <div className={cn("font-mono text-[13px] font-semibold tabular-nums", valueClass)}>{value}</div>
    </div>
  );
}

const dvpClass = (rank: number) => (rank <= 10 ? "text-hit-hi" : rank <= 20 ? "text-hit-mid" : "text-hit-lo");

export function AccordionPanel({ prop }: { prop: Prop }) {
  const last5 = prop.last5_values || [];
  return (
    <div className="flex flex-wrap items-start gap-7 border-t border-border bg-canvas px-5 py-3.5 pl-9">
      {last5.length > 0 && (
        <div className="flex-shrink-0">
          <div className="mb-2 font-mono text-[9.5px] uppercase tracking-wide text-fg-subtle">{prop.market} · Tend. 5J</div>
          <TrendSparkline data={last5} line={prop.line} w={220} h={60} />
        </div>
      )}

      <LineMovementGraph player={prop.player_name} marketKey={prop.market_key} direction={prop.direction} active />

      <div className="flex flex-wrap items-start gap-5">
        <AccStat label="Média 10J" value={prop.avg_stat_last10.toFixed(1)} />
        <AccStat label="Linha" value={prop.line} />
        <AccStat label="Prob. Impl." value={fmtProb(prop.implied_prob)} />
        <AccStat label="Prob. Real" value={fmtProb(prop.prob_real)} />
        <AccStat label="EV%" value={fmtPct(prop.ev_pct)} valueClass={evColorClass(prop.ev_pct)} />
        <AccStat label="Kelly ¼" value={fmtKelly(prop.kelly_full_pct, "quarter")} valueClass="text-accent" />
        <AccStat
          label="Hit%"
          value={`${(prop.games_over_line_pct * 100).toFixed(0)}%`}
          valueClass={hitColorClass(prop.games_over_line_pct)}
        />
        {prop.dvp_rank > 0 && (
          <AccStat label="DvP" value={`${prop.dvp_rank}°/${prop.dvp_total}`} valueClass={dvpClass(prop.dvp_rank)} />
        )}
        {prop.min_boost_pct > 0 && <AccStat label="Min Boost" value={`+${prop.min_boost_pct}%`} valueClass="text-hit-mid" />}
        {prop.pace > 0 && <AccStat label="Pace Def." value={prop.pace.toFixed(1)} />}
        {prop.def_rating_opponent > 0 && <AccStat label="Def Rat." value={prop.def_rating_opponent.toFixed(1)} />}
      </div>

      {prop.all_odds && prop.all_odds.length > 1 && (
        <div>
          <div className="mb-2 font-mono text-[9.5px] uppercase tracking-wide text-fg-subtle">Line Shopping</div>
          <div className="flex flex-wrap gap-1.5">
            {prop.all_odds.map((o, i) => {
              const best = o.bookmaker === prop.bookmaker;
              const bUrl = bookmakerUrl(o.bookmaker);
              return (
                <div
                  key={i}
                  onClick={bUrl ? () => window.open(bUrl, "_blank", "noopener,noreferrer") : undefined}
                  className={cn(
                    "flex min-w-[58px] flex-col items-center rounded-md border px-2.5 py-1.5",
                    best ? "border-signal-pos/30 bg-signal-pos/8" : "border-border bg-surface",
                    bUrl ? "cursor-pointer" : "cursor-default",
                  )}
                >
                  <span className={cn("mb-0.5 font-mono text-[9.5px]", best ? "text-signal-pos" : "text-fg-subtle")}>
                    {o.bookmaker}
                  </span>
                  <span className={cn("font-mono text-sm font-bold tabular-nums", best ? "text-fg" : "text-fg-muted")}>
                    {o.odd.toFixed(2)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
