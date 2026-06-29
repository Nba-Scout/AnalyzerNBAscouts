// Lista empilhada para telas estreitas — stagger (motion). Tokenizado (Etapa 3).

import { m } from "motion/react";

import { EmptyState } from "../../components/ui";
import { PropCard } from "./PropCard";
import { listItem, listStagger, type ViewProps } from "./shared";

export function MobilePropList({ props, onPlayer, oddMode, kellyMode, bankroll = 0 }: ViewProps) {
  if (props.length === 0) {
    return <EmptyState title="Nenhuma prop bate seus filtros." />;
  }
  return (
    <m.div variants={listStagger} initial="hidden" animate="show" className="flex flex-col gap-2.5">
      {props.map((p, i) => (
        <m.div key={i} variants={listItem}>
          <PropCard prop={p} onPlayer={onPlayer} oddMode={oddMode} kellyMode={kellyMode} bankroll={bankroll} />
        </m.div>
      ))}
    </m.div>
  );
}
