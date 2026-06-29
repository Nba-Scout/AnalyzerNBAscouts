// Rótulo de seção com régua — tokenizado (Etapa 3).

import { type ReactNode } from "react";

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="mb-2.5 flex items-center gap-3 font-mono text-[10.5px] uppercase tracking-widest text-fg-subtle">
      <span>{children}</span>
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}
