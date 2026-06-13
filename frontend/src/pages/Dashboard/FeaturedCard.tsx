// Card de destaque (Strong Bet) da variação Editorial — migrado de static/dashboard.jsx.

import { RatingBadge, Tooltip } from "../../components/atoms";
import { StarButton } from "../../components/StarButton";
import { fmtKelly, fmtOdd, fmtPct, fmtProb, type KellyMode, type OddMode } from "../../lib/format";
import type { Prop } from "../../types/api";
import { OddsShoppingBadge } from "./OddsShoppingBadge";
import { evColor, hitColor } from "./shared";

function BigStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div>
      <div style={{ fontSize: 9.5, color: "#5a5a72", textTransform: "uppercase", letterSpacing: 0.7, marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: 17, fontWeight: 600, color }}>{value}</div>
    </div>
  );
}

export function FeaturedCard({
  prop,
  onPlayer,
  oddMode,
  kellyMode,
}: {
  prop: Prop;
  onPlayer: (name: string) => void;
  oddMode: OddMode;
  kellyMode: KellyMode;
}) {
  return (
    <div
      style={{
        background: "linear-gradient(180deg, #1a1a28 0%, #15151d 100%)",
        border: "1px solid rgba(99,102,241,0.35)",
        borderRadius: 12,
        padding: 20,
        position: "relative",
        overflow: "hidden",
        transition: "border-color .15s, box-shadow .15s",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "rgba(99,102,241,0.6)";
        e.currentTarget.style.boxShadow = "0 4px 28px rgba(99,102,241,0.15)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "rgba(99,102,241,0.35)";
        e.currentTarget.style.boxShadow = "none";
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          width: 140,
          height: 140,
          background: "radial-gradient(circle, rgba(99,102,241,0.2), transparent 70%)",
          pointerEvents: "none",
        }}
      />
      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, background: "rgba(99,102,241,0.8)" }} />

      <div style={{ position: "relative" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14, gap: 12 }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <a
              onClick={() => onPlayer(prop.player_name)}
              style={{
                color: "#e8e8f0",
                cursor: "pointer",
                fontFamily: "'Inter Tight', sans-serif",
                fontWeight: 700,
                fontSize: 20,
                display: "block",
                lineHeight: 1.1,
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
                marginTop: 5,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {prop.team} · {prop.game}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            <StarButton prop={prop} />
            <RatingBadge rating={prop.rating} size="md" />
          </div>
        </div>

        {/* Linha principal */}
        <div
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 18,
            padding: "10px 12px",
            background: "rgba(15,15,19,0.8)",
            borderRadius: 7,
            border: "1px solid rgba(42,42,56,0.6)",
          }}
        >
          <span style={{ fontSize: 10.5, color: "#5a5a72", textTransform: "uppercase", letterSpacing: 0.6 }}>{prop.market}</span>
          <span style={{ color: prop.direction === "OVER" ? "#86efac" : "#fca5a5", fontSize: 13, fontWeight: 700 }}>
            {prop.direction}
          </span>
          <span style={{ fontSize: 30, color: "#e8e8f0", fontWeight: 700, letterSpacing: -1 }}>{prop.line}</span>
          {Math.abs(prop.line_movement) >= 0.5 && (
            <Tooltip text={`Abriu em ${prop.line_opened} · movimento ${prop.line_movement > 0 ? "+" : ""}${prop.line_movement}`}>
              <span style={{ fontSize: 13, color: prop.line_movement > 0 ? "#4ade80" : "#fca5a5" }}>
                {prop.line_movement > 0 ? "⬆" : "⬇"}
              </span>
            </Tooltip>
          )}
          <span style={{ flex: 1 }} />
          <span style={{ color: "#5a5a72", fontSize: 11 }}>@</span>
          <span style={{ color: "#a0a0c0", fontSize: 16, fontWeight: 600 }}>{fmtOdd(prop.odd, oddMode)}</span>
        </div>

        {/* Stats + hit rate */}
        <div style={{ display: "flex", gap: 22, fontFamily: "'JetBrains Mono', monospace", marginBottom: 12 }}>
          <BigStat label="EV%" value={fmtPct(prop.ev_pct)} color={evColor(prop.ev_pct)} />
          <BigStat label="Prob Real" value={fmtProb(prop.prob_real)} color="#cbd5e1" />
          <BigStat label="Kelly" value={fmtKelly(prop.kelly_full_pct, kellyMode)} color="#a5b4fc" />
          <BigStat
            label="Hit%"
            value={`${(prop.games_over_line_pct * 100).toFixed(0)}%`}
            color={hitColor(prop.games_over_line_pct)}
          />
        </div>

        {/* Bookmaker */}
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, color: "#5a5a72" }}>
          <OddsShoppingBadge bookmaker={prop.bookmaker} allOdds={prop.all_odds} />
        </div>
      </div>
    </div>
  );
}
