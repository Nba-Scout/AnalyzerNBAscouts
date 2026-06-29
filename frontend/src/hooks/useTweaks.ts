// Tweaks (variação de UI, formato de odds/kelly, bankroll) — estado local +
// localStorage. O postMessage do legado (host de design) é mantido mas só dispara
// dentro de um iframe (no-op em produção).

import { useCallback, useState } from "react";

import type { KellyMode, OddMode } from "../lib/format";

export interface Tweaks {
  variation: "terminal" | "cards" | "editorial";
  oddMode: OddMode;
  kellyMode: KellyMode;
  bankroll: number;
}

export const TWEAK_DEFAULTS: Tweaks = {
  variation: "terminal",
  oddMode: "decimal",
  kellyMode: "quarter",
  bankroll: 1000,
};

const KEY = "nba-scout-tweaks";

function load(defaults: Tweaks): Tweaks {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...defaults, ...JSON.parse(raw) } : defaults;
  } catch {
    return defaults;
  }
}

export interface TweaksApi {
  tweaks: Tweaks;
  setTweak: <K extends keyof Tweaks>(key: K | Partial<Tweaks>, val?: Tweaks[K]) => void;
}

export function useTweaks(defaults: Tweaks = TWEAK_DEFAULTS): TweaksApi {
  const [tweaks, setTweaks] = useState<Tweaks>(() => load(defaults));

  const setTweak = useCallback(<K extends keyof Tweaks>(key: K | Partial<Tweaks>, val?: Tweaks[K]) => {
    setTweaks((prev) => {
      const next: Tweaks = typeof key === "object" ? { ...prev, ...key } : { ...prev, [key]: val };
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        /* ignore quota errors */
      }
      // Host de design (postMessage) — só dentro de iframe; no-op em produção.
      if (typeof window !== "undefined" && window.parent !== window) {
        try {
          window.parent.postMessage({ type: "__edit_mode_set_keys", keys: next }, "*");
        } catch {
          /* cross-origin: ignore */
        }
      }
      return next;
    });
  }, []);

  return { tweaks, setTweak };
}
