// Barra de filtros (busca, EV mín, ordenação, mercado, jogo, time) — migrado de static/dashboard.jsx.

import { type Dispatch, type SetStateAction } from "react";

import { MARKETS } from "../../lib/teams";
import type { Filters } from "../../lib/props";

export interface PillOption {
  key: string;
  label: string;
}

export function FilterBar({
  filters,
  setFilters,
  games,
  teams,
  resultCount,
  onReset,
  onExport,
  density = "normal",
}: {
  filters: Filters;
  setFilters: Dispatch<SetStateAction<Filters>>;
  games: PillOption[];
  teams: PillOption[];
  resultCount: number;
  onReset: () => void;
  onExport?: () => void;
  density?: "normal" | "compact";
}) {
  const isFiltered =
    filters.market !== "ALL" ||
    filters.minEv !== 3 ||
    filters.onlyStrong ||
    (filters.game && filters.game !== "ALL") ||
    (filters.team && filters.team !== "ALL") ||
    !!(filters.search || "");

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 10,
        padding: density === "compact" ? "10px 14px" : "14px 18px",
        background: "#141419",
        border: "1px solid #2a2a38",
        borderRadius: 8,
        fontFamily: "'Inter Tight', sans-serif",
        fontSize: 13,
      }}
    >
      {/* Linha 1: busca + controles */}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12 }}>
        {/* Busca por jogador */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            flex: "1 1 200px",
            minWidth: 0,
            padding: "5px 10px",
            borderRadius: 5,
            background: "#0f0f13",
            border: `1px solid ${filters.search || "" ? "rgba(99,102,241,0.5)" : "#2a2a38"}`,
            transition: "border-color .15s",
          }}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#5a5a72"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ flexShrink: 0 }}
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <input
            type="text"
            placeholder="Buscar jogador…"
            value={filters.search || ""}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            style={{
              background: "transparent",
              border: "none",
              outline: "none",
              color: "#e8e8f0",
              fontSize: 13,
              fontFamily: "'Inter Tight', sans-serif",
              width: "100%",
              minWidth: 0,
            }}
          />
          {(filters.search || "") && (
            <button
              onClick={() => setFilters({ ...filters, search: "" })}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "#5a5a72",
                padding: 0,
                fontSize: 17,
                lineHeight: 1,
                flexShrink: 0,
              }}
            >
              ×
            </button>
          )}
        </div>

        <div style={{ width: 1, height: 20, background: "#2a2a38", flexShrink: 0 }} />

        {/* EV mín */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span
            style={{
              color: "#5a5a72",
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 10.5,
              textTransform: "uppercase",
              letterSpacing: 0.6,
            }}
          >
            EV MÍN.
          </span>
          <input
            type="range"
            min={0}
            max={20}
            step={0.5}
            value={filters.minEv}
            onChange={(e) => setFilters({ ...filters, minEv: +e.target.value })}
            style={{ width: 110, accentColor: "#6366f1" }}
          />
          <input
            type="number"
            min={0}
            max={20}
            step={0.5}
            value={filters.minEv}
            onChange={(e) => {
              const v = Math.max(0, Math.min(20, parseFloat(e.target.value) || 0));
              setFilters({ ...filters, minEv: v });
            }}
            style={{
              width: 52,
              background: "#0f0f13",
              border: "1px solid #2a2a38",
              color: "#e8e8f0",
              borderRadius: 4,
              padding: "4px 6px",
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 12,
              outline: "none",
              textAlign: "right",
            }}
          />
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: "#5a5a72" }}>%</span>
        </div>

        {/* Ordenação global */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              color: "#5a5a72",
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 10.5,
              textTransform: "uppercase",
              letterSpacing: 0.6,
            }}
          >
            ORDEM
          </span>
          <select
            value={`${filters.sortBy}:${filters.sortDir}`}
            onChange={(e) => {
              const [field, dir] = e.target.value.split(":");
              setFilters({ ...filters, sortBy: field, sortDir: dir as "asc" | "desc" });
            }}
            style={{
              background: "#0f0f13",
              color: "#e8e8f0",
              border: "1px solid #2a2a38",
              padding: "5px 10px",
              borderRadius: 5,
              fontFamily: "inherit",
              fontSize: 13,
              outline: "none",
            }}
          >
            <option value="ev_pct:desc">EV% ↓</option>
            <option value="ev_pct:asc">EV% ↑</option>
            <option value="odd:desc">Odd ↓</option>
            <option value="odd:asc">Odd ↑</option>
            <option value="prob_real:desc">Prob Real ↓</option>
            <option value="prob_real:asc">Prob Real ↑</option>
            <option value="kelly_full_pct:desc">Kelly ↓</option>
            <option value="games_over_line_pct:desc">Hit% ↓</option>
          </select>
        </div>

        {/* Só Strong */}
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            cursor: "pointer",
            padding: "5px 10px",
            borderRadius: 5,
            background: filters.onlyStrong ? "rgba(99,102,241,0.15)" : "transparent",
            border: `1px solid ${filters.onlyStrong ? "rgba(99,102,241,0.5)" : "#2a2a38"}`,
            color: filters.onlyStrong ? "#c7d2fe" : "#8888a0",
            fontSize: 12,
            fontWeight: 500,
            transition: "all .15s",
          }}
        >
          <input
            type="checkbox"
            checked={filters.onlyStrong}
            onChange={(e) => setFilters({ ...filters, onlyStrong: e.target.checked })}
            style={{ accentColor: "#6366f1", margin: 0 }}
          />
          Só Strong Bets
        </label>

        <div style={{ flex: 1 }} />

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: resultCount === 0 ? "#fca5a5" : "#5a5a72" }}
          >
            {resultCount} resultados
          </div>
          {onExport && (
            <button
              onClick={onExport}
              style={{
                padding: "4px 10px",
                borderRadius: 4,
                background: "transparent",
                border: "1px solid #3a3a4a",
                color: "#8888a0",
                cursor: "pointer",
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 10.5,
                transition: "all .12s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "#22c55e";
                e.currentTarget.style.color = "#86efac";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "#3a3a4a";
                e.currentTarget.style.color = "#8888a0";
              }}
            >
              ⬇ CSV
            </button>
          )}
          {isFiltered && (
            <button
              onClick={onReset}
              style={{
                padding: "4px 10px",
                borderRadius: 4,
                background: "transparent",
                border: "1px solid #3a3a4a",
                color: "#8888a0",
                cursor: "pointer",
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 10.5,
                transition: "all .12s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "#6366f1";
                e.currentTarget.style.color = "#c7d2fe";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "#3a3a4a";
                e.currentTarget.style.color = "#8888a0";
              }}
            >
              Limpar filtros
            </button>
          )}
        </div>
      </div>

      {/* Linha 2: pills de mercado */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 5,
          paddingTop: 10,
          borderTop: "1px solid #2a2a38",
        }}
      >
        <span
          style={{
            color: "#5a5a72",
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 10,
            textTransform: "uppercase",
            letterSpacing: 0.6,
            marginRight: 2,
          }}
        >
          MERCADO
        </span>
        {MARKETS.map((m) => {
          const active = (filters.market || "ALL") === m.key;
          return (
            <button
              key={m.key}
              onClick={() => setFilters({ ...filters, market: m.key })}
              style={{
                padding: "4px 11px",
                borderRadius: 14,
                background: active ? "rgba(99,102,241,0.22)" : "#0f0f13",
                border: `1px solid ${active ? "rgba(99,102,241,0.6)" : "#2a2a38"}`,
                color: active ? "#c7d2fe" : "#8888a0",
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 11,
                fontWeight: active ? 700 : 400,
                cursor: "pointer",
                whiteSpace: "nowrap",
                transition: "all .12s",
                boxShadow: active ? "0 0 0 1px rgba(99,102,241,0.2) inset" : "none",
              }}
            >
              {m.label}
            </button>
          );
        })}
      </div>

      {/* Linha 3: filtro por jogo e por time */}
      {games && games.length > 0 && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 6,
            paddingTop: 10,
            borderTop: "1px solid #2a2a38",
          }}
        >
          <span
            style={{
              color: "#5a5a72",
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 10,
              textTransform: "uppercase",
              letterSpacing: 0.6,
              marginRight: 2,
            }}
          >
            JOGO
          </span>
          {games.map((g) => {
            const active = (filters.game || "ALL") === g.key && (filters.team || "ALL") === "ALL";
            return (
              <button
                key={g.key}
                onClick={() => setFilters({ ...filters, game: g.key, team: "ALL" })}
                style={{
                  padding: "5px 14px",
                  borderRadius: 20,
                  background: active ? "rgba(99,102,241,0.22)" : "#0f0f13",
                  border: `1px solid ${active ? "rgba(99,102,241,0.6)" : "#2a2a38"}`,
                  color: active ? "#c7d2fe" : "#8888a0",
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 11.5,
                  fontWeight: active ? 700 : 400,
                  cursor: "pointer",
                  transition: "all .12s",
                  whiteSpace: "nowrap",
                  boxShadow: active ? "0 0 0 1px rgba(99,102,241,0.25) inset" : "none",
                }}
              >
                {g.label}
              </button>
            );
          })}

          {teams && teams.length > 0 && (
            <>
              <div style={{ width: 1, height: 18, background: "#3a3a4a", margin: "0 4px", flexShrink: 0 }} />
              <span
                style={{
                  color: "#5a5a72",
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 10,
                  textTransform: "uppercase",
                  letterSpacing: 0.6,
                  marginRight: 2,
                }}
              >
                TIME
              </span>
              {teams.map((t) => {
                const active = (filters.team || "ALL") === t.key;
                return (
                  <button
                    key={t.key}
                    onClick={() => setFilters({ ...filters, team: active ? "ALL" : t.key, game: "ALL" })}
                    style={{
                      padding: "5px 12px",
                      borderRadius: 20,
                      background: active ? "rgba(94,226,160,0.15)" : "#0f0f13",
                      border: `1px solid ${active ? "rgba(94,226,160,0.5)" : "#2a2a38"}`,
                      color: active ? "#5ee2a0" : "#8888a0",
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: 11.5,
                      fontWeight: active ? 700 : 400,
                      cursor: "pointer",
                      transition: "all .12s",
                      whiteSpace: "nowrap",
                      letterSpacing: 0.5,
                    }}
                  >
                    {t.label}
                  </button>
                );
              })}
            </>
          )}
        </div>
      )}
    </div>
  );
}
