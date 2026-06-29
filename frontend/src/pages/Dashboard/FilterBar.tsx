// Barra de filtros (busca, EV mín, ordenação, mercado, jogo, time) — tokenizado (Etapa 3).

import { type Dispatch, type SetStateAction } from "react";

import { Button, Pill } from "../../components/ui";
import { cn } from "../../lib/cn";
import type { Filters } from "../../lib/props";
import { MARKETS } from "../../lib/teams";

export interface PillOption {
  key: string;
  label: string;
}

const LABEL = "font-mono text-[10.5px] uppercase tracking-wide text-fg-subtle";

export function FilterBar({
  filters,
  setFilters,
  games,
  teams,
  resultCount,
  onReset,
  onExport,
}: {
  filters: Filters;
  setFilters: Dispatch<SetStateAction<Filters>>;
  games: PillOption[];
  teams: PillOption[];
  resultCount: number;
  onReset: () => void;
  onExport?: () => void;
}) {
  const isFiltered =
    filters.market !== "ALL" ||
    filters.minEv !== 3 ||
    filters.onlyStrong ||
    (filters.game && filters.game !== "ALL") ||
    (filters.team && filters.team !== "ALL") ||
    !!(filters.search || "");

  return (
    <div className="flex flex-col gap-2.5 rounded-lg border border-border bg-surface p-3.5 font-sans text-[13px]">
      {/* Linha 1: busca + controles */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex min-w-0 flex-[1_1_200px] items-center gap-2 rounded-md border border-border bg-canvas px-2.5 py-1.5 transition-colors focus-within:border-accent/60">
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="flex-shrink-0 text-fg-subtle"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <input
            type="text"
            placeholder="Buscar jogador…"
            value={filters.search || ""}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            className="w-full min-w-0 bg-transparent font-sans text-[13px] text-fg outline-none placeholder:text-fg-subtle"
          />
          {(filters.search || "") && (
            <button
              onClick={() => setFilters({ ...filters, search: "" })}
              className="flex-shrink-0 text-lg leading-none text-fg-subtle hover:text-fg cursor-pointer"
            >
              ×
            </button>
          )}
        </div>

        <div className="h-5 w-px flex-shrink-0 bg-border" />

        {/* EV mín */}
        <div className="flex items-center gap-2.5">
          <span className={LABEL}>EV MÍN.</span>
          <input
            type="range"
            min={0}
            max={20}
            step={0.5}
            value={filters.minEv}
            onChange={(e) => setFilters({ ...filters, minEv: +e.target.value })}
            className="w-[110px] accent-accent"
          />
          <input
            type="number"
            min={0}
            max={20}
            step={0.5}
            value={filters.minEv}
            onChange={(e) => setFilters({ ...filters, minEv: Math.max(0, Math.min(20, parseFloat(e.target.value) || 0)) })}
            className="w-[52px] rounded-sm border border-border bg-canvas px-1.5 py-1 text-right font-mono text-xs text-fg outline-none tabular-nums"
          />
          <span className="font-mono text-xs text-fg-subtle">%</span>
        </div>

        {/* Ordenação */}
        <div className="flex items-center gap-2">
          <span className={LABEL}>ORDEM</span>
          <select
            value={`${filters.sortBy}:${filters.sortDir}`}
            onChange={(e) => {
              const [field, dir] = e.target.value.split(":");
              setFilters({ ...filters, sortBy: field, sortDir: dir as "asc" | "desc" });
            }}
            className="rounded-md border border-border bg-canvas px-2.5 py-1.5 font-sans text-[13px] text-fg outline-none"
          >
            <option value="ev_pct:desc">EV% ↓</option>
            <option value="ev_pct:asc">EV% ↑</option>
            <option value="odd:desc">Odd ↓</option>
            <option value="odd:asc">Odd ↑</option>
            <option value="prob_real:desc">Prob Real ↓</option>
            <option value="prob_real:asc">Prob Real ↑</option>
            <option value="kelly_full_pct:desc">Kelly ↓</option>
            <option value="games_over_line_pct:desc">Hit% ↓</option>
          </select>
        </div>

        <Pill active={filters.onlyStrong} onClick={() => setFilters({ ...filters, onlyStrong: !filters.onlyStrong })}>
          Só Strong Bets
        </Pill>

        <div className="flex-1" />

        <div className="flex items-center gap-2.5">
          <span className={cn("font-mono text-[11px]", resultCount === 0 ? "text-ev-neg" : "text-fg-subtle")}>
            {resultCount} resultados
          </span>
          {onExport && (
            <Button size="sm" variant="outline" onClick={onExport}>
              ⬇ CSV
            </Button>
          )}
          {isFiltered && (
            <Button size="sm" variant="ghost" onClick={onReset}>
              Limpar filtros
            </Button>
          )}
        </div>
      </div>

      {/* Linha 2: pills de mercado */}
      <div className="flex flex-wrap items-center gap-1.5 border-t border-border pt-2.5">
        <span className={cn(LABEL, "mr-0.5")}>MERCADO</span>
        {MARKETS.map((m) => (
          <Pill
            key={m.key}
            active={(filters.market || "ALL") === m.key}
            onClick={() => setFilters({ ...filters, market: m.key })}
          >
            {m.label}
          </Pill>
        ))}
      </div>

      {/* Linha 3: jogo + time */}
      {games && games.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 border-t border-border pt-2.5">
          <span className={cn(LABEL, "mr-0.5")}>JOGO</span>
          {games.map((g) => (
            <Pill
              key={g.key}
              active={(filters.game || "ALL") === g.key && (filters.team || "ALL") === "ALL"}
              onClick={() => setFilters({ ...filters, game: g.key, team: "ALL" })}
            >
              {g.label}
            </Pill>
          ))}
          {teams && teams.length > 0 && (
            <>
              <div className="mx-1 h-4 w-px flex-shrink-0 bg-border" />
              <span className={cn(LABEL, "mr-0.5")}>TIME</span>
              {teams.map((t) => {
                const active = (filters.team || "ALL") === t.key;
                return (
                  <Pill
                    key={t.key}
                    active={active}
                    onClick={() => setFilters({ ...filters, team: active ? "ALL" : t.key, game: "ALL" })}
                  >
                    {t.label}
                  </Pill>
                );
              })}
            </>
          )}
        </div>
      )}
    </div>
  );
}
