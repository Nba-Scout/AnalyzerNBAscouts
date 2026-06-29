// Pill — chip de filtro (mercado/jogo/time) com estado ativo tokenizado.

import { type ReactNode } from "react";

import { cn } from "../../lib/cn";

export function Pill({
  active = false,
  onClick,
  className,
  children,
}: {
  active?: boolean;
  onClick?: () => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-full border px-3 py-1 font-mono text-[11.5px] whitespace-nowrap cursor-pointer transition-colors duration-150",
        active
          ? "border-accent/60 bg-accent/15 text-accent font-bold"
          : "border-border bg-canvas text-fg-muted hover:border-border-strong hover:text-fg",
        className,
      )}
    >
      {children}
    </button>
  );
}
