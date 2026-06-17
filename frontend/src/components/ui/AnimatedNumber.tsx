// Número animado (count-up suave) — transiciona quando o valor muda (ex.: EV%,
// odds, médias após refetch do TanStack Query). useSpring segue o alvo com física;
// useTransform formata sem re-render do React. Respeita prefers-reduced-motion.

import { useEffect } from "react";
import { m, useReducedMotion, useSpring, useTransform } from "motion/react";

export function AnimatedNumber({
  value,
  format = (n: number) => n.toFixed(1),
}: {
  value: number;
  format?: (n: number) => string;
}) {
  const reduce = useReducedMotion();
  const spring = useSpring(value, { stiffness: 120, damping: 24, mass: 0.6 });
  const text = useTransform(spring, (v) => format(v));

  useEffect(() => {
    spring.set(value);
  }, [value, spring]);

  if (reduce) return <span>{format(value)}</span>;
  return <m.span>{text}</m.span>;
}
