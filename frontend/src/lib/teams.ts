// Mercados disponíveis para os pills de filtro — migrado de static/data.jsx (MARKETS).
// (O mapa TEAMS do legado foi removido: os pills de time são derivados das próprias
// props via playerTeam(), não de uma lista estática.)

export interface MarketDef {
  key: string;
  label: string;
}

export const MARKETS: MarketDef[] = [
  { key: "ALL", label: "Todos" },
  { key: "PTS", label: "PTS" },
  { key: "REB", label: "REB" },
  { key: "AST", label: "AST" },
  { key: "FG3M", label: "3PM" },
  { key: "BLK", label: "BLK" },
  { key: "STL", label: "STL" },
  { key: "PRA", label: "PRA" },
  { key: "PR", label: "P+R" },
  { key: "PA", label: "P+A" },
  { key: "RA", label: "R+A" },
  { key: "STOCKS", label: "STOCKS" },
];
