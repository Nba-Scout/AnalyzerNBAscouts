// Dashboard root — redesign Terminal Pro (tokens + motion). Lógica intacta:
// dados via useProps, favoritos via useFavorites, tweaks vêm do App.

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, m } from "motion/react";

import { useProps } from "../../api/queries";
import { QuotaBadge } from "../../components/atoms";
import { ThemeToggle } from "../../components/ThemeToggle";
import { ErrorScreen } from "../../components/screens/ErrorScreen";
import { LoadingScreen } from "../../components/screens/LoadingScreen";
import { Badge } from "../../components/ui";
import { useFavorites } from "../../hooks/useFavorites";
import { useIsMobile } from "../../hooks/useIsMobile";
import type { Tweaks, TweaksApi } from "../../hooks/useTweaks";
import { cn } from "../../lib/cn";
import { exportCsv } from "../../lib/csv";
import { applyFilters, applySort, computeMetrics, DEFAULT_FILTERS, type Filters, gameKey, playerTeam } from "../../lib/props";
import type { Prop } from "../../types/api";
import { FilterBar, type PillOption } from "./FilterBar";
import { MobilePropList } from "./MobilePropList";
import { PropsCards } from "./PropsCards";
import { PropsEditorial } from "./PropsEditorial";
import { PropsTableTerminal } from "./PropsTableTerminal";
import { RefreshCountdown } from "./RefreshCountdown";
import { SummaryStrip } from "./SummaryStrip";

const FILTERS_KEY = "nba-scout-filters";

const VARIATIONS: { k: Tweaks["variation"]; label: string; desc: string }[] = [
  { k: "terminal", label: "Terminal", desc: "denso · tabela" },
  { k: "cards", label: "Card grid", desc: "respiração · cards" },
  { k: "editorial", label: "Editorial", desc: "destaques · split" },
];

function loadFilters(): Filters {
  try {
    const saved = JSON.parse(localStorage.getItem(FILTERS_KEY) || "null") as Partial<Filters> | null;
    if (saved) return { ...DEFAULT_FILTERS, ...saved, market: "ALL" };
  } catch {
    /* ignore */
  }
  return { ...DEFAULT_FILTERS };
}

