// Barra de hit rate (acertos/total) de uma prop no histórico — migrado de static/player.jsx.

import { hitColor } from "../../lib/colors";

export function HitRateBar({ hit, total, line, direction }: { hit: number; total: number; line: number; direction: string }) {
  if (!total) return null;
  const pct = hit / total;
  const color = hitColor(pct);
  return (
    <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid #2a2a38" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: 5,
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 10,
        }}
      >
        <span style={{ color: "#5a5a72" }}>
          {direction === "OVER" ? "OVER" : "UNDER"} {line} · últimos {total} jogos
        </span>
        <span style={{ color, fontWeight: 600 }}>
          {hit}/{total} · {(pct * 100).toFixed(0)}%
        </span>
      </div>
      <div style={{ height: 3, background: "#2a2a38", borderRadius: 2, overflow: "hidden" }}>
        <div style={{ width: `${pct * 100}%`, height: "100%", background: color, borderRadius: 2, transition: "width .4s" }} />
      </div>
    </div>
  );
}
