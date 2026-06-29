// Skeleton — placeholder com shimmer (classe .skeleton do global.css). Tamanho via className.

import { cn } from "../../lib/cn";

export function Skeleton({ className }: { className?: string }) {
  return <span className={cn("skeleton block rounded-sm", className)} />;
}
