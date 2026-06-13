// Painel expandido de uma prop (tabela Terminal) — migrado de static/dashboard.jsx.

import { TrendSparkline } from "../../components/atoms";
import { fmtKelly, fmtPct, fmtProb } from "../../lib/format";
import type { Prop } from "../../types/api";
import { evColor, hitColor } from "../../lib/colors";
import { bookmakerUrl } from "./bookmakers";

function AccStat({ label, value, color = "#cbd5e1" }: { label: string; value: string | number; color?: string }) {
  return (
    <div>
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
        {label}
      </div>
      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 600, color }}>{value}</div>
    </div>
  );
}

export function AccordionPanel({ prop }: { prop: Prop }) {
  const last5 = prop.last5_values || [];
  return (
    <div
      style={{
        padding: "14px 20px 14px 36px",
        background: "#0d0d11",
        borderTop: "1px solid #1e1e28",
        display: "flex",
        flexWrap: "wrap",
        gap: 28,
        alignItems: "flex-start",
      }}
    >
      {last5.length > 0 && (
        <div style={{ flexShrink: 0 }}>
          <div
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 9.5,
              color: "#5a5a72",
              marginBottom: 8,
              textTransform: "uppercase",
              letterSpacing: 0.6,
            }}
          >
            {prop.market} · Tend. 5J
          </div>
          <TrendSparkline data={last5} line={prop.line} w={220} h={60} />
        </div>
      )}

      <div style={{ display: "flex", gap: 20, flexWrap: "wrap", alignItems: "flex-start" }}>
        <AccStat label="Média 10J" value={prop.avg_stat_last10.toFixed(1)} />
        <AccStat label="Linha" value={prop.line} />
        <AccStat label="Prob. Impl." value={fmtProb(prop.implied_prob)} />
        <AccStat label="Prob. Real" value={fmtProb(prop.prob_real)} />
        <AccStat label="EV%" value={fmtPct(prop.ev_pct)} color={evColor(prop.ev_pct)} />
        <AccStat label="Kelly ¼" value={fmtKelly(prop.kelly_full_pct, "quarter")} color="#a5b4fc" />
        <AccStat
          label="Hit%"
          value={`${(prop.games_over_line_pct * 100).toFixed(0)}%`}
          color={hitColor(prop.games_over_line_pct)}
        />
        {prop.dvp_rank > 0 && (
          <AccStat
            label="DvP"
            value={`${prop.dvp_rank}°/${prop.dvp_total}`}
            color={prop.dvp_rank <= 10 ? "#4ade80" : prop.dvp_rank <= 20 ? "#fde047" : "#fca5a5"}
          />
        )}
        {prop.min_boost_pct > 0 && <AccStat label="Min Boost" value={`+${prop.min_boost_pct}%`} color="#fde047" />}
        {prop.pace > 0 && <AccStat label="Pace Def." value={prop.pace.toFixed(1)} />}
        {prop.def_rating_opponent > 0 && <AccStat label="Def Rat." value={prop.def_rating_opponent.toFixed(1)} />}
      </div>

      {prop.all_odds && prop.all_odds.length > 1 && (
        <div>
          <div
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 9.5,
              color: "#5a5a72",
              marginBottom: 8,
              textTransform: "uppercase",
              letterSpacing: 0.6,
            }}
          >
            Line Shopping
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {prop.all_odds.map((o, i) => {
              const best = o.bookmaker === prop.bookmaker;
              const bUrl = bookmakerUrl(o.bookmaker);
              return (
                <div
                  key={i}
                  onClick={bUrl ? () => window.open(bUrl, "_blank", "noopener,noreferrer") : undefined}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    padding: "6px 10px",
                    borderRadius: 6,
                    background: best ? "rgba(94,226,160,0.08)" : "#141419",
                    border: `1px solid ${best ? "rgba(94,226,160,0.3)" : "#2a2a38"}`,
                    cursor: bUrl ? "pointer" : "default",
                    minWidth: 58,
                  }}
                >
                  <span
                    style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: 9.5,
                      color: best ? "#5ee2a0" : "#5a5a72",
                      marginBottom: 3,
                    }}
                  >
                    {o.bookmaker}
                  </span>
                  <span
                    style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: 14,
                      fontWeight: 700,
                      color: best ? "#e8e8f0" : "#a0a0c0",
                    }}
                  >
                    {o.odd.toFixed(2)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
