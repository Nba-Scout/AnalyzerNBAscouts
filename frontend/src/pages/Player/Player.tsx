// Página de detalhe do jogador — tokenizado (Etapa 4). Dados via usePlayer + useProps.

import { usePlayer, useProps } from "../../api/queries";
import { SectionLabel } from "../../components/SectionLabel";
import { ThemeToggle } from "../../components/ThemeToggle";
import { Badge, Button, Skeleton } from "../../components/ui";
import type { Tweaks } from "../../hooks/useTweaks";
import { AvgCard } from "./AvgCard";
import { HeroSparkPanel } from "./HeroSparkPanel";
import { HistorySection } from "./HistorySection";
import { PropsTabs } from "./PropsTabs";

function PageShell({ onBack, loading, children }: { onBack: () => void; loading?: boolean; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-canvas font-sans text-fg">
      <header className="sticky top-0 z-10 border-b border-border bg-canvas/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1280px] items-center gap-4 px-4 py-3 md:px-7">
          <Button variant="outline" size="sm" onClick={onBack}>
            ← Voltar
          </Button>
          <div className="font-mono text-[10.5px] uppercase tracking-widest text-fg-subtle">NBA SCOUT / JOGADOR</div>
          {loading && <div className="ml-auto font-mono text-[10.5px] text-fg-subtle">Carregando…</div>}
          <div className={loading ? "" : "ml-auto"} />
          <ThemeToggle />
        </div>
      </header>
      <main className="mx-auto flex max-w-[1280px] flex-col gap-5 px-4 py-6 md:px-7">{children}</main>
    </div>
  );
}

function PlayerSkeleton({ onBack }: { onBack: () => void }) {
  return (
    <PageShell onBack={onBack}>
      <section className="flex items-center gap-5 rounded-xl border border-border bg-surface p-6">
        <Skeleton className="h-16 w-16 flex-shrink-0 rounded-xl" />
        <div className="flex flex-1 flex-col gap-2.5">
          <Skeleton className="h-7 w-3/5" />
          <Skeleton className="h-4 w-1/3" />
        </div>
        <Skeleton className="h-16 w-44 rounded-lg" />
      </section>
      <section>
        <Skeleton className="mb-3 h-3 w-40" />
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-8">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-3.5">
              <Skeleton className="h-2.5 w-2/5" />
              <Skeleton className="h-5 w-3/5" />
            </div>
          ))}
        </div>
      </section>
    </PageShell>
  );
}

