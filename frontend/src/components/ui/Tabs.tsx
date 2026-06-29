// Tabs — barra de abas com underline âmbar que desliza (layoutId / Framer Motion).

import { type ReactNode } from "react";
import { m } from "motion/react";

import { cn } from "../../lib/cn";

export interface TabItem {
  key: string;
  label: ReactNode;
}

export function Tabs({
  items,
  value,
  onChange,
  idBase = "tabs",
  className,
}: {
  items: TabItem[];
  value: string;
  onChange: (key: string) => void;
  /** Único por instância — evita colisão de layoutId entre Tabs diferentes. */
  idBase?: string;
  className?: string;
}) {
  return (
    <div role="tablist" className={cn("flex gap-1", className)}>
      {items.map((t) => {
        const active = t.key === value;
        return (
          <button
            key={t.key}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.key)}
            className={cn(
              "relative inline-flex items-baseline gap-2 px-3.5 py-2.5 font-sans text-sm font-medium cursor-pointer",
              "transition-colors duration-150",
              active ? "text-fg" : "text-fg-subtle hover:text-fg-muted",
            )}
          >
            {t.label}
            {active && (
              <m.span
                layoutId={`${idBase}-underline`}
                className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-accent"
                transition={{ type: "spring", stiffness: 500, damping: 36 }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
