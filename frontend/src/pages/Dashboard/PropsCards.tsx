// Variação Cards — grade com stagger (motion) + paginação. Tokenizado (Etapa 3).

import { useState } from "react";
import { m } from "motion/react";

import { Button, EmptyState } from "../../components/ui";
import type { Prop } from "../../types/api";
import { PropCard } from "./PropCard";
import { listItem, listStagger, type ViewProps } from "./shared";

const PAGE = 12;

export function PropsCards({ props, onPlayer, oddMode, kellyMode, bankroll = 0 }: ViewProps) {
  const [page, setPage] = useState(0);

  const [tracked, setTracked] = useState<Prop[]>(props);
  if (tracked !== props) {
    setTracked(props);
    setPage(0);
  }

  const pageData = props.slice(page * PAGE, (page + 1) * PAGE);
  const pageCount = Math.max(1, Math.ceil(props.length / PAGE));

  if (props.length === 0) {
    return <EmptyState title="Nenhuma prop bate seus filtros." hint="Tente reduzir o EV mínimo ou limpar os filtros." />;
  }

  return (
    <div>
      <m.div
        key={page}
        variants={listStagger}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
      >
        {pageData.map((p, i) => (
          <m.div key={i} variants={listItem}>
            <PropCard prop={p} onPlayer={onPlayer} oddMode={oddMode} kellyMode={kellyMode} bankroll={bankroll} />
          </m.div>
        ))}
      </m.div>
      {pageCount > 1 && (
        <div className="mt-4 flex items-center justify-between font-mono text-[11px] text-fg-muted">
          <span>
            Página {page + 1} de {pageCount} · {props.length} props
          </span>
          <div className="flex gap-1.5">
            <Button size="sm" variant="subtle" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}>
              ← Anterior
            </Button>
            <Button
              size="sm"
              variant="subtle"
              onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
              disabled={page >= pageCount - 1}
            >
              Próxima →
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
