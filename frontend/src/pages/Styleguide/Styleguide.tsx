// Styleguide — design system navegável (Etapa 2). Mostra tokens + primitivos nos
// dois temas. Rota /styleguide (fora do shell do dashboard).

import { useState } from "react";

import { ThemeToggle } from "../../components/ThemeToggle";
import {
  AnimatedNumber,
  Badge,
  Button,
  Card,
  EmptyState,
  Panel,
  Pill,
  RatingBadge,
  Skeleton,
  Stat,
  Tabs,
  Tooltip,
} from "../../components/ui";

const SWATCHES = [
  "canvas",
  "surface",
  "raised",
  "overlay",
  "border",
  "accent",
  "fg",
  "fg-muted",
  "fg-subtle",
  "ev-strong",
  "ev-pos",
  "ev-neutral",
  "ev-neg",
  "hit-hi",
  "hit-mid",
  "hit-lo",
  "info",
  "signal-pos",
  "signal-neg",
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-mono text-[11px] uppercase tracking-[0.12em] text-fg-subtle">{title}</h2>
      {children}
    </section>
  );
}

export function Styleguide() {
  const [tab, setTab] = useState("terminal");
  const [n, setN] = useState(11.2);

  return (
    <div className="min-h-screen bg-canvas font-sans text-fg">
      <header className="sticky top-0 z-10 border-b border-border bg-canvas/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-6 py-3.5">
          <div className="font-mono text-sm font-bold">NBA Scout — Design System</div>
          <span className="font-mono text-[10px] uppercase tracking-widest text-fg-subtle">Terminal Pro</span>
          <div className="flex-1" />
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto flex max-w-5xl flex-col gap-10 px-6 py-8">
        <Section title="Cores (tokens semânticos)">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5">
            {SWATCHES.map((name) => (
              <div key={name} className="overflow-hidden rounded-md border border-border">
                <div className="h-12 w-full" style={{ background: `var(--c-${name})` }} />
                <div className="bg-surface px-2 py-1 font-mono text-[10px] text-fg-muted">{name}</div>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Tipografia">
          <div className="flex flex-col gap-1.5">
            <div className="font-sans text-2xl font-bold">Inter Tight · títulos e labels</div>
            <div className="font-mono text-base tabular-nums">JetBrains Mono · 26.5 · +11.2% · 1.91 (dados)</div>
            <div className="font-sans text-sm text-fg-muted">Texto secundário · fg-muted</div>
            <div className="font-sans text-xs text-fg-subtle">Texto sutil / hints · fg-subtle</div>
          </div>
        </Section>

        <Section title="Botões">
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="primary">Primário</Button>
            <Button variant="subtle">Subtle</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="primary" size="sm">
              Pequeno
            </Button>
            <Button variant="subtle" disabled>
              Disabled
            </Button>
          </div>
        </Section>

        <Section title="Badges & Rating">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="neutral">NEUTRAL</Badge>
            <Badge tone="accent">ACCENT</Badge>
            <Badge tone="pos">EV+</Badge>
            <Badge tone="value">VALUE</Badge>
            <Badge tone="neg">EV-</Badge>
            <Badge tone="warn">WARN</Badge>
            <span className="mx-2 h-4 w-px bg-border" />
            <RatingBadge rating="STRONG" />
            <RatingBadge rating="VALUE" />
            <RatingBadge rating="NEUTRAL" />
            <RatingBadge rating="AVOID" />
          </div>
        </Section>

        <Section title="Cards & Stats (+ número animado)">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Panel>
              <Stat label="Props" value="27" sub="no resultado" />
            </Panel>
            <Panel>
              <Stat label="EV+" value="18" accentClass="text-ev-strong" sub="67% do total" />
            </Panel>
            <Panel>
              <Stat label="Strong" value="6" accentClass="text-accent" sub="EV ≥ 8%" />
            </Panel>
            <Panel>
              <Stat
                label="EV médio"
                value={<AnimatedNumber value={n} format={(v) => `${v.toFixed(1)}%`} />}
                accentClass="text-ev-strong"
                sub={
                  <Button size="sm" variant="ghost" onClick={() => setN(Math.round((4 + Math.random() * 12) * 10) / 10)}>
                    ↻ animar
                  </Button>
                }
              />
            </Panel>
          </div>
        </Section>

        <Section title="Pills (filtros)">
          <div className="flex flex-wrap gap-1.5">
            {["ALL", "PTS", "REB", "AST", "PRA"].map((m, i) => (
              <Pill key={m} active={i === 1}>
                {m}
              </Pill>
            ))}
          </div>
        </Section>

        <Section title="Tabs (underline animado)">
          <Tabs
            idBase="sg"
            value={tab}
            onChange={setTab}
            items={[
              { key: "terminal", label: "Terminal" },
              { key: "cards", label: "Card grid" },
              { key: "editorial", label: "Editorial" },
            ]}
          />
        </Section>

        <Section title="Tooltip">
          <Tooltip text="Expected Value: quanto acima do valor justo está a odd. Positivo = vantagem matemática.">
            <span className="cursor-help font-mono text-sm text-fg-muted underline decoration-dotted">EV% ⓘ</span>
          </Tooltip>
        </Section>

        <Section title="Skeleton & Empty state">
          <div className="grid gap-3 sm:grid-cols-2">
            <Card className="flex flex-col gap-2 p-4">
              <Skeleton className="h-4 w-2/5" />
              <Skeleton className="h-7 w-3/5" />
              <Skeleton className="h-3 w-full" />
            </Card>
            <EmptyState
              title="Nenhuma prop bate seus filtros."
              hint="Tente reduzir o EV mínimo ou limpar os filtros."
              action={
                <Button size="sm" variant="outline">
                  Limpar filtros
                </Button>
              }
            />
          </div>
        </Section>
      </main>
    </div>
  );
}
