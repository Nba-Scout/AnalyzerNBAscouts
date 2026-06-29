// Barra de hit rate (acertos/total) — tokenizado (Etapa 4).

import { hitColor, hitColorClass } from "../../lib/colors";
import { cn } from "../../lib/cn";

export function HitRateBar({ hit, total, line, direction }: { hit: number; total: number; line: number; direction: string }) {
  if (!total) return null;
  const pct = hit / total;
  return (
    <div className="mt-2.5 border-t border-border pt-2.5">
      <div className="mb-1.5 flex justify-between font-mono text-[10px]">
        <span className="text-fg-subtle">
          {direction === "OVER" ? "OVER" : "UNDER"} {line} · últimos {total} jogos
        </span>
        <span className={cn("font-semibold", hitColorClass(pct))}>
          {hit}/{total} · {(pct * 100).toFixed(0)}%
        </span>
      </div>
      <div className="h-[3px] overflow-hidden rounded-full bg-border">
        <div
          className="h-full rounded-full transition-[width] duration-500"
          style={{ width: `${pct * 100}%`, background: hitColor(pct) }}
        />
      </div>
    </div>
  );
}
