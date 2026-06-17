// Badge — pílula de status tokenizada. RatingBadge mapeia o rating para um tom.

import { type ReactNode } from "react";

import { cn } from "../../lib/cn";

export type BadgeTone = "neutral" | "accent" | "pos" | "value" | "neg" | "warn";

const TONES: Record<BadgeTone, string> = {
  neutral: "text-fg-muted bg-raised border-border",
  accent: "text-accent bg-accent/10 border-accent/35",
  pos: "text-ev-strong bg-ev-strong/12 border-ev-strong/35",
  value: "text-info bg-info/12 border-info/35",
  neg: "text-ev-neg bg-ev-neg/12 border-ev-neg/35",
  warn: "text-hit-mid bg-hit-mid/12 border-hit-mid/35",
};

export function Badge({ tone = "neutral", className, children }: { tone?: BadgeTone; className?: string; children: ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-sm border px-2 py-0.5",
        "font-mono text-[10.5px] font-semibold uppercase tracking-wide leading-none tabular-nums",
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

const RATING_TONE: Record<string, BadgeTone> = {
  STRONG: "pos",
  VALUE: "value",
  NEUTRAL: "neutral",
  AVOID: "neg",
};

const RATING_DOT: Record<string, string> = {
  STRONG: "bg-ev-strong",
  VALUE: "bg-info",
  NEUTRAL: "bg-fg-subtle",
  AVOID: "bg-ev-neg",
};

export function RatingBadge({ rating, size = "sm" }: { rating: string; size?: "sm" | "md" }) {
  const tone = RATING_TONE[rating] ?? "neutral";
  const dot = RATING_DOT[rating] ?? "bg-fg-subtle";
  return (
    <Badge tone={tone} className={size === "md" ? "text-xs px-2.5 py-1" : undefined}>
      <span className={cn("inline-block h-1.5 w-1.5 rounded-[1px]", dot)} />
      {rating}
    </Badge>
  );
}
