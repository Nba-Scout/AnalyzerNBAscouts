// Dashboard root — migrado de static/dashboard.jsx::Dashboard.
// Dados via useProps (TanStack Query); favoritos via useFavorites; tweaks vêm do App.

import { useEffect, useMemo, useState } from "react";

import { useProps } from "../../api/queries";
import { QuotaBadge } from "../../components/atoms";
import { ThemeToggle } from "../../components/ThemeToggle";
import { ErrorScreen } from "../../components/screens/ErrorScreen";
import { LoadingScreen } from "../../components/screens/LoadingScreen";
import { useFavorites } from "../../hooks/useFavorites";
import { useIsMobile } from "../../hooks/useIsMobile";
import type { Tweaks, TweaksApi } from "../../hooks/useTweaks";
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

  return (
    <div style={{ minHeight: "100vh", background: "#0f0f13", color: "#e8e8f0", fontFamily: "'Inter Tight', sans-serif" }}>
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          background: "rgba(15,15,19,0.92)",
          backdropFilter: "blur(8px)",
          borderBottom: "1px solid #2a2a38",
        }}
      >
        <div
          style={{
            maxWidth: 1480,
            margin: "0 auto",
            padding: isMobile ? "10px 14px" : "14px 28px",
            display: "flex",
            alignItems: "center",
            gap: 14,
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 6,
                flexShrink: 0,
                background: "linear-gradient(135deg, #6366f1, #4f46e5)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: "'JetBrains Mono', monospace",
                fontWeight: 700,
                fontSize: 13,
                color: "#fff",
              }}
            >
              NS
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 16, lineHeight: 1, letterSpacing: -0.2, whiteSpace: "nowrap" }}>
                NBA Scout
              </div>
              <div
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 9.5,
                  color: "#5a5a72",
                  textTransform: "uppercase",
                  letterSpacing: 1,
                  marginTop: 2,
                  whiteSpace: "nowrap",
                }}
              >
                EV Analyzer
              </div>
            </div>
          </div>

          <div
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 11,
              color: "#5a5a72",
              paddingLeft: 16,
              marginLeft: 4,
              borderLeft: "1px solid #2a2a38",
              display: "flex",
              alignItems: "center",
              gap: 8,
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}
          >
            <span
              style={{
                display: "inline-block",
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: "#22c55e",
                boxShadow: "0 0 6px #22c55e",
              }}
            />
            {new Date().toLocaleDateString("pt-BR")} · {filtered.length} props
          </div>

          <div style={{ flex: 1 }} />

          {data.demo_mode && (
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "5px 10px",
                borderRadius: 6,
                flexShrink: 0,
                whiteSpace: "nowrap",
                background: "rgba(139,92,246,0.12)",
                border: "1px solid rgba(139,92,246,0.4)",
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 11,
                color: "#c4b5fd",
                fontWeight: 600,
                letterSpacing: "0.04em",
              }}
            >
              ⚡ DEMO · odds sintéticas
            </div>
          )}

          {data.from_cache && !data.demo_mode && (
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "6px 10px",
                borderRadius: 6,
                flexShrink: 0,
                whiteSpace: "nowrap",
                background: "rgba(234,179,8,0.08)",
                border: "1px solid rgba(234,179,8,0.25)",
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 11,
                color: "#fde047",
              }}
            >
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#eab308" }} />
              Do cache · {generatedAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
            </div>
          )}

          <QuotaBadge used={used} limit={data.quota_limit} />

          <ThemeToggle />

          <RefreshCountdown />
        </div>

        {/* Abas de variação + favoritos */}
        <div
          style={{
            maxWidth: 1480,
            margin: "0 auto",
            padding: isMobile ? "0 14px" : "0 28px",
            display: "flex",
            gap: 4,
            borderTop: "1px solid #2a2a38",
          }}
        >
          {VARIATIONS.map((v) => {
            const active = variation === v.k && !showFavOnly;
            return (
              <button
                key={v.k}
                onClick={() => {
                  setTweak("variation", v.k);
                  setShowFavOnly(false);
                }}
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  padding: "10px 14px",
                  color: active ? "#e8e8f0" : "#5a5a72",
                  borderBottom: `2px solid ${active ? "#6366f1" : "transparent"}`,
                  fontFamily: "'Inter Tight', sans-serif",
                  fontSize: 13,
                  fontWeight: 500,
                  display: "flex",
                  alignItems: "baseline",
                  gap: 8,
                  transition: "color .12s",
                }}
              >
                {v.label}
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "#5a5a72" }}>{v.desc}</span>
              </button>
            );
          })}
          <button
            onClick={() => setShowFavOnly((f) => !f)}
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              padding: "10px 14px",
              color: showFavOnly ? "#fde047" : "#5a5a72",
              borderBottom: `2px solid ${showFavOnly ? "#fde047" : "transparent"}`,
              fontFamily: "'Inter Tight', sans-serif",
              fontSize: 13,
              fontWeight: 500,
              display: "flex",
              alignItems: "baseline",
              gap: 8,
              transition: "color .12s",
            }}
          >
            ★ Favoritos
            {fav.count > 0 && (
              <span
                style={{
                  marginLeft: 4,
                  padding: "1px 6px",
                  borderRadius: 10,
                  background: showFavOnly ? "rgba(253,224,71,0.2)" : "rgba(253,224,71,0.1)",
                  border: "1px solid rgba(253,224,71,0.3)",
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 10,
                  color: "#fde047",
                  fontWeight: 600,
                }}
              >
                {fav.count}
              </span>
            )}
          </button>
        </div>
      </header>

      <main
        style={{
          maxWidth: 1480,
          margin: "0 auto",
          padding: isMobile ? "14px 12px 60px" : "20px 28px 80px",
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
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

        {variation === "terminal" &&
          (isMobile ? (
            <MobilePropList
              props={filtered}
              onPlayer={onPlayer}
              oddMode={tweaks.oddMode}
              kellyMode={tweaks.kellyMode}
              bankroll={bankroll}
            />
          ) : (
            <PropsTableTerminal
              props={filtered}
              onPlayer={onPlayer}
              oddMode={tweaks.oddMode}
              kellyMode={tweaks.kellyMode}
              bankroll={bankroll}
              {...sortProps}
            />
          ))}
        {variation === "cards" && (
          <PropsCards
            props={filtered}
            onPlayer={onPlayer}
            oddMode={tweaks.oddMode}
            kellyMode={tweaks.kellyMode}
            bankroll={bankroll}
          />
        )}
        {variation === "editorial" && (
          <PropsEditorial
            props={filtered}
            onPlayer={onPlayer}
            oddMode={tweaks.oddMode}
            kellyMode={tweaks.kellyMode}
            bankroll={bankroll}
            {...sortProps}
          />
        )}
      </main>
    </div>
  );
}
