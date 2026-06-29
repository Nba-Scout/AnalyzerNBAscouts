// Carteira de apostas (bet tracker) — consome o CRUD /api/bets já existente.
// Registra apostas, liquida (win/loss/push) e acompanha P&L / ROI / banca.

import { useBets } from "../../api/queries";
import { SectionLabel } from "../../components/SectionLabel";
import { ThemeToggle } from "../../components/ThemeToggle";
import { Button, EmptyState, Skeleton } from "../../components/ui";
import { isPending } from "../../lib/bets";
import { AddBetForm } from "./AddBetForm";
import { BetsTable } from "./BetsTable";
import { WalletSummary } from "./WalletSummary";

function PageShell({ onBack, children }: { onBack: () => void; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-canvas font-sans text-fg">
      <header className="sticky top-0 z-10 border-b border-border bg-canvas/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1280px] items-center gap-4 px-4 py-3 md:px-7">
          <Button variant="outline" size="sm" onClick={onBack}>
            ← Voltar
          </Button>
          <div className="font-mono text-[10.5px] uppercase tracking-widest text-fg-subtle">NBA SCOUT / CARTEIRA</div>
          <div className="ml-auto" />
          <ThemeToggle />
        </div>
      </header>
      <main className="mx-auto flex max-w-[1280px] flex-col gap-5 px-4 py-6 md:px-7">{children}</main>
    </div>
  );
}

export function Bets({ onBack, bankroll }: { onBack: () => void; bankroll: number }) {
  const { data: bets, isLoading, isError, refetch } = useBets();

  // Pendentes primeiro, depois por data de inclusão (mais recentes no topo) —
  // o backend já devolve added_at desc; só promovemos os pendentes.
  const ordered = (bets ?? []).slice().sort((a, b) => Number(isPending(b)) - Number(isPending(a)));

  return (
    <PageShell onBack={onBack}>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-sans text-xl font-bold tracking-tight">Carteira de apostas</h1>
          <p className="mt-1 font-sans text-[13px] text-fg-subtle">
            Registre suas apostas e acompanhe o desempenho real (P&L, ROI, taxa de acerto).
          </p>
        </div>
      </div>

      {!isLoading && !isError && <WalletSummary bets={bets ?? []} bankroll={bankroll} />}

      <section className="flex flex-col gap-2.5">
        <SectionLabel>Nova aposta</SectionLabel>
        <AddBetForm />
      </section>

      <section className="flex flex-col gap-2.5">
        <SectionLabel>Apostas registradas</SectionLabel>
        {isLoading ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-11 w-full rounded-md" />
            ))}
          </div>
        ) : isError ? (
          <EmptyState
            title="Não foi possível carregar a carteira"
            hint="O backend de /api/bets está indisponível."
            action={
              <Button variant="outline" size="sm" onClick={() => void refetch()}>
                Tentar de novo
              </Button>
            }
          />
        ) : ordered.length === 0 ? (
          <EmptyState
            title="Nenhuma aposta ainda"
            hint="Adicione sua primeira aposta no formulário acima para começar a acompanhar o desempenho."
          />
        ) : (
          <BetsTable bets={ordered} />
        )}
      </section>
    </PageShell>
  );
}