export function Player({ name, onBack, tweaks }: { name: string; onBack: () => void; tweaks: Tweaks }) {
  const { data: player, isLoading, isFetching, isError } = usePlayer(name);
  const { data: propsData } = useProps();

  if (isLoading) return <PlayerSkeleton onBack={onBack} />;

  if (isError || !player) {
    return (
      <PageShell onBack={onBack}>
        <div className="rounded-lg border border-dashed border-border bg-surface px-6 py-10 text-center font-sans text-fg-muted">
          Jogador <strong className="text-fg">{name}</strong> não encontrado.
        </div>
      </PageShell>
    );
  }

  const playerProps = (propsData?.props ?? []).filter((p) => p.player_name.toLowerCase() === name.toLowerCase());

  // recent_games é newest-first; .reverse() → oldest-first para os sparklines.
  const games = player.recent_games;
  const ptsSpark = games.map((g) => g.pts).reverse();
  const rebSpark = games.map((g) => g.reb).reverse();
  const astSpark = games.map((g) => g.ast).reverse();
  const praSpark = games.map((g) => g.pts + g.reb + g.ast).reverse();
  const prSpark = games.map((g) => g.pts + g.reb).reverse();
  const paSpark = games.map((g) => g.pts + g.ast).reverse();
  const fg3mSpark = games.map((g) => g.fg3m).reverse();
  const stocksSpark = games.map((g) => g.blk + g.stl).reverse();

  const avgMin = games.length > 0 ? games.reduce((s, g) => s + g.min, 0) / games.length : 0;

  // Linha de cada prop de hoje (apenas OVER) para colorir o histórico.
  const propLines: Record<string, number> = {};
  for (const p of playerProps) {
    if (p.direction === "OVER" && !(p.market in propLines)) propLines[p.market] = p.line;
  }

  function cellColor(val: number, market: string): string | null {
    const line = propLines[market];
    if (line == null) return null;
    if (val > line) return "var(--c-ev-strong)";
    if (val < line) return "var(--c-ev-neg)";
    return "var(--c-hit-mid)";
  }

  const initials = player.name
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("");

  const poStats: { label: string; value: string; cls: string }[] = [
    { label: "Jogos PO", value: String(player.playoff_history.games_count), cls: "text-fg" },
    { label: "PTS médio", value: player.playoff_history.avg_pts.toFixed(1), cls: "text-accent" },
    { label: "REB médio", value: player.playoff_history.avg_reb.toFixed(1), cls: "text-ev-strong" },
    { label: "AST médio", value: player.playoff_history.avg_ast.toFixed(1), cls: "text-info" },
  ];

  return (
    <PageShell onBack={onBack} loading={isFetching}>
      {/* Hero */}
      <section className="relative flex flex-wrap items-center gap-6 overflow-hidden rounded-xl border border-border bg-gradient-to-br from-raised to-surface p-6">
        <div className="pointer-events-none absolute -left-10 -top-10 h-52 w-52 rounded-full bg-accent/8 blur-3xl" />
        <div className="flex h-[68px] w-[68px] flex-shrink-0 items-center justify-center rounded-2xl border border-accent/30 bg-raised font-mono text-[22px] font-bold text-accent">
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-sans text-3xl font-bold tracking-tight">{player.name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2.5">
            <Badge tone="accent">{player.teamAbbr}</Badge>
            <span className="font-mono text-[11px] text-fg-subtle">
              {player.position} · {player.height} · {player.age}a
            </span>
          </div>
          <div className="mt-1.5 font-sans text-[13px] text-fg-muted">{player.team}</div>
        </div>
        <HeroSparkPanel ptsSpark={ptsSpark} rebSpark={rebSpark} astSpark={astSpark} />
      </section>

      {/* Médias */}
      <section>
        <SectionLabel>Médias (últimos {player.recent_games.length || "—"} jogos)</SectionLabel>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-8">
          <AvgCard label="PTS" value={player.averages.PTS} spark={ptsSpark} />
          <AvgCard label="REB" value={player.averages.REB} spark={rebSpark} />
          <AvgCard label="AST" value={player.averages.AST} spark={astSpark} />
          <AvgCard label="PRA" value={player.averages.PRA} spark={praSpark} />
          <AvgCard label="P+R" value={player.averages.PR} spark={prSpark} />
          <AvgCard label="P+A" value={player.averages.PA} spark={paSpark} />
          <AvgCard label="3PM" value={player.averages.FG3M} spark={fg3mSpark} />
          <AvgCard label="STOCKS" value={player.averages.STOCKS} spark={stocksSpark} sub="BLK + STL" />
        </div>
      </section>

      {/* Props de hoje */}
      {playerProps.length > 0 && (
        <section>
          <SectionLabel>Props hoje · {playerProps.length}</SectionLabel>
          <PropsTabs
            props={playerProps}
            oddMode={tweaks.oddMode}
            kellyMode={tweaks.kellyMode}
            recentGames={player.recent_games}
          />
        </section>
      )}

      {/* Histórico recente */}
      <section>
        <HistorySection
          games={player.recent_games}
          propLines={propLines}
          avgMin={avgMin}
          loadingPlayer={isFetching}
          splits={player.home_away_splits}
          cellColor={cellColor}
        />
      </section>

      {/* Histórico de playoffs */}
      <section>
        <SectionLabel>Histórico de playoffs</SectionLabel>
        <div className="overflow-hidden rounded-lg border border-border bg-surface">
          {player.playoff_history.seasons.length > 0 && (
            <div className="flex flex-wrap items-center gap-2.5 border-b border-border px-4 py-2.5 font-mono text-[10.5px]">
              <span className="text-[9px] uppercase tracking-wide text-fg-subtle">Temporadas</span>
              {player.playoff_history.seasons.map((seas) => (
                <span
                  key={seas}
                  className="rounded-sm border border-info/25 bg-info/12 px-1.5 py-0.5 text-[10px] font-semibold text-info"
                >
                  {seas}
                </span>
              ))}
            </div>
          )}
          <div className="flex flex-wrap">
            {poStats.map((item, i) => (
              <div
                key={item.label}
                className={
                  i < poStats.length - 1 ? "flex-[1_1_120px] border-r border-border px-4 py-3.5" : "flex-[1_1_120px] px-4 py-3.5"
                }
              >
                <div className="mb-1.5 font-mono text-[9px] uppercase tracking-wide text-fg-subtle">{item.label}</div>
                <div className={`font-mono text-[22px] font-bold tracking-tight tabular-nums ${item.cls}`}>{item.value}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </PageShell>
  );
}
