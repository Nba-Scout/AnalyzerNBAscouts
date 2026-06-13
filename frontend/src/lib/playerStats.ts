// Extração de stat por mercado — migrado de static/player.jsx::getStatValue.

import type { RecentGame } from "../types/api";

export function getStatValue(g: RecentGame, market: string): number | null {
  switch (market) {
    case "PTS":
      return g.pts;
    case "REB":
      return g.reb;
    case "AST":
      return g.ast;
    case "FG3M":
      return g.fg3m;
    case "BLK":
      return g.blk;
    case "STL":
      return g.stl;
    case "PRA":
      return g.pts + g.reb + g.ast;
    case "PR":
      return g.pts + g.reb;
    case "PA":
      return g.pts + g.ast;
    case "RA":
      return g.reb + g.ast;
    case "STOCKS":
      return g.blk + g.stl;
    default:
      return null;
  }
}
