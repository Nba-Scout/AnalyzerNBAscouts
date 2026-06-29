// Stat — label mono pequeno + valor grande tabular-nums (KPI de terminal).

import { type ReactNode } from "react";

import { cn } from "../../lib/cn";

export function Stat({
  label,
  value,
  sub,
  accentClass = "text-fg",
  className,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  /** Classe Tailwind de cor do valor (ex.: "text-ev-strong"). */
  accentClass?: string;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-fg-subtle">{label}</div>
      <div className={cn("font-mono text-2xl font-bold leading-none tabular-nums tracking-tight", accentClass)}>{value}</div>
      {sub && <div className="mt-1.5 font-sans text-[11.5px] text-fg-subtle">{sub}</div>}
    </div>
  );
}
