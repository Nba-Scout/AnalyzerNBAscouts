// Pill — chip de filtro (mercado/jogo/time) com estado ativo tokenizado.
// Com `layoutGroup`, o preenchimento âmbar do pill ativo DESLIZA entre os pills
// do mesmo grupo (layoutId compartilhado) — feedback de "seleção ativa".

import { type ReactNode } from "react";
import { m } from "motion/react";

import { cn } from "../../lib/cn";

export function Pill({
  active = false,
  onClick,
  className,
  children,
  layoutGroup,
}: {
  active?: boolean;
  onClick?: () => void;
  className?: string;
  children: ReactNode;
  /** id do grupo single-select (ex.: "market", "game", "team") → highlight desliza entre os pills. */
  layoutGroup?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "relative rounded-full border px-3 py-1 font-mono text-[11.5px] whitespace-nowrap cursor-pointer transition-colors duration-150",
        active
          ? "border-accent/60 text-accent font-bold"
          : "border-border bg-canvas text-fg-muted hover:border-border-strong hover:text-fg",
        // sem layoutGroup (toggle) o fundo é estático; com layoutGroup, o m.span cuida
        active && !layoutGroup && "bg-accent/15",
        className,
      )}
    >
      {active && layoutGroup && (
        <m.span
          layoutId={`pill-${layoutGroup}`}
          className="absolute inset-0 rounded-full bg-accent/15"
          transition={{ type: "spring", stiffness: 480, damping: 38 }}
        />
      )}
      <span className="relative z-[1] inline-flex items-center">{children}</span>
    </button>
  );
}
