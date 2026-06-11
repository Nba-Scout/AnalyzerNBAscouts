// Times e mercados — migrado de static/data.jsx (TEAMS / MARKETS).

export interface TeamInfo {
  name: string;
  abbr: string;
}

export const TEAMS: Record<string, TeamInfo> = {
  BOS: { name: "Boston Celtics", abbr: "BOS" },
  CLE: { name: "Cleveland Cavaliers", abbr: "CLE" },
  DEN: { name: "Denver Nuggets", abbr: "DEN" },
  MIN: { name: "Minnesota Timberwolves", abbr: "MIN" },
  OKC: { name: "Oklahoma City Thunder", abbr: "OKC" },
  DAL: { name: "Dallas Mavericks", abbr: "DAL" },
  NYK: { name: "New York Knicks", abbr: "NYK" },
  IND: { name: "Indiana Pacers", abbr: "IND" },
  PHI: { name: "Philadelphia 76ers", abbr: "PHI" },
  MIL: { name: "Milwaukee Bucks", abbr: "MIL" },
  LAL: { name: "Los Angeles Lakers", abbr: "LAL" },
  PHX: { name: "Phoenix Suns", abbr: "PHX" },
  GSW: { name: "Golden State Warriors", abbr: "GSW" },
  MIA: { name: "Miami Heat", abbr: "MIA" },
  ORL: { name: "Orlando Magic", abbr: "ORL" },
};

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
