// Provider de animação — Framer Motion (pacote `motion`).
// LazyMotion+domAnimation+strict corta o bundle (~4.6 KB) e força o uso de `m.*`
// (não `motion.*`) em todo o app. MotionConfig reducedMotion="user" respeita
// automaticamente prefers-reduced-motion (WCAG 2.3.3).

import { type ReactNode } from "react";
import { domAnimation, LazyMotion, MotionConfig } from "motion/react";

export function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </LazyMotion>
  );
}
