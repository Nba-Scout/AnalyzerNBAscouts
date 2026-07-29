// Provider de animação — Framer Motion (pacote `motion`).
// LazyMotion+domMax+strict força o uso de `m.*` (não `motion.*`) em todo o app.
// Usamos domMax (não domAnimation) porque o painel usa animações de LAYOUT —
// FLIP nas linhas da tabela (m.tr layout) e sublinhado deslizante das abas
// (layoutId) — que o feature-set domAnimation não inclui. Delta de bundle ~5 KB
// gz, aceitável para a view principal. MotionConfig reducedMotion="user" respeita
// automaticamente prefers-reduced-motion (WCAG 2.3.3).

import { type ReactNode } from "react";
import { domMax, LazyMotion, MotionConfig } from "motion/react";

export function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={domMax} strict>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </LazyMotion>
  );
}
