// Histórico recente com toggle Casa/Fora + comparativo de splits — de static/player.jsx.

import { type CSSProperties, useState } from "react";

import type { RecentGame } from "../../types/api";

export function HistorySection({
  games,
  propLines,
  avgMin,
  loadingPlayer,
  splits,
  cellColor,
}: {
  games: RecentGame[];
  propLines: Record<string, number>;
  avgMin: number;
  loadingPlayer: boolean;
  splits: Record<string, number>;
  cellColor: (val: number, market: string) => string | null;
}) {
  const [locFilter, setLocFilter] = useState("ALL");
  const filtered = locFilter === "ALL" ? games : games.filter((g) => g.home_away === locFilter);

  const tabStyle = (key: string): CSSProperties => ({
    padding: "3px 12px",
    borderRadius: 20,
    background: locFilter === key ? "rgba(99,102,241,0.2)" : "transparent",
    border: `1px solid ${locFilter === key ? "rgba(99,102,241,0.55)" : "#2a2a38"}`,
    color: locFilter === key ? "#c7d2fe" : "#8888a0",
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 10.5,
    cursor: "pointer",
    transition: "all .12s",
  });

  const s = splits || {};
  const hasLocationData = (s.home_games || 0) + (s.away_games || 0) > 0;

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
        <div
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 10.5,
            color: "#5a5a72",
            textTransform: "uppercase",
            letterSpacing: 1,
          }}
        >
          Histórico recente
        </div>
        <span style={{ flex: 1, height: 1, background: "#2a2a38" }} />
        {Object.keys(propLines).length > 0 && (
          <span style={{ fontSize: 10, color: "#5a5a72", fontWeight: 400 }}>células coloridas = linha do prop</span>
        )}
        <button style={tabStyle("ALL")} onClick={() => setLocFilter("ALL")}>
          Todos
        </button>
        <button style={tabStyle("home")} onClick={() => setLocFilter("home")}>
          Casa
        </button>
        <button style={tabStyle("away")} onClick={() => setLocFilter("away")}>
          Fora
        </button>
      </div>

      {/* Mini comparativo Casa vs Fora */}
      {hasLocationData && (
        <div
          style={{
            display: "flex",
            gap: 16,
            marginBottom: 10,
            padding: "10px 14px",
            background: "#141419",
            border: "1px solid #2a2a38",
            borderRadius: 7,
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 11,
            flexWrap: "wrap",
          }}
        >
          <span style={{ color: "#5a5a72" }}>
            Casa ({s.home_games}j):
            <span style={{ color: "#4ade80", marginLeft: 6 }}>PTS {(s.home_avg_pts || 0).toFixed(1)}</span>
            <span style={{ color: "#93c5fd", marginLeft: 8 }}>REB {(s.home_avg_reb || 0).toFixed(1)}</span>
            <span style={{ color: "#c4b5fd", marginLeft: 8 }}>AST {(s.home_avg_ast || 0).toFixed(1)}</span>
          </span>
          <span style={{ color: "#3a3a4a" }}>|</span>
          <span style={{ color: "#5a5a72" }}>
            Fora ({s.away_games}j):
            <span style={{ color: "#4ade80", marginLeft: 6 }}>PTS {(s.away_avg_pts || 0).toFixed(1)}</span>
            <span style={{ color: "#93c5fd", marginLeft: 8 }}>REB {(s.away_avg_reb || 0).toFixed(1)}</span>
            <span style={{ color: "#c4b5fd", marginLeft: 8 }}>AST {(s.away_avg_ast || 0).toFixed(1)}</span>
          </span>
        </div>
      )}

      <div style={{ background: "#141419", border: "1px solid #2a2a38", borderRadius: 8, overflow: "hidden" }}>
        <div style={{ overflowX: "auto", overflowY: "auto", maxHeight: 480 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "'JetBrains Mono', monospace", fontSize: 12.5 }}>
            <thead style={{ background: "#0f0f13", position: "sticky", top: 0, zIndex: 2 }}>
              <tr>
                {["DATA", "PO", "ADV", "MAR", "MIN", "PTS", "REB", "AST", "3PM", "BLK", "STL"].map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: "10px 12px",
                      textAlign: h === "DATA" || h === "ADV" ? "left" : "right",
                      fontSize: 10,
                      color: "#5a5a72",
                      fontWeight: 500,
                      textTransform: "uppercase",
                      letterSpacing: 0.7,
                      borderBottom: "1px solid #2a2a38",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td
                    colSpan={11}
                    style={{ padding: 32, textAlign: "center", color: "#3a3a4a", fontFamily: "'Inter Tight', sans-serif" }}
                  >
                    {loadingPlayer ? "Carregando…" : locFilter === "ALL" ? "Sem jogos disponíveis" : "Sem jogos neste contexto"}
                  </td>
                </tr>
              )}
              {filtered.map((g, i) => {
                const ptsC = cellColor(g.pts, "PTS");
                const rebC = cellColor(g.reb, "REB");
                const astC = cellColor(g.ast, "AST");
                const fg3mC = cellColor(g.fg3m, "FG3M");
                const blkC = cellColor(g.blk, "BLK");
                const stlC = cellColor(g.stl, "STL");
                return (
                  <tr key={i} style={{ background: i % 2 ? "#141419" : "#161620", borderBottom: "1px solid rgba(42,42,56,0.4)" }}>
                    <td style={{ padding: "10px 12px", color: "#cbd5e1" }}>{g.date}</td>
                    <td style={{ padding: "10px 12px" }}>
                      {g.is_playoff ? (
                        <span
                          style={{
                            padding: "2px 7px",
                            borderRadius: 3,
                            background: "rgba(168,85,247,0.15)",
                            border: "1px solid rgba(168,85,247,0.35)",
                            color: "#d8b4fe",
                            fontSize: 9.5,
                            fontWeight: 700,
                            letterSpacing: 0.5,
                          }}
                        >
                          PO
                        </span>
                      ) : (
                        <span style={{ color: "#3a3a4a" }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: "10px 12px", color: "#8888a0" }}>{g.opp}</td>
                    <td style={{ padding: "10px 12px", textAlign: "right" }}>
                      {!g.margin && g.margin !== 0 ? (
                        <span style={{ color: "#3a3a4a" }}>—</span>
                      ) : (
                        (() => {
                          const isBlowout = Math.abs(g.margin) > 15;
                          const lowMin = avgMin > 0 && g.min < avgMin * 0.8;
                          const color = g.margin > 0 ? "#4ade80" : g.margin < 0 ? "#fca5a5" : "#8888a0";
                          return (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11.5, color }}>
                                {g.margin > 0 ? "+" : ""}
                                {g.margin}
                              </span>
                              {isBlowout && lowMin && (
                                <span
                                  style={{
                                    padding: "1px 5px",
                                    borderRadius: 3,
                                    background: "rgba(234,179,8,0.15)",
                                    border: "1px solid rgba(234,179,8,0.35)",
                                    color: "#fde047",
                                    fontSize: 9,
                                    fontWeight: 700,
                                    letterSpacing: 0.4,
                                  }}
                                >
                                  BLW
                                </span>
                              )}
                            </span>
                          );
                        })()
                      )}
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "right", color: "#8888a0" }}>{g.min}</td>
                    <td
                      style={{ padding: "10px 12px", textAlign: "right", color: ptsC || "#e8e8f0", fontWeight: ptsC ? 700 : 600 }}
                    >
                      {g.pts}
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "right", color: rebC || undefined }}>{g.reb}</td>
                    <td style={{ padding: "10px 12px", textAlign: "right", color: astC || undefined }}>{g.ast}</td>
                    <td style={{ padding: "10px 12px", textAlign: "right", color: fg3mC || "#8888a0" }}>{g.fg3m}</td>
                    <td style={{ padding: "10px 12px", textAlign: "right", color: blkC || "#8888a0" }}>{g.blk}</td>
                    <td style={{ padding: "10px 12px", textAlign: "right", color: stlC || "#8888a0" }}>{g.stl}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
