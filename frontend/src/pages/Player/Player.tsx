// Página de detalhe do jogador — migrado de static/player.jsx::Player.
// Dados via usePlayer (detalhe) + useProps (props de hoje do jogador).

import { useProps } from "../../api/queries";
import { usePlayer } from "../../api/queries";
import { SkeletonBlock } from "../../components/atoms";
import { SectionLabel } from "../../components/SectionLabel";
import type { Tweaks } from "../../hooks/useTweaks";
import { HeroSparkPanel } from "./HeroSparkPanel";
import { AvgCard } from "./AvgCard";
import { HistorySection } from "./HistorySection";
import { PropsTabs } from "./PropsTabs";

function PageShell({ onBack, loading, children }: { onBack: () => void; loading?: boolean; children: React.ReactNode }) {
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
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "14px 28px", display: "flex", alignItems: "center", gap: 16 }}>
          <button
            onClick={onBack}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              flexShrink: 0,
              whiteSpace: "nowrap",
              background: "transparent",
              border: "1px solid #2a2a38",
              color: "#cbd5e1",
              padding: "6px 12px",
              borderRadius: 6,
              cursor: "pointer",
              fontFamily: "'Inter Tight', sans-serif",
              fontSize: 12.5,
            }}
          >
            ← Voltar
          </button>
          <div
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 10.5,
              color: "#5a5a72",
              textTransform: "uppercase",
              letterSpacing: 0.7,
            }}
          >
            NBA SCOUT / JOGADOR
          </div>
          {loading && (
            <div style={{ marginLeft: "auto", fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, color: "#5a5a72" }}>
              Carregando…
            </div>
          )}
        </div>
      </header>
      <main style={{ maxWidth: 1280, margin: "0 auto", padding: "28px", display: "flex", flexDirection: "column", gap: 22 }}>
        {children}
      </main>
    </div>
  );
}

