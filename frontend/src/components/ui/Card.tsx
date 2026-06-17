// Card / Panel — superfície tokenizada com borda e raio.

import { type HTMLAttributes } from "react";

import { cn } from "../../lib/cn";

export function Card({ interactive = false, className, ...props }: HTMLAttributes<HTMLDivElement> & { interactive?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-surface",
        interactive && "transition-colors duration-150 hover:border-border-strong",
        className,
      )}
      {...props}
    />
  );
}

export function Panel({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-lg border border-border bg-surface p-4", className)} {...props} />;
}
