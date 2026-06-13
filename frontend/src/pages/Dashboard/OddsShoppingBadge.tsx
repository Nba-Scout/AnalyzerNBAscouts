// Badge de line shopping (casa principal + extras) — migrado de static/dashboard.jsx.

import { type CSSProperties, useState } from "react";

import { Tooltip } from "../../components/atoms";
import type { AllOdd } from "../../types/api";
import { bookmakerUrl } from "./bookmakers";

function BookmakerButton({ name, style = {} }: { name: string; style?: CSSProperties }) {
  const url = bookmakerUrl(name);
  const [hov, setHov] = useState(false);
  return (
    <span
      onClick={
        url
          ? (e) => {
              e.stopPropagation();
              window.open(url, "_blank", "noopener,noreferrer");
            }
          : undefined
      }
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "2px 7px",
        borderRadius: 4,
        background: hov && url ? "rgba(99,102,241,0.12)" : "rgba(90,90,114,0.1)",
        border: `1px solid ${hov && url ? "rgba(99,102,241,0.45)" : "rgba(90,90,114,0.22)"}`,
        color: hov && url ? "#c7d2fe" : "#9090b0",
        cursor: url ? "pointer" : "default",
        transition: "all .12s",
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 11,
        ...style,
      }}
    >
      {url && (
        <svg
          width="8"
          height="8"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
          <polyline points="15 3 21 3 21 9" />
          <line x1="10" y1="14" x2="21" y2="3" />
        </svg>
      )}
      {name}
    </span>
  );
}

export function OddsShoppingBadge({ bookmaker, allOdds }: { bookmaker: string; allOdds: AllOdd[] }) {
  const extras = (allOdds || []).filter((o) => o.bookmaker !== bookmaker);
  if (!extras.length) return <BookmakerButton name={bookmaker} />;
  const tipText = [`Melhor: ${bookmaker}`, ...extras.map((o) => `${o.bookmaker}: ${o.odd.toFixed(2)}`)].join(" · ");
  return (
    <Tooltip text={tipText}>
      <BookmakerButton name={bookmaker} />
      <span
        style={{
          marginLeft: 5,
          padding: "1px 5px",
          borderRadius: 3,
          fontSize: 9.5,
          fontWeight: 600,
          color: "#a5b4fc",
          background: "rgba(99,102,241,0.12)",
          border: "1px solid rgba(99,102,241,0.25)",
        }}
      >
        +{extras.length}
      </span>
    </Tooltip>
  );
}
