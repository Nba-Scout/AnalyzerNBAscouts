// Variação Terminal — tabela densa, paginação, linhas expansíveis, headers
// ordenáveis. Tokenizado (Etapa 3); hover/accent de linha via .props-table (global.css).

import { Fragment, useState } from "react";

import { FlashCell, Gauge, TrendSparkline } from "../../components/atoms";
import { StarButton } from "../../components/StarButton";
import { Button, RatingBadge, Tooltip } from "../../components/ui";
import { evColorClass, hitColorClass } from "../../lib/colors";
import { cn } from "../../lib/cn";
import { fmtKelly, fmtOdd, fmtPct, fmtProb, normEv } from "../../lib/format";
import type { Prop } from "../../types/api";
import { AccordionPanel } from "./AccordionPanel";
import { InjuryAlert } from "./InjuryAlert";
import { OddsShoppingBadge } from "./OddsShoppingBadge";
import { kellyStake, type SortHandlers, type ViewProps } from "./shared";

const HEADER_TIPS: Record<string, string> = {
  "Prob Real": "Probabilidade verdadeira estimada de o evento acontecer, ponderando forma recente e média da temporada.",
  "EV%": "Expected Value: quanto acima do valor justo está a odd. Positivo = aposta com vantagem matemática.",
  "Kelly%": "Fração do bankroll sugerida pelo critério de Kelly. Indica convicção proporcional ao EV.",
  Rating: "STRONG ≥ EV 8% e prob ≥ 60% · VALUE = EV positivo · NEUTRAL ≈ zero · AVOID = EV negativo.",
  Odd: "Odd decimal. Implied prob = 1 / odd.",
  "Hit%": "% dos últimos jogos em que o jogador bateu essa linha. ≥60% verde · 40-60% amarelo · <40% vermelho.",
};

const PAGE = 12;
const TH =
  "border-b border-border px-3 py-2.5 font-mono text-[10px] font-medium uppercase tracking-wide whitespace-nowrap select-none";
const TD = "px-3 py-2.5 tabular-nums";

