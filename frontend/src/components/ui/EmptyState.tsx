// EmptyState — vazio/sem-resultado tokenizado, com hint e ação opcional.

import { type ReactNode } from "react";

export function EmptyState({ title, hint, action }: { title: ReactNode; hint?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-surface px-6 py-12 text-center">
      <div className="font-sans text-sm text-fg-muted">{title}</div>
      {hint && <div className="font-sans text-xs text-fg-subtle">{hint}</div>}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
