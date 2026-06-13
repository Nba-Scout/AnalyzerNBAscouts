// Ícone de alerta de lesão (⚠) com tooltip — migrado de static/dashboard.jsx.

import { Tooltip } from "../../components/atoms";
import type { TeamInjury } from "../../types/api";

export function InjuryAlert({ injuries }: { injuries: TeamInjury[] }) {
  if (!injuries || !injuries.length) return null;
  const relevant = injuries.filter((i) => ["out", "questionable"].includes((i.status || "").toLowerCase()));
  if (!relevant.length) return null;
  const tipText = relevant.map((i) => `${i.name}: ${i.status}`).join(" · ");
  return (
    <Tooltip text={tipText}>
      <span style={{ marginLeft: 6, fontSize: 12, cursor: "default" }} title={tipText}>
        ⚠
      </span>
    </Tooltip>
  );
}
