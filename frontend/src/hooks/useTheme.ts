// Tema dark/light — persistido em localStorage, aplicado como classe `.light` no
// <html>. Dark é o default. useSyncExternalStore mantém todos os consumidores em
// sincronia (mesmo padrão de useFavorites).

import { useCallback, useSyncExternalStore } from "react";

export type Theme = "dark" | "light";

const KEY = "nba-scout-theme";
const listeners = new Set<() => void>();

function getTheme(): Theme {
  return (localStorage.getItem(KEY) as Theme | null) === "light" ? "light" : "dark";
}

function applyTheme(t: Theme): void {
  document.documentElement.classList.toggle("light", t === "light");
}

/** Aplica o tema salvo no boot (chamar em main.tsx antes do render). */
export function initTheme(): void {
  applyTheme(getTheme());
}

function setThemeGlobal(t: Theme): void {
  localStorage.setItem(KEY, t);
  applyTheme(t);
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void): () => void {
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      applyTheme(getTheme());
      cb();
    }
  };
  listeners.add(cb);
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

export interface ThemeApi {
  theme: Theme;
  toggle: () => void;
  setTheme: (t: Theme) => void;
}

export function useTheme(): ThemeApi {
  const theme = useSyncExternalStore(subscribe, getTheme, () => "dark" as Theme);
  const toggle = useCallback(() => setThemeGlobal(getTheme() === "dark" ? "light" : "dark"), []);
  const setTheme = useCallback((t: Theme) => setThemeGlobal(t), []);
  return { theme, toggle, setTheme };
}
