// Variação A — tabela "trading terminal" densa, com paginação, linhas expansíveis
// e cabeçalhos ordenáveis. Migrado de static/dashboard.jsx.

import { Fragment, useState } from "react";

import { FlashCell, Gauge, RatingBadge, Tooltip, TrendSparkline } from "../../components/atoms";
import { StarButton } from "../../components/StarButton";
import { fmtKelly, fmtOdd, fmtPct, fmtProb, normEv } from "../../lib/format";
import type { Prop } from "../../types/api";
import { AccordionPanel } from "./AccordionPanel";
import { InjuryAlert } from "./InjuryAlert";
import { OddsShoppingBadge } from "./OddsShoppingBadge";
import { evColor, hitColor, kellyStake, pageBtnStyle, type SortHandlers, type ViewProps } from "./shared";

const HEADER_TIPS: Record<string, string> = {
  "Prob Real": "Probabilidade verdadeira estimada de o evento acontecer, ponderando forma recente e média da temporada.",
  "EV%": "Expected Value: quanto acima do valor justo está a odd. Positivo = aposta com vantagem matemática.",
  "Kelly%": "Fração do bankroll sugerida pelo critério de Kelly. Indica convicção proporcional ao EV.",
  Rating: "STRONG ≥ EV 8% e prob ≥ 60% · VALUE = EV positivo · NEUTRAL ≈ zero · AVOID = EV negativo.",
  Odd: "Odd decimal. Implied prob = 1 / odd.",
  "Hit%": "% dos últimos jogos em que o jogador bateu essa linha. ≥60% verde · 40-60% amarelo · <40% vermelho.",
};

const PAGE = 12;