export function PropsTableTerminal({
  props,
  onPlayer,
  oddMode,
  kellyMode,
  bankroll = 0,
  sortBy,
  sortDir,
  onSort,
}: ViewProps & Partial<SortHandlers>) {
  const [page, setPage] = useState(0);
  const [expandedRow, setExpandedRow] = useState<number | null>(null);

  const [trackedProps, setTrackedProps] = useState<Prop[]>(props);
  if (trackedProps !== props) {
    setTrackedProps(props);
    setPage(0);
    setExpandedRow(null);
  }

  const pageData = props.slice(page * PAGE, (page + 1) * PAGE);
  const pageCount = Math.max(1, Math.ceil(props.length / PAGE));

  function header(label: string, key: string | null, align: "left" | "right" | "center" = "left") {
    const active = !!key && sortBy === key;
    const tip = HEADER_TIPS[label];
    const arrow = active ? (sortDir === "desc" ? " ↓" : " ↑") : "";
    return (
      <th
        onClick={() => key && onSort && onSort(key)}
        className={cn(
          TH,
          key && "sortable cursor-pointer",
          active ? "text-accent" : "text-fg-subtle",
          align === "right" && "text-right",
          align === "center" && "text-center",
        )}
      >
        {tip ? (
          <Tooltip text={tip}>
            <span>
              {label}
              {arrow}
            </span>
            <span className="ml-1 text-[9px] text-fg-subtle/60">ⓘ</span>
          </Tooltip>
        ) : (
          <>
            {label}
            {arrow}
          </>
        )}
      </th>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface">
      <div className="max-h-[580px] overflow-auto">
        <table className="props-table w-full border-collapse font-mono text-[12.5px] text-fg">
          <thead className="sticky top-0 z-[2] bg-canvas">
            <tr>
              {header("Jogador", "player_name")}
              {header("Jogo", "game")}
              {header("Mercado", "market")}
              {header("Linha", "line", "right")}
              {header("Dir", "direction")}
              {header("Odd", "odd", "right")}
              {header("Hit%", "games_over_line_pct", "right")}
              {header("Tend 5J", null, "center")}
              {header("Prob Real", "prob_real", "right")}
              {header("EV%", "ev_pct", "right")}
              {header("Kelly%", "kelly_pct", "right")}
              {header("Rating", "rating")}
              {header("Casa", "bookmaker")}
              <th className="w-7 border-b border-border" />
            </tr>
          </thead>
          <tbody>
            {pageData.map((p, i) => {
              const globalIdx = page * PAGE + i;
              const isExpanded = expandedRow === globalIdx;
              const strong = p.rating === "STRONG";
              return (
                <Fragment key={globalIdx}>
                  <tr
                    onClick={() => setExpandedRow(isExpanded ? null : globalIdx)}
                    className={cn(
                      "cursor-pointer border-b border-border/50",
                      strong && "row-strong",
                      isExpanded ? "bg-raised" : "bg-transparent",
                    )}
                  >
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <span onClick={(e) => e.stopPropagation()}>
                        <StarButton prop={p} style={{ marginRight: 4 }} />
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onPlayer(p.player_name);
                        }}
                        className="font-sans font-medium text-fg transition-colors hover:text-accent cursor-pointer"
                      >
                        {p.player_name}
                      </button>
                      <span className="ml-2 text-[10.5px] text-fg-subtle">{p.team}</span>
                      <InjuryAlert injuries={p.team_injuries} />
                    </td>
                    <td className={cn(TD, "text-fg-muted")}>{p.game}</td>
                    <td className={cn(TD, "text-fg-muted")}>{p.market}</td>
                    <td className={cn(TD, "text-right whitespace-nowrap")}>
                      {p.line}
                      {Math.abs(p.line_movement) >= 0.5 && (
                        <Tooltip
                          text={`Abriu em ${p.line_opened} · movimento ${p.line_movement > 0 ? "+" : ""}${p.line_movement}`}
                        >
                          <span className={cn("ml-1.5 text-[11px]", p.line_movement > 0 ? "text-ev-strong" : "text-ev-neg")}>
                            {p.line_movement > 0 ? "⬆" : "⬇"}
                          </span>
                        </Tooltip>
                      )}
                    </td>
                    <td className={cn(TD, p.direction === "OVER" ? "text-ev-pos" : "text-ev-neg")}>
                      {p.direction === "OVER" ? "▲ O" : "▼ U"}
                    </td>
                    <td className={cn(TD, "text-right")}>
                      <FlashCell value={p.odd} format={(v) => fmtOdd(v, oddMode)} />
                    </td>
                    <td className={cn(TD, "text-right")}>
                      <span className={cn("font-semibold", hitColorClass(p.games_over_line_pct))}>
                        {(p.games_over_line_pct * 100).toFixed(0)}%
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <TrendSparkline data={p.last5_values || []} line={p.line} w={64} h={20} />
                    </td>
                    <td className={cn(TD, "text-right text-fg-muted")}>{fmtProb(p.prob_real)}</td>
                    <td className="px-3 py-2 text-right">
                      <div className="inline-flex items-center justify-end gap-1.5">
                        <Gauge value={normEv(p.ev_pct)} w={36} h={20} thickness={4} />
                        <span className={cn("font-semibold", evColorClass(p.ev_pct))}>{fmtPct(p.ev_pct)}</span>
                      </div>
                    </td>
                    <td className={cn(TD, "text-right", p.kelly_pct > 0 ? "text-accent" : "text-fg-subtle")}>
                      {fmtKelly(p.kelly_full_pct, kellyMode)}
                      {bankroll > 0 && p.kelly_pct > 0 && (
                        <div className="mt-px text-[9.5px] text-fg-subtle">
                          R${kellyStake(bankroll, p.kelly_full_pct, kellyMode)}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <RatingBadge rating={p.rating} />
                    </td>
                    <td className="px-3 py-2.5 text-[11px]" onClick={(e) => e.stopPropagation()}>
                      <OddsShoppingBadge bookmaker={p.bookmaker} allOdds={p.all_odds} />
                    </td>
                    <td className="px-2 py-2.5 text-center text-[10px] text-fg-subtle">{isExpanded ? "▲" : "▼"}</td>
                  </tr>
                  {isExpanded && (
                    <tr>
                      <td colSpan={14} className="p-0">
                        <AccordionPanel prop={p} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            {pageData.length === 0 && (
              <tr>
                <td colSpan={14} className="px-3 py-10 text-center font-sans text-fg-subtle">
                  Nenhuma prop bate seus filtros.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {pageCount > 1 && (
        <div className="flex items-center justify-between border-t border-border px-3.5 py-2.5 font-mono text-[11px] text-fg-muted">
          <span>
            Página {page + 1} de {pageCount} · {props.length} props
          </span>
          <div className="flex gap-1.5">
            <Button size="sm" variant="subtle" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}>
              ← Anterior
            </Button>
            <Button
              size="sm"
              variant="subtle"
              onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
              disabled={page >= pageCount - 1}
            >
              Próxima →
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
