// Histórico recente com toggle Casa/Fora + comparativo de splits — tokenizado (Etapa 4).

import { useState } from "react";

import { Pill } from "../../components/ui";
import { cn } from "../../lib/cn";
import type { HomeAwaySplits, RecentGame } from "../../types/api";

const HEADERS = ["DATA", "PO", "ADV", "MAR", "MIN", "PTS", "REB", "AST", "3PM", "BLK", "STL"];

export function HistorySection({
  games,
  propLines,
  avgMin,
  loadingPlayer,
  splits,
  cellColor,
}: {
  games: RecentGame[];
  propLines: Record<string, number>;
  avgMin: number;
  loadingPlayer: boolean;
  splits: HomeAwaySplits;
  cellColor: (val: number, market: string) => string | null;
}) {
  const [locFilter, setLocFilter] = useState("ALL");
  const filtered = locFilter === "ALL" ? games : games.filter((g) => g.home_away === locFilter);
  const s = splits;
  const hasLocationData = s.home_games + s.away_games > 0;

  return (
    <>
      <div className="mb-2.5 flex flex-wrap items-center gap-2">
        <div className="font-mono text-[10.5px] uppercase tracking-widest text-fg-subtle">Histórico recente</div>
        <span className="h-px flex-1 bg-border" />
        {Object.keys(propLines).length > 0 && (
          <span className="text-[10px] text-fg-subtle">células coloridas = linha do prop</span>
        )}
        <Pill active={locFilter === "ALL"} onClick={() => setLocFilter("ALL")}>
          Todos
        </Pill>
        <Pill active={locFilter === "home"} onClick={() => setLocFilter("home")}>
          Casa
        </Pill>
        <Pill active={locFilter === "away"} onClick={() => setLocFilter("away")}>
          Fora
        </Pill>
      </div>

      {hasLocationData && (
        <div className="mb-2.5 flex flex-wrap gap-4 rounded-md border border-border bg-surface px-3.5 py-2.5 font-mono text-[11px] tabular-nums">
          <span className="text-fg-subtle">
            Casa ({s.home_games}j):
            <span className="ml-1.5 text-ev-strong">PTS {(s.home_avg_pts || 0).toFixed(1)}</span>
            <span className="ml-2 text-info">REB {(s.home_avg_reb || 0).toFixed(1)}</span>
            <span className="ml-2 text-accent">AST {(s.home_avg_ast || 0).toFixed(1)}</span>
          </span>
          <span className="text-fg-subtle/50">|</span>
          <span className="text-fg-subtle">
            Fora ({s.away_games}j):
            <span className="ml-1.5 text-ev-strong">PTS {(s.away_avg_pts || 0).toFixed(1)}</span>
            <span className="ml-2 text-info">REB {(s.away_avg_reb || 0).toFixed(1)}</span>
            <span className="ml-2 text-accent">AST {(s.away_avg_ast || 0).toFixed(1)}</span>
          </span>
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-border bg-surface">
        <div className="max-h-[480px] overflow-auto">
          <table className="w-full border-collapse font-mono text-[12.5px] text-fg tabular-nums">
            <thead className="sticky top-0 z-[2] bg-canvas">
              <tr>
                {HEADERS.map((h) => (
                  <th
                    key={h}
                    className={cn(
                      "border-b border-border px-3 py-2.5 text-[10px] font-medium uppercase tracking-wide text-fg-subtle",
                      h === "DATA" || h === "ADV" ? "text-left" : "text-right",
                    )}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={11} className="px-3 py-8 text-center font-sans text-fg-subtle">
                    {loadingPlayer ? "Carregando…" : locFilter === "ALL" ? "Sem jogos disponíveis" : "Sem jogos neste contexto"}
                  </td>
                </tr>
              )}
              {filtered.map((g, i) => {
                const ptsC = cellColor(g.pts, "PTS");
                const rebC = cellColor(g.reb, "REB");
                const astC = cellColor(g.ast, "AST");
                const fg3mC = cellColor(g.fg3m, "FG3M");
                const blkC = cellColor(g.blk, "BLK");
                const stlC = cellColor(g.stl, "STL");
                const hasMargin = g.margin || g.margin === 0;
                const isBlowout = Math.abs(g.margin) > 15;
                const lowMin = avgMin > 0 && g.min < avgMin * 0.8;
                const marginCls = g.margin > 0 ? "text-ev-strong" : g.margin < 0 ? "text-ev-neg" : "text-fg-muted";
                return (
                  <tr key={i} className="border-b border-border/40 odd:bg-surface even:bg-raised/40">
                    <td className="px-3 py-2.5 text-fg-muted">{g.date}</td>
                    <td className="px-3 py-2.5">
                      {g.is_playoff ? (
                        <span className="rounded-sm border border-info/35 bg-info/12 px-1.5 py-0.5 text-[9.5px] font-bold tracking-wide text-info">
                          PO
                        </span>
                      ) : (
                        <span className="text-fg-subtle">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-fg-muted">{g.opp}</td>
                    <td className="px-3 py-2.5 text-right">
                      {!hasMargin ? (
                        <span className="text-fg-subtle">—</span>
                      ) : (
                        <span className="inline-flex items-center gap-1">
                          <span className={cn("text-[11.5px]", marginCls)}>
                            {g.margin > 0 ? "+" : ""}
                            {g.margin}
                          </span>
                          {isBlowout && lowMin && (
                            <span className="rounded-sm border border-hit-mid/35 bg-hit-mid/12 px-1 py-px text-[9px] font-bold tracking-wide text-hit-mid">
                              BLW
                            </span>
                          )}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right text-fg-muted">{g.min}</td>
                    <td
                      className="px-3 py-2.5 text-right font-semibold"
                      style={ptsC ? { color: ptsC, fontWeight: 700 } : undefined}
                    >
                      {g.pts}
                    </td>
                    <td className="px-3 py-2.5 text-right" style={rebC ? { color: rebC } : undefined}>
                      {g.reb}
                    </td>
                    <td className="px-3 py-2.5 text-right" style={astC ? { color: astC } : undefined}>
                      {g.ast}
                    </td>
                    <td className="px-3 py-2.5 text-right text-fg-muted" style={fg3mC ? { color: fg3mC } : undefined}>
                      {g.fg3m}
                    </td>
                    <td className="px-3 py-2.5 text-right text-fg-muted" style={blkC ? { color: blkC } : undefined}>
                      {g.blk}
                    </td>
                    <td className="px-3 py-2.5 text-right text-fg-muted" style={stlC ? { color: stlC } : undefined}>
                      {g.stl}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
