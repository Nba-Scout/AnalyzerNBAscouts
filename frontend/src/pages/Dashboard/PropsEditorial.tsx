// Variação Editorial — Strong Bets em destaque + tabela com o restante. Tokenizado (Etapa 3).

import { m } from "motion/react";

import { SectionLabel } from "../../components/SectionLabel";
import { FeaturedCard } from "./FeaturedCard";
import { PropsTableTerminal } from "./PropsTableTerminal";
import { listItem, listStagger, type SortHandlers, type ViewProps } from "./shared";

export function PropsEditorial({
  props,
  onPlayer,
  oddMode,
  kellyMode,
  bankroll = 0,
  sortBy,
  sortDir,
  onSort,
}: ViewProps & Partial<SortHandlers>) {
  const featured = props.filter((p) => p.rating === "STRONG").slice(0, 3);
  const rest = props.filter((p) => !featured.includes(p));

  return (
    <div className="flex flex-col gap-5">
      {featured.length > 0 && (
        <div>
          <SectionLabel>Strong Bets em destaque</SectionLabel>
          <m.div
            variants={listStagger}
            initial="hidden"
            animate="show"
            className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3"
          >
            {featured.map((p, i) => (
              <m.div key={i} variants={listItem}>
                <FeaturedCard prop={p} onPlayer={onPlayer} oddMode={oddMode} kellyMode={kellyMode} />
              </m.div>
            ))}
          </m.div>
        </div>
      )}
      <div>
        <SectionLabel>Demais oportunidades</SectionLabel>
        <PropsTableTerminal
          props={rest}
          onPlayer={onPlayer}
          oddMode={oddMode}
          kellyMode={kellyMode}
          bankroll={bankroll}
          sortBy={sortBy}
          sortDir={sortDir}
          onSort={onSort}
        />
      </div>
    </div>
  );
}
