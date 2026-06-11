// Favoritos persistidos em localStorage. Migra o bus CustomEvent do legado para
// useSyncExternalStore — qualquer componente que use o hook re-renderiza ao mudar.

import { useCallback, useMemo, useSyncExternalStore } from "react";

import { propKey } from "../lib/props";
import type { Prop } from "../types/api";

const KEY = "nba-scout-favorites";
const EVENT = "nba-favorites-changed";

type FavProp = Pick<Prop, "player_name" | "market" | "line" | "direction">;

function readRaw(): string {
  return localStorage.getItem(KEY) ?? "[]";
}

function writeSet(set: Set<string>): void {
  localStorage.setItem(KEY, JSON.stringify([...set]));
  window.dispatchEvent(new CustomEvent(EVENT));
}

function subscribe(cb: () => void): () => void {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

export interface FavoritesApi {
  favorites: Set<string>;
  has: (prop: FavProp) => boolean;
  toggle: (prop: FavProp) => void;
  count: number;
}

export function useFavorites(): FavoritesApi {
  // O snapshot é a string crua do localStorage (comparada por valor → estável).
  const raw = useSyncExternalStore(subscribe, readRaw, () => "[]");

  const favorites = useMemo<Set<string>>(() => {
    try {
      return new Set<string>(JSON.parse(raw));
    } catch {
      return new Set<string>();
    }
  }, [raw]);

  const has = useCallback((prop: FavProp) => favorites.has(propKey(prop)), [favorites]);

  const toggle = useCallback((prop: FavProp) => {
    const set = new Set<string>(JSON.parse(readRaw() || "[]"));
    const k = propKey(prop);
    if (set.has(k)) set.delete(k);
    else set.add(k);
    writeSet(set);
  }, []);

  return { favorites, has, toggle, count: favorites.size };
}
