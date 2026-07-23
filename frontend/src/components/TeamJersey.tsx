// Camisa genérica do time (estilo bet365) — silhueta única tingida com as cores
// de marca (corpo = primária, contorno = secundária). NÃO usa logos/escudos
// (marcas registradas); só as cores, que são fato público. Fallback neutro.

// Cores primária/secundária por sigla (padrão NBA de 3 letras).
const TEAM_COLORS: Record<string, { primary: string; secondary: string }> = {
  ATL: { primary: "#E03A3E", secondary: "#C1D32F" },
  BOS: { primary: "#007A33", secondary: "#BA9653" },
  BKN: { primary: "#111111", secondary: "#FFFFFF" },
  CHA: { primary: "#1D1160", secondary: "#00788C" },
  CHI: { primary: "#CE1141", secondary: "#111111" },
  CLE: { primary: "#860038", secondary: "#FDBB30" },
  DAL: { primary: "#00538C", secondary: "#002B5E" },
  DEN: { primary: "#0E2240", secondary: "#FEC524" },
  DET: { primary: "#C8102E", secondary: "#1D42BA" },
  GSW: { primary: "#1D428A", secondary: "#FFC72C" },
  HOU: { primary: "#CE1141", secondary: "#C4CED4" },
  IND: { primary: "#002D62", secondary: "#FDBB30" },
  LAC: { primary: "#C8102E", secondary: "#1D428A" },
  LAL: { primary: "#552583", secondary: "#FDB927" },
  MEM: { primary: "#5D76A9", secondary: "#12173F" },
  MIA: { primary: "#98002E", secondary: "#F9A01B" },
  MIL: { primary: "#00471B", secondary: "#EEE1C6" },
  MIN: { primary: "#0C2340", secondary: "#236192" },
  NOP: { primary: "#0C2340", secondary: "#C8102E" },
  NYK: { primary: "#006BB6", secondary: "#F58426" },
  OKC: { primary: "#007AC1", secondary: "#EF3B24" },
  ORL: { primary: "#0077C0", secondary: "#C4CED4" },
  PHI: { primary: "#006BB6", secondary: "#ED174C" },
  PHX: { primary: "#1D1160", secondary: "#E56020" },
  POR: { primary: "#E03A3E", secondary: "#111111" },
  SAC: { primary: "#5A2D81", secondary: "#63727A" },
  SAS: { primary: "#8A8D8F", secondary: "#111111" },
  TOR: { primary: "#CE1141", secondary: "#111111" },
  UTA: { primary: "#002B5C", secondary: "#F9A01B" },
  WAS: { primary: "#002B5C", secondary: "#E31837" },
};

const FALLBACK = { primary: "#3a3a4a", secondary: "#8888a0" };

// Silhueta de REGATA de basquete (tank top, sem mangas) — path genérico, sem
// qualquer marca/escudo. Anatomia: alças finas no topo (x 7→9.1 / 14.9→17),
// cavas profundas CÔNCAVAS nas laterais (escavam pra dentro até a axila),
// gola em U funda no meio e corpo comprido afunilado. Gola em banda com a cor
// secundária (debrum contrastante, estilo bet365).
const BODY =
  "M7 3 Q8 7 5.8 10.6 L6.3 19.4 Q6.35 20.2 7.1 20.2 L16.9 20.2 Q17.65 20.2 17.7 19.4 L18.2 10.6 Q16 7 17 3 L14.9 3 C14.9 8.8 9.1 8.8 9.1 3 Z";
const COLLAR = "M9.1 3 C9.1 8.8 14.9 8.8 14.9 3 L13.5 3 C13.5 7.2 10.5 7.2 10.5 3 Z";

export function TeamJersey({ team, size = 16, className }: { team: string; size?: number; className?: string }) {
  const c = TEAM_COLORS[(team || "").toUpperCase()] ?? FALLBACK;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
      style={{ flexShrink: 0 }}
      role="img"
      aria-label={`Camisa ${team}`}
    >
      <path d={BODY} fill={c.primary} stroke={c.secondary} strokeWidth={1.4} strokeLinejoin="round" />
      <path d={COLLAR} fill={c.secondary} />
    </svg>
  );
}