export function PropsTableTerminal({
  props,
  onPlayer,
  oddMode,
  kellyMode,
  bankroll = 0,
  sortBy,
  sortDir,
  onSort,
}: ViewProps & Partial<SortHandlers>) {
  const [page, setPage] = useState(0);
  const [expandedRow, setExpandedRow] = useState<number | null>(null);

  // Reset de página/expansão quando o conjunto de props muda — ajuste de estado
  // durante o render (em vez de setState num effect; regra react-hooks).
  const [trackedProps, setTrackedProps] = useState<Prop[]>(props);
  if (trackedProps !== props) {
    setTrackedProps(props);
    setPage(0);
    setExpandedRow(null);
  }

  const pageData = props.slice(page * PAGE, (page + 1) * PAGE);
  const pageCount = Math.max(1, Math.ceil(props.length / PAGE));

  function header(label: string, key: string | null, align: "left" | "right" | "center" = "left") {
    const active = !!key && sortBy === key;
    const tip = HEADER_TIPS[label];
    const arrow = active ? (sortDir === "desc" ? " ↓" : " ↑") : "";
    return (
      <th
        onClick={() => key && onSort && onSort(key)}
        style={{
          textAlign: align,
          padding: "10px 12px",
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 10,
          fontWeight: 500,
          color: active ? "#a5b4fc" : "#5a5a72",
          textTransform: "uppercase",
          letterSpacing: 0.7,
          cursor: "pointer",
          borderBottom: "1px solid #2a2a38",
          whiteSpace: "nowrap",
          userSelect: "none",
        }}
      >
        {tip ? (
          <Tooltip text={tip}>
            <span>
              {label}
              {arrow}
            </span>
            <span style={{ marginLeft: 4, fontSize: 9, color: "#3a3a4a" }}>ⓘ</span>
          </Tooltip>
        ) : (
          <>
            {label}
            {arrow}
          </>
        )}
      </th>
    );
  }

  return (
    <div style={{ background: "#141419", border: "1px solid #2a2a38", borderRadius: 8, overflow: "hidden" }}>
      <div style={{ overflowX: "auto", overflowY: "auto", maxHeight: 580 }}>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 12.5,
            color: "#e8e8f0",
          }}
        >
          <thead style={{ background: "#0f0f13", position: "sticky", top: 0, zIndex: 2 }}>
            <tr>
              {header("Jogador", "player_name")}
              {header("Jogo", "game")}
              {header("Mercado", "market")}
              {header("Linha", "line", "right")}
              {header("Dir", "direction")}
              {header("Odd", "odd", "right")}
              {header("Hit%", "games_over_line_pct", "right")}
              {header("Tend 5J", null, "center")}
              {header("Prob Real", "prob_real", "right")}
              {header("EV%", "ev_pct", "right")}
              {header("Kelly%", "kelly_pct", "right")}
              {header("Rating", "rating")}
              {header("Casa", "bookmaker")}
              <th style={{ width: 28, borderBottom: "1px solid #2a2a38" }} />
            </tr>
          </thead>
          <tbody>
            {pageData.map((p, i) => {
              const globalIdx = page * PAGE + i;
              const isExpanded = expandedRow === globalIdx;
              const strong = p.rating === "STRONG";
              const rowBg = strong ? "rgba(99,102,241,0.05)" : i % 2 ? "#141419" : "#161620";
              return (
                <Fragment key={globalIdx}>
                  <tr
                    onClick={() => setExpandedRow(isExpanded ? null : globalIdx)}
                    style={{
                      background: isExpanded ? "#1e1e28" : rowBg,
                      borderBottom: "1px solid rgba(42,42,56,0.5)",
                      transition: "background .12s",
                      cursor: "pointer",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#1e1e28")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = isExpanded ? "#1e1e28" : rowBg)}
                  >
                    <td style={{ padding: "10px 12px", whiteSpace: "nowrap" }}>
                      <span onClick={(e) => e.stopPropagation()}>
                        <StarButton prop={p} style={{ marginRight: 4 }} />
                      </span>
                      <a
                        onClick={(e) => {
                          e.stopPropagation();
                          onPlayer(p.player_name);
                        }}
                        style={{
                          color: "#c7d2fe",
                          cursor: "pointer",
                          textDecoration: "none",
                          fontFamily: "'Inter Tight', sans-serif",
                          fontWeight: 500,
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = "#a5b4fc")}
                        onMouseLeave={(e) => (e.currentTarget.style.color = "#c7d2fe")}
                      >
                        {p.player_name}
                      </a>
                      <span style={{ color: "#5a5a72", marginLeft: 8, fontSize: 10.5 }}>{p.team}</span>
                      <InjuryAlert injuries={p.team_injuries} />
                    </td>
                    <td style={{ padding: "10px 12px", color: "#8888a0" }}>{p.game}</td>
                    <td style={{ padding: "10px 12px", color: "#cbd5e1" }}>{p.market}</td>
                    <td style={{ padding: "10px 12px", textAlign: "right", whiteSpace: "nowrap" }}>
                      {p.line}
                      {Math.abs(p.line_movement) >= 0.5 && (
                        <Tooltip
                          text={`Abriu em ${p.line_opened} · movimento ${p.line_movement > 0 ? "+" : ""}${p.line_movement}`}
                        >
                          <span style={{ marginLeft: 5, fontSize: 11, color: p.line_movement > 0 ? "#4ade80" : "#fca5a5" }}>
                            {p.line_movement > 0 ? "⬆" : "⬇"}
                          </span>
                        </Tooltip>
                      )}
                    </td>
                    <td style={{ padding: "10px 12px", color: p.direction === "OVER" ? "#86efac" : "#fca5a5" }}>
                      {p.direction === "OVER" ? "▲ O" : "▼ U"}
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "right" }}>
                      <FlashCell value={p.odd} format={(v) => fmtOdd(v, oddMode)} />
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "right" }}>
                      <span style={{ color: hitColor(p.games_over_line_pct), fontWeight: 600 }}>
                        {(p.games_over_line_pct * 100).toFixed(0)}%
                      </span>
                    </td>
                    <td style={{ padding: "8px 12px", textAlign: "center" }}>
                      <TrendSparkline data={p.last5_values || []} line={p.line} w={64} h={20} />
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "right", color: "#cbd5e1" }}>{fmtProb(p.prob_real)}</td>
                    <td style={{ padding: "8px 12px", textAlign: "right" }}>
                      <div style={{ display: "inline-flex", alignItems: "center", gap: 5, justifyContent: "flex-end" }}>
                        <Gauge value={normEv(p.ev_pct)} w={36} h={20} thickness={4} />
                        <span style={{ color: evColor(p.ev_pct), fontWeight: 600 }}>{fmtPct(p.ev_pct)}</span>
                      </div>
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "right", color: p.kelly_pct > 0 ? "#a5b4fc" : "#5a5a72" }}>
                      {fmtKelly(p.kelly_full_pct, kellyMode)}
                      {bankroll > 0 && p.kelly_pct > 0 && (
                        <div style={{ fontSize: 9.5, color: "#5a5a72", marginTop: 1 }}>
                          R${kellyStake(bankroll, p.kelly_full_pct, kellyMode)}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      <RatingBadge rating={p.rating} />
                    </td>
                    <td style={{ padding: "10px 12px", fontSize: 11 }} onClick={(e) => e.stopPropagation()}>
                      <OddsShoppingBadge bookmaker={p.bookmaker} allOdds={p.all_odds} />
                    </td>
                    <td style={{ padding: "10px 8px", textAlign: "center", color: "#3a3a52", fontSize: 10 }}>
                      {isExpanded ? "▲" : "▼"}
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr>
                      <td colSpan={14} style={{ padding: 0 }}>
                        <AccordionPanel prop={p} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            {pageData.length === 0 && (
              <tr>
                <td colSpan={14} style={{ padding: 40, textAlign: "center", color: "#5a5a72" }}>
                  Nenhuma prop bate seus filtros.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {pageCount > 1 && (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "10px 14px",
            borderTop: "1px solid #2a2a38",
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 11,
            color: "#8888a0",
          }}
        >
          <span>
            Página {page + 1} de {pageCount} · {props.length} props
          </span>
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} style={pageBtnStyle(page === 0)}>
              ← Anterior
            </button>
            <button
              onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
              disabled={page >= pageCount - 1}
              style={pageBtnStyle(page >= pageCount - 1)}
            >
              Próxima →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
