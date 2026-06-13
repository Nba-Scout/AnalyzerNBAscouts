// Botão de favoritar (★) — migrado de static/favorites.jsx.
// O estado vem do hook useFavorites (useSyncExternalStore), não mais do bus CustomEvent.

import { type CSSProperties, useState } from "react";

import { useFavorites } from "../hooks/useFavorites";
import type { Prop } from "../types/api";

type FavProp = Pick<Prop, "player_name" | "market" | "line" | "direction">;

export function StarButton({ prop, style = {} }: { prop: FavProp; style?: CSSProperties }) {
  const { has, toggle } = useFavorites();
  const fav = has(prop);
  const [hover, setHover] = useState(false);

  const color = fav ? "#fde047" : hover ? "#8888a0" : "#3a3a4a";

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        toggle(prop);
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      title={fav ? "Remover dos favoritos" : "Adicionar aos favoritos"}
      style={{
        background: "none",
        border: "none",
        cursor: "pointer",
        padding: "2px 4px",
        lineHeight: 1,
        fontSize: 14,
        color,
        transition: "color .15s, transform .1s",
        transform: fav ? "scale(1.15)" : "scale(1)",
        ...style,
      }}
    >
      ★
    </button>
  );
}
