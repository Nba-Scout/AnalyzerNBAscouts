// Tokens de cor por rating — fonte única (migrado de static/atoms.jsx).
// Mantido em .ts (sem componentes) para poder ser importado tanto pelos átomos
// quanto pelas variações do dashboard sem disparar warning de react-refresh.

export interface RatingToken {
  fg: string;
  bg: string;
  border: string;
  dot: string;
}

export const RATING_TOKENS: Record<string, RatingToken> = {
  STRONG: { fg: "#4ade80", bg: "rgba(34,197,94,0.14)", border: "rgba(34,197,94,0.35)", dot: "#22c55e" },
  VALUE: { fg: "#93c5fd", bg: "rgba(59,130,246,0.14)", border: "rgba(59,130,246,0.35)", dot: "#3b82f6" },
  NEUTRAL: { fg: "#cbd5e1", bg: "rgba(120,130,150,0.12)", border: "rgba(120,130,150,0.28)", dot: "#8888a0" },
  AVOID: { fg: "#fca5a5", bg: "rgba(239,68,68,0.14)", border: "rgba(239,68,68,0.35)", dot: "#ef4444" },
};

/** Token de cor de um rating, com fallback para NEUTRAL. */
export function ratingToken(rating: string): RatingToken {
  return RATING_TOKENS[rating] || RATING_TOKENS.NEUTRAL;
}