function PlayerSkeleton({ onBack }: { onBack: () => void }) {
  return (
    <PageShell onBack={onBack}>
      <section
        style={{
          background: "#1a1a23",
          border: "1px solid #2a2a38",
          borderRadius: 10,
          padding: "22px 26px",
          display: "flex",
          alignItems: "center",
          gap: 22,
        }}
      >
        <SkeletonBlock w={64} h={64} style={{ borderRadius: 12, flexShrink: 0 }} />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10 }}>
          <SkeletonBlock w="55%" h={28} />
          <SkeletonBlock w="30%" h={16} />
        </div>
        <SkeletonBlock w={180} h={62} style={{ borderRadius: 8 }} />
      </section>
      <section>
        <SkeletonBlock w={160} h={12} style={{ marginBottom: 12 }} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              style={{
                padding: "12px 14px",
                background: "#1a1a23",
                border: "1px solid #2a2a38",
                borderRadius: 7,
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              <SkeletonBlock w="40%" h={10} />
              <SkeletonBlock w="60%" h={22} />
            </div>
          ))}
        </div>
      </section>
      <section>
        <SkeletonBlock w={120} h={12} style={{ marginBottom: 12 }} />
        <div
          style={{
            background: "#141419",
            border: "1px solid #2a2a38",
            borderRadius: 8,
            padding: 16,
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonBlock key={i} w="100%" h={18} />
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
        <div
          style={{
            padding: "40px 24px",
            textAlign: "center",
            color: "#8888a0",
            background: "#141419",
            border: "1px dashed #2a2a38",
            borderRadius: 8,
            fontFamily: "'Inter Tight', sans-serif",
          }}
        >
          Jogador <strong style={{ color: "#cbd5e1" }}>{name}</strong> não encontrado.
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
    if (p.direction === "OVER" && !(p.market in propLines)) {
      propLines[p.market] = p.line;
    }
  }

  function cellColor(val: number, market: string): string | null {
    const line = propLines[market];
    if (line == null) return null;
    if (val > line) return "#4ade80";
    if (val < line) return "#fca5a5";
    return "#fde047";
  }

  return (
    <PageShell onBack={onBack} loading={isFetching}>
      {/* Hero */}
      <section
        style={{
          background: "linear-gradient(135deg, #1a1a28 0%, #15151d 100%)",
          border: "1px solid #2a2a38",
          borderRadius: 12,
          padding: "24px 28px",
          display: "flex",
          alignItems: "center",
          gap: 24,
          flexWrap: "wrap",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: -40,
            left: -40,
            width: 200,
            height: 200,
            background: "radial-gradient(circle, rgba(99,102,241,0.08), transparent 70%)",
            pointerEvents: "none",
          }}
        />
        <div
          style={{
            width: 68,
            height: 68,
            borderRadius: 14,
            flexShrink: 0,
            background: "linear-gradient(135deg, #3a3a58, #2a2a38)",
            border: "1px solid rgba(99,102,241,0.3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 22,
            fontWeight: 700,
            color: "#a5b4fc",
            boxShadow: "0 2px 12px rgba(99,102,241,0.15)",
          }}
        >
          {player.name
            .split(" ")
            .map((s) => s[0])
            .slice(0, 2)
            .join("")}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <h1
            style={{
              margin: 0,
              fontSize: 30,
              fontWeight: 700,
              letterSpacing: -0.8,
              fontFamily: "'Inter Tight', sans-serif",
              lineHeight: 1.1,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {player.name}
          </h1>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginTop: 8 }}>
            <span
              style={{
                padding: "3px 8px",
                borderRadius: 4,
                background: "rgba(99,102,241,0.14)",
                border: "1px solid rgba(99,102,241,0.35)",
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 11,
                color: "#c7d2fe",
                fontWeight: 700,
                letterSpacing: 0.3,
              }}
            >
              {player.teamAbbr}
            </span>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "#5a5a72" }}>
              {player.position} · {player.height} · {player.age}a
            </span>
          </div>
          <div style={{ marginTop: 6, color: "#8888a0", fontSize: 13, fontFamily: "'Inter Tight', sans-serif" }}>
            {player.team}
          </div>
        </div>
        <HeroSparkPanel ptsSpark={ptsSpark} rebSpark={rebSpark} astSpark={astSpark} />
      </section>

      {/* Médias */}
      <section>
        <SectionLabel>Médias (últimos {player.recent_games.length || "—"} jogos)</SectionLabel>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
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
        <div style={{ background: "#141419", border: "1px solid #2a2a38", borderRadius: 8, overflow: "hidden" }}>
          {player.playoff_history.seasons.length > 0 && (
            <div
              style={{
                padding: "10px 16px",
                borderBottom: "1px solid #2a2a38",
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 10.5,
                display: "flex",
                alignItems: "center",
                gap: 10,
                flexWrap: "wrap",
              }}
            >
              <span style={{ color: "#5a5a72", textTransform: "uppercase", letterSpacing: 0.7, fontSize: 9 }}>Temporadas</span>
              {player.playoff_history.seasons.map((seas) => (
                <span
                  key={seas}
                  style={{
                    padding: "2px 7px",
                    borderRadius: 3,
                    background: "rgba(168,85,247,0.1)",
                    border: "1px solid rgba(168,85,247,0.25)",
                    color: "#d8b4fe",
                    fontWeight: 600,
                    fontSize: 10,
                  }}
                >
                  {seas}
                </span>
              ))}
            </div>
          )}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 0 }}>
            {[
              { label: "Jogos PO", value: String(player.playoff_history.games_count), color: "#e8e8f0" },
              { label: "PTS médio", value: Number(player.playoff_history.avg_pts).toFixed(1), color: "#6366f1" },
              { label: "REB médio", value: Number(player.playoff_history.avg_reb).toFixed(1), color: "#22c55e" },
              { label: "AST médio", value: Number(player.playoff_history.avg_ast).toFixed(1), color: "#f59e0b" },
            ].map((item, i, arr) => (
              <div
                key={item.label}
                style={{
                  flex: "1 1 120px",
                  padding: "14px 16px",
                  borderRight: i < arr.length - 1 ? "1px solid #2a2a38" : "none",
                }}
              >
                <div
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 9,
                    color: "#5a5a72",
                    textTransform: "uppercase",
                    letterSpacing: 0.8,
                    marginBottom: 6,
                  }}
                >
                  {item.label}
                </div>
                <div
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 22,
                    fontWeight: 700,
                    color: item.color,
                    letterSpacing: -0.5,
                  }}
                >
                  {item.value}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </PageShell>
  );
}
