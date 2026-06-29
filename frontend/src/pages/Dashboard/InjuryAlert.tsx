// Ícone de alerta de lesão (⚠) com tooltip — tokenizado (Etapa 3).

import { Tooltip } from "../../components/ui";
import type { TeamInjury } from "../../types/api";

export function InjuryAlert({ injuries }: { injuries: TeamInjury[] }) {
  if (!injuries || !injuries.length) return null;
  const relevant = injuries.filter((i) => ["out", "questionable"].includes((i.status || "").toLowerCase()));
  if (!relevant.length) return null;
  const tipText = relevant.map((i) => `${i.name}: ${i.status}`).join(" · ");
  return (
    <Tooltip text={tipText}>
      <span className="ml-1.5 cursor-default text-xs text-hit-mid" title={tipText}>
        ⚠
      </span>
    </Tooltip>
  );
}