export function Dashboard({
  onPlayer,
  tweaks,
  setTweak,
}: {
  onPlayer: (name: string) => void;
  tweaks: Tweaks;
  setTweak: TweaksApi["setTweak"];
}) {
  const { data, isLoading, isError, error, refetch } = useProps();
  const fav = useFavorites();
  const isMobile = useIsMobile(768);

  const [showFavOnly, setShowFavOnly] = useState(false);
  const [filters, setFilters] = useState<Filters>(loadFilters);

  useEffect(() => {
    localStorage.setItem(FILTERS_KEY, JSON.stringify(filters));
  }, [filters]);

  const allProps: Prop[] = useMemo(() => data?.props ?? [], [data]);

  // Resolve o campo team para props sem time (cache antigo): mapeia adversário → time.
  const resolvedProps = useMemo(() => {
    const oppToTeam: Record<string, string> = {};
    for (const p of allProps) {
      if (p.team) {
        const opp = (p.game || "").replace(/^vs\s*/i, "").trim();
        if (opp) oppToTeam[opp] = p.team;
      }
    }
    return allProps.map((p) => {
      if (p.team) return p;
      const opp = (p.game || "").replace(/^vs\s*/i, "").trim();
      const t = oppToTeam[opp] || "";
      return t ? { ...p, team: t } : p;
    });
  }, [allProps]);

  // Jogos e times únicos do dia para os pills de filtro.
  const { games, teams } = useMemo(() => {
    const seenGames = new Set<string>();
    const seenTeams = new Set<string>();
    const g: PillOption[] = [{ key: "ALL", label: "Todos" }];
    const t: PillOption[] = [];
    for (const p of resolvedProps) {
      const gk = gameKey(p);
      if (gk && !seenGames.has(gk)) {
        seenGames.add(gk);
        g.push({ key: gk, label: gk });
      }
      const pt = playerTeam(p);
      if (pt && !seenTeams.has(pt)) {
        seenTeams.add(pt);
        t.push({ key: pt, label: pt });
      }
    }
    return { games: g, teams: t };
  }, [resolvedProps]);

  const favHas = fav.has;
  const filtered = useMemo(() => {
    const base = showFavOnly ? resolvedProps.filter((p) => favHas(p)) : resolvedProps;
    return applySort(applyFilters(base, filters), filters);
  }, [resolvedProps, filters, showFavOnly, favHas]);

  const metrics = useMemo(() => computeMetrics(filtered), [filtered]);

  if (isLoading) return <LoadingScreen />;
  if (isError || !data)
    return <ErrorScreen error={error instanceof Error ? error.message : "Backend indisponível"} onRetry={() => void refetch()} />;

  const generatedAt = new Date(data.generated_at);
  const used = data.quota_limit - data.quota_remaining;
  const variation = tweaks.variation;
  const bankroll = tweaks.bankroll ?? 1000;

  const onSort = (key: string) => {
    const newDir = filters.sortBy === key && filters.sortDir === "desc" ? "asc" : "desc";
    setFilters((f) => ({ ...f, sortBy: key, sortDir: newDir }));
  };
  const sortProps = { sortBy: filters.sortBy, sortDir: filters.sortDir, onSort };
  const viewProps = { props: filtered, onPlayer, oddMode: tweaks.oddMode, kellyMode: tweaks.kellyMode, bankroll };

  return (
    <div className="min-h-screen bg-canvas font-sans text-fg">
      <header className="sticky top-0 z-10 border-b border-border bg-canvas/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1480px] flex-wrap items-center gap-3.5 px-4 py-2.5 md:px-7 md:py-3.5">
          <div className="flex flex-shrink-0 items-center gap-2.5">
            <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md bg-accent font-mono text-[13px] font-bold text-accent-fg">
              NS
            </div>
            <div className="min-w-0">
              <div className="text-base font-bold leading-none tracking-tight whitespace-nowrap">NBA Scout</div>
              <div className="mt-0.5 font-mono text-[9.5px] uppercase tracking-widest whitespace-nowrap text-fg-subtle">
                EV Analyzer
              </div>
            </div>
          </div>

          <div className="ml-1 flex flex-shrink-0 items-center gap-2 border-l border-border pl-4 font-mono text-[11px] whitespace-nowrap text-fg-subtle">
            <span className="live-dot" />
            {new Date().toLocaleDateString("pt-BR")} · {filtered.length} props
          </div>

          <div className="flex-1" />

          {data.demo_mode && <Badge tone="accent">⚡ DEMO · odds sintéticas</Badge>}
          {data.from_cache && !data.demo_mode && (
            <Badge tone="warn">
              Do cache · {generatedAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
            </Badge>
          )}

          <QuotaBadge used={used} limit={data.quota_limit} />
          <ThemeToggle />
          <RefreshCountdown />
        </div>

        {/* Abas de variação + favoritos */}
        <div className="mx-auto flex max-w-[1480px] gap-1 border-t border-border px-4 md:px-7">
          {VARIATIONS.map((v) => {
            const active = variation === v.k && !showFavOnly;
            return (
              <button
                key={v.k}
                onClick={() => {
                  setTweak("variation", v.k);
                  setShowFavOnly(false);
                }}
                className={cn(
                  "flex items-baseline gap-2 border-b-2 px-3.5 py-2.5 font-sans text-sm font-medium cursor-pointer transition-colors",
                  active ? "border-accent text-fg" : "border-transparent text-fg-subtle hover:text-fg-muted",
                )}
              >
                {v.label}
                <span className="font-mono text-[10px] text-fg-subtle">{v.desc}</span>
              </button>
            );
          })}
          <button
            onClick={() => setShowFavOnly((f) => !f)}
            className={cn(
              "flex items-baseline gap-2 border-b-2 px-3.5 py-2.5 font-sans text-sm font-medium cursor-pointer transition-colors",
              showFavOnly ? "border-accent text-accent" : "border-transparent text-fg-subtle hover:text-fg-muted",
            )}
          >
            ★ Favoritos
            {fav.count > 0 && (
              <span className="rounded-full border border-accent/35 bg-accent/12 px-1.5 py-px font-mono text-[10px] font-semibold text-accent">
                {fav.count}
              </span>
            )}
          </button>
        </div>
      </header>

      <main className="mx-auto flex max-w-[1480px] flex-col gap-4 px-3 pt-3.5 pb-16 md:px-7 md:pt-5 md:pb-20">
        <SummaryStrip metrics={metrics} />
        <FilterBar
          filters={filters}
          setFilters={setFilters}
          games={games}
          teams={teams}
          resultCount={filtered.length}
          onReset={() => setFilters({ ...DEFAULT_FILTERS })}
          onExport={() => exportCsv(filtered)}
        />

        <AnimatePresence mode="wait" initial={false}>
          <m.div
            key={showFavOnly ? "fav" : variation}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18 }}
          >
            {variation === "terminal" &&
              (isMobile ? <MobilePropList {...viewProps} /> : <PropsTableTerminal {...viewProps} {...sortProps} />)}
            {variation === "cards" && <PropsCards {...viewProps} />}
            {variation === "editorial" && <PropsEditorial {...viewProps} {...sortProps} />}
          </m.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
