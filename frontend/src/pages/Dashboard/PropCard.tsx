// Card individual de prop (variação B / mobile) — migrado de static/dashboard.jsx.

import { type ReactNode, useState } from "react";

import { RatingBadge, Tooltip } from "../../components/atoms";
import { StarButton } from "../../components/StarButton";
import { fmtKelly, fmtOdd, fmtPct, fmtProb, type KellyMode, type OddMode } from "../../lib/format";
import { ratingToken } from "../../lib/ratingTokens";
import type { Prop } from "../../types/api";
import { OddsShoppingBadge } from "./OddsShoppingBadge";
import { evColor, hitColor, kellyStake } from "./shared";

function Stat({ label, value, color, tip, sub }: { label: string; value: string; color: string; tip?: string; sub?: ReactNode }) {
  return (
    <div style={{ background: "#141419", padding: "8px 10px" }}>
      <div
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 9.5,
          color: "#5a5a72",
          textTransform: "uppercase",
          letterSpacing: 0.6,
          marginBottom: 3,
        }}
      >
        {tip ? (
          <Tooltip text={tip}>
            <span>{label}</span>
            <span style={{ marginLeft: 3, fontSize: 8, color: "#3a3a4a" }}>ⓘ</span>
          </Tooltip>
        ) : (
          label
        )}
      </div>
      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 600, color }}>{value}</div>
      {sub && (
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9.5, color: "#5a5a72", marginTop: 1 }}>{sub}</div>
      )}
    </div>
  );
}

export function PropCard({
  prop,
  onPlayer,
  oddMode,
  kellyMode,
  bankroll = 0,
}: {
  prop: Prop;
  onPlayer: (name: string) => void;
  oddMode: OddMode;
  kellyMode: KellyMode;
  bankroll?: number;
}) {
  const t = ratingToken(prop.rating);
  const isStrong = prop.rating === "STRONG";
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: isStrong ? "linear-gradient(180deg, #1c1c2a 0%, #161620 100%)" : "#1a1a23",
        border: `1px solid ${
          isStrong ? (hovered ? "rgba(99,102,241,0.6)" : "rgba(99,102,241,0.4)") : hovered ? "#3a3a4a" : "#2a2a38"
        }`,
        borderRadius: 10,
        padding: 14,
        position: "relative",
        overflow: "hidden",
        transition: "border-color .15s, box-shadow .15s",
        boxShadow: isStrong && hovered ? "0 4px 24px rgba(99,102,241,0.12)" : "none",
      }}
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
            background: "radial-gradient(circle, rgba(99,102,241,0.14), transparent 70%)",
            pointerEvents: "none",
          }}
        />
      )}

      {/* Header: nome + badge */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, marginBottom: 10 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <a
            onClick={() => onPlayer(prop.player_name)}
            style={{
              color: "#e8e8f0",
              cursor: "pointer",
              fontFamily: "'Inter Tight', sans-serif",
              fontWeight: 600,
              fontSize: 14.5,
              display: "block",
              lineHeight: 1.2,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              transition: "color .12s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#a5b4fc")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "#e8e8f0")}
          >
            {prop.player_name}
          </a>
          <div
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 11,
              color: "#8888a0",
              marginTop: 3,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {prop.team} · {prop.game}
          </div>
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
          padding: "9px 11px",
          background: "#0f0f13",
          borderRadius: 6,
          marginBottom: 10,
          fontFamily: "'JetBrains Mono', monospace",
          border: "1px solid rgba(42,42,56,0.6)",
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
          style={{ color: prop.direction === "OVER" ? "#86efac" : "#fca5a5", fontSize: 12, fontWeight: 700, letterSpacing: 0.3 }}
        >
          {prop.direction === "OVER" ? "OVER" : "UNDER"}
        </span>
        <span style={{ color: "#e8e8f0", fontSize: 20, fontWeight: 700, letterSpacing: -0.5 }}>{prop.line}</span>
        {Math.abs(prop.line_movement) >= 0.5 && (
          <Tooltip text={`Abriu em ${prop.line_opened} · movimento ${prop.line_movement > 0 ? "+" : ""}${prop.line_movement}`}>
            <span style={{ fontSize: 12, color: prop.line_movement > 0 ? "#4ade80" : "#fca5a5" }}>
              {prop.line_movement > 0 ? "⬆" : "⬇"}
            </span>
          </Tooltip>
        )}
        <span style={{ flex: 1 }} />
        <span style={{ color: "#a0a0c0", fontSize: 12, fontWeight: 500 }}>{fmtOdd(prop.odd, oddMode)}</span>
      </div>

      {/* Stats grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: 1,
          background: "#2a2a38",
          border: "1px solid #2a2a38",
          borderRadius: 6,
          overflow: "hidden",
        }}
      >
        <Stat
          label="EV%"
          value={fmtPct(prop.ev_pct)}
          color={evColor(prop.ev_pct)}
          tip="Expected Value: quanto acima do valor justo está a odd. Positivo = vantagem matemática."
        />
        <Stat
          label="Prob Real"
          value={fmtProb(prop.prob_real)}
          color="#cbd5e1"
          tip="Probabilidade real estimada com base na forma recente + média da temporada."
        />
        <Stat
          label="Kelly"
          value={fmtKelly(prop.kelly_full_pct, kellyMode)}
          color={prop.kelly_pct > 0 ? "#a5b4fc" : "#5a5a72"}
          tip="Fração de bankroll sugerida pelo critério de Kelly. Use apenas como referência."
          sub={bankroll > 0 && prop.kelly_pct > 0 ? `R$${kellyStake(bankroll, prop.kelly_full_pct, kellyMode)}` : null}
        />
      </div>

      {/* Hit rate bar */}
      <div style={{ marginTop: 8 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: 3,
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 9.5,
            color: "#5a5a72",
          }}
        >
          <span>Hit rate · últimos jogos</span>
          <span style={{ color: hitColor(prop.games_over_line_pct), fontWeight: 600 }}>
            {(prop.games_over_line_pct * 100).toFixed(0)}%
          </span>
        </div>
        <div style={{ height: 3, background: "#2a2a38", borderRadius: 2, overflow: "hidden" }}>
          <div
            style={{
              width: `${prop.games_over_line_pct * 100}%`,
              height: "100%",
              background: hitColor(prop.games_over_line_pct),
              borderRadius: 2,
              transition: "width .4s",
            }}
          />
        </div>
      </div>

      <div style={{ marginTop: 10, fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, color: "#5a5a72" }}>
        <OddsShoppingBadge bookmaker={prop.bookmaker} allOdds={prop.all_odds} />
      </div>
    </div>
  );
}
