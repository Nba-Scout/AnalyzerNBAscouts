// Badge de line shopping (casa principal + extras) — tokenizado (Etapa 3).

import { useState } from "react";

import { Tooltip } from "../../components/ui";
import { cn } from "../../lib/cn";
import type { AllOdd } from "../../types/api";
import { bookmakerUrl } from "./bookmakers";

function BookmakerButton({ name, className }: { name: string; className?: string }) {
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
      className={cn(
        "inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 font-mono text-[11px] transition-colors",
        url ? "cursor-pointer" : "cursor-default",
        hov && url ? "border-accent/45 bg-accent/12 text-accent" : "border-border bg-raised text-fg-muted",
        className,
      )}
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
      <span className="ml-1.5 rounded-sm border border-accent/25 bg-accent/12 px-1.5 py-px font-mono text-[9.5px] font-semibold text-accent">
        +{extras.length}
      </span>
    </Tooltip>
  );
}
