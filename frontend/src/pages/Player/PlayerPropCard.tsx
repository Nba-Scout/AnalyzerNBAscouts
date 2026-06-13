// Card de prop na página do jogador (com tendência + hit rate) — migrado de static/player.jsx.

import { RatingBadge, Sparkline, Tooltip } from "../../components/atoms";
import { StarButton } from "../../components/StarButton";
import { fmtKelly, fmtOdd, fmtPct, fmtProb, type KellyMode, type OddMode } from "../../lib/format";
import { getStatValue } from "../../lib/playerStats";
import { ratingToken } from "../../lib/ratingTokens";
import type { Prop, RecentGame } from "../../types/api";
import { HitRateBar } from "./HitRateBar";

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
  // EV em 3 faixas (preservado verbatim do legado: sem tier neutro aqui).
  const evColor = prop.ev_pct >= 8 ? "#4ade80" : prop.ev_pct > 0 ? "#86efac" : "#fca5a5";
  const t = ratingToken(prop.rating);
  const isStrong = prop.rating === "STRONG";

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
      style={{
        background: isStrong ? "linear-gradient(180deg, #1c1c2a 0%, #161620 100%)" : "#1a1a23",
        border: `1px solid ${isStrong ? "rgba(99,102,241,0.38)" : "#2a2a38"}`,
        borderRadius: 10,
        padding: 14,
        position: "relative",
        overflow: "hidden",
        transition: "border-color .15s",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = isStrong ? "rgba(99,102,241,0.6)" : "#3a3a4a")}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = isStrong ? "rgba(99,102,241,0.38)" : "#2a2a38")}
    >
      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, background: t.dot }} />
      {isStrong && (
        <div
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            width: 80,
            height: 80,
            background: "radial-gradient(circle, rgba(99,102,241,0.12), transparent 70%)",
            pointerEvents: "none",
          }}
        />
      )}

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0, flex: 1 }}>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "#8888a0", whiteSpace: "nowrap" }}>
            {prop.game}
          </span>
          {prop.dvp_rank > 0 && prop.dvp_total > 0 && (
            <Tooltip text={`Defesa vs posição: ${prop.dvp_rank}º/${prop.dvp_total} — rank 1 = pior defesa (melhor matchup)`}>
              <span
                style={{
                  padding: "1px 6px",
                  borderRadius: 3,
                  fontSize: 9.5,
                  fontWeight: 600,
                  background:
                    prop.dvp_rank <= 10
                      ? "rgba(74,222,128,0.12)"
                      : prop.dvp_rank <= 20
                        ? "rgba(253,224,71,0.1)"
                        : "rgba(239,68,68,0.1)",
                  border: `1px solid ${prop.dvp_rank <= 10 ? "rgba(74,222,128,0.35)" : prop.dvp_rank <= 20 ? "rgba(253,224,71,0.3)" : "rgba(239,68,68,0.3)"}`,
                  color: prop.dvp_rank <= 10 ? "#4ade80" : prop.dvp_rank <= 20 ? "#fde047" : "#fca5a5",
                  whiteSpace: "nowrap",
                }}
              >
                DvP {prop.dvp_rank}°/{prop.dvp_total}
              </span>
            </Tooltip>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          <StarButton prop={prop} />
          <RatingBadge rating={prop.rating} />
        </div>
      </div>

      {/* Linha / mercado */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 12,
          padding: "9px 11px",
          background: "#0f0f13",
          borderRadius: 6,
          border: "1px solid rgba(42,42,56,0.6)",
          fontFamily: "'JetBrains Mono', monospace",
        }}
      >
        <span
          style={{
            padding: "2px 7px",
            borderRadius: 3,
            background: "rgba(90,90,114,0.15)",
            border: "1px solid rgba(90,90,114,0.25)",
            fontSize: 9.5,
            color: "#5a5a72",
            textTransform: "uppercase",
            letterSpacing: 0.5,
            fontWeight: 600,
          }}
        >
          {prop.market}
        </span>
        <span
          style={{
            color: prop.direction === "OVER" ? "#86efac" : "#fca5a5",
            fontSize: 11.5,
            fontWeight: 700,
            letterSpacing: 0.3,
          }}
        >
          {prop.direction}
        </span>
        <span style={{ color: "#e8e8f0", fontSize: 22, fontWeight: 700, letterSpacing: -0.5 }}>{prop.line}</span>
        <span style={{ flex: 1 }} />
        <span style={{ color: "#a0a0c0", fontSize: 12 }}>{fmtOdd(prop.odd, oddMode)}</span>
      </div>

      {/* Stats row */}
      <div
        style={{ display: "flex", justifyContent: "space-between", fontFamily: "'JetBrains Mono', monospace", fontSize: 11.5 }}
      >
        <Tooltip text="Expected Value: positivo = odd acima do valor justo.">
          <span style={{ color: "#5a5a72" }}>
            EV <span style={{ color: evColor, fontWeight: 700 }}>{fmtPct(prop.ev_pct)}</span>
          </span>
        </Tooltip>
        <Tooltip text="Probabilidade real estimada (forma recente + média de temporada).">
          <span style={{ color: "#5a5a72" }}>
            Prob <span style={{ color: "#cbd5e1" }}>{fmtProb(prop.prob_real)}</span>
          </span>
        </Tooltip>
        <Tooltip text="Fração de bankroll pelo critério de Kelly. Use como referência.">
          <span style={{ color: "#5a5a72" }}>
            Kelly <span style={{ color: "#a5b4fc" }}>{fmtKelly(prop.kelly_full_pct, kellyMode)}</span>
          </span>
        </Tooltip>
      </div>

      {/* Sparkline de tendência */}
      {sparkData && sparkData.length > 1 && (
        <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid #2a2a38" }}>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9.5, color: "#5a5a72", marginBottom: 5 }}>
            Tendência · {sparkData.length} jogos
          </div>
          <Sparkline data={sparkData} color={evColor === "#4ade80" ? "#4ade80" : "#6366f1"} w={220} h={38} line={prop.line} />
        </div>
      )}

      {/* Hit rate bar */}
      {hitData && <HitRateBar hit={hitData.hit} total={hitData.total} line={prop.line} direction={prop.direction} />}
    </div>
  );
}
