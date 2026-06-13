// URLs das casas de aposta — migrado de static/dashboard.jsx (BOOKMAKER_URLS).

export const BOOKMAKER_URLS: Record<string, string> = {
  draftkings: "https://sportsbook.draftkings.com",
  fanduel: "https://sportsbook.fanduel.com",
  betmgm: "https://sports.betmgm.com",
  pointsbetus: "https://pointsbet.com",
  caesars: "https://sportsbook.caesars.com",
  barstool: "https://www.barstoolsportsbook.com",
  betrivers: "https://www.betrivers.com",
  unibet_us: "https://www.unibet.com/sports",
  williamhill_us: "https://www.williamhill.com/us",
  bet365: "https://www.bet365.com",
  bovada: "https://www.bovada.lv/sports/basketball/nba",
  mybookie_ag: "https://mybookie.ag/sportsbook",
  pinnacle: "https://www.pinnacle.com/sports/basketball",
};

/** Resolve a URL de uma casa, normalizando o nome (remove espaços/underscores). */
export function bookmakerUrl(name: string | undefined | null): string | null {
  const key = (name || "").toLowerCase().replace(/[\s_]/g, "");
  return BOOKMAKER_URLS[key] || null;
}
