// Card de prop na página do jogador (tendência + hit rate) — tokenizado (Etapa 4).

import { Sparkline } from "../../components/atoms";
import { AddToWalletButton } from "../../components/AddToWalletButton";
import { StarButton } from "../../components/StarButton";
import { RatingBadge, Tooltip } from "../../components/ui";
import { evColorClass } from "../../lib/colors";
import { cn } from "../../lib/cn";
import { fmtKelly, fmtOdd, fmtPct, fmtProb, type KellyMode, type OddMode } from "../../lib/format";
import { getStatValue } from "../../lib/playerStats";
import type { Prop, RecentGame } from "../../types/api";
import { ratingAccentClass } from "../Dashboard/shared";
import { HitRateBar } from "./HitRateBar";

const dvpTone = (rank: number) =>
  rank <= 10
    ? "border-hit-hi/35 bg-hit-hi/12 text-hit-hi"
    : rank <= 20
      ? "border-hit-mid/30 bg-hit-mid/10 text-hit-mid"
      : "border-ev-neg/30 bg-ev-neg/10 text-ev-neg";

export function PlayerPropCard({
  prop,
  oddMode,
  kellyMode,
  recentGames,
}: {
  prop: Prop;
  oddMode: OddMode;
  kellyMode: KellyMode;
  recentGames: RecentGame[];
}) {
  const isStrong = prop.rating === "STRONG";
  const sparkColor = prop.ev_pct >= 8 ? "var(--c-ev-strong)" : "var(--c-accent)";

  let hitData: { hit: number; total: number } | null = null;
  let sparkData: number[] | null = null;
  if (recentGames && recentGames.length > 0) {
    const vals = recentGames.map((g) => getStatValue(g, prop.market)).filter((v): v is number => v != null);
    if (vals.length > 0) {
      const hit = prop.direction === "OVER" ? vals.filter((v) => v > prop.line).length : vals.filter((v) => v < prop.line).length;
      hitData = { hit, total: vals.length };
      sparkData = [...vals].reverse();
    }
  }

  return (
    <div
      className={cn(
        "prop-card relative overflow-hidden rounded-lg border p-3.5",
        isStrong ? "strong border-accent/40 bg-raised" : "border-border bg-surface",
      )}
    >
      <div className={cn("absolute inset-y-0 left-0 w-[3px]", ratingAccentClass(prop.rating))} />

      {/* Header */}
      <div className="mb-2.5 flex items-center justify-between">
        <div className="flex min-w-0 flex-1 items-center gap-1.5">
          <span className="font-mono text-[10px] whitespace-nowrap text-fg-muted">{prop.game}</span>
          {prop.dvp_rank > 0 && prop.dvp_total > 0 && (
            <Tooltip text={`Defesa vs posição: ${prop.dvp_rank}º/${prop.dvp_total} — rank 1 = pior defesa (melhor matchup)`}>
              <span
                className={cn(
                  "rounded-sm border px-1.5 py-px text-[9.5px] font-semibold whitespace-nowrap",
                  dvpTone(prop.dvp_rank),
                )}
              >
                DvP {prop.dvp_rank}°/{prop.dvp_total}
              </span>
            </Tooltip>
          )}
        </div>
        <div className="flex flex-shrink-0 items-center gap-1.5">
          <StarButton prop={prop} />
          <AddToWalletButton prop={prop} />
          <RatingBadge rating={prop.rating} />
        </div>
      </div>

      {/* Linha / mercado */}
      <div className="mb-3 flex items-center gap-2 rounded-md border border-border bg-canvas px-2.5 py-2 font-mono">
        <span className="rounded-sm border border-border bg-raised px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-wide text-fg-subtle">
          {prop.market}
        </span>
        <span className={cn("text-[11.5px] font-bold tracking-wide", prop.direction === "OVER" ? "text-ev-pos" : "text-ev-neg")}>
          {prop.direction}
        </span>
        <span className="text-[22px] font-bold tracking-tight text-fg tabular-nums">{prop.line}</span>
        <span className="flex-1" />
        <span className="text-xs text-fg-muted tabular-nums">{fmtOdd(prop.odd, oddMode)}</span>
      </div>

      {/* Stats row */}
      <div className="flex justify-between font-mono text-[11.5px]">
        <Tooltip text="Expected Value: positivo = odd acima do valor justo.">
          <span className="text-fg-subtle">
            EV <span className={cn("font-bold", evColorClass(prop.ev_pct))}>{fmtPct(prop.ev_pct)}</span>
          </span>
        </Tooltip>
        <Tooltip text="Probabilidade real estimada (forma recente + média de temporada).">
          <span className="text-fg-subtle">
            Prob <span className="text-fg-muted">{fmtProb(prop.prob_real)}</span>
          </span>
        </Tooltip>
        <Tooltip text="Fração de bankroll pelo critério de Kelly. Use como referência.">
          <span className="text-fg-subtle">
            Kelly <span className="text-accent">{fmtKelly(prop.kelly_full_pct, kellyMode)}</span>
          </span>
        </Tooltip>
      </div>

      {/* Sparkline de tendência */}
      {sparkData && sparkData.length > 1 && (
        <div className="mt-3 border-t border-border pt-2.5">
          <div className="mb-1.5 font-mono text-[9.5px] text-fg-subtle">Tendência · {sparkData.length} jogos</div>
          <Sparkline data={sparkData} color={sparkColor} w={220} h={38} line={prop.line} />
        </div>
      )}

      {/* Hit rate bar */}
      {hitData && <HitRateBar hit={hitData.hit} total={hitData.total} line={prop.line} direction={prop.direction} />}
    </div>
  );
}
