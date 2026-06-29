// Faixa de métricas-resumo — redesign com Panel + Stat + AnimatedNumber.

import { AnimatedNumber, Panel, Stat } from "../../components/ui";
import type { Metrics } from "../../lib/props";

const int = (v: number) => String(Math.round(v));

export function SummaryStrip({ metrics }: { metrics: Metrics }) {
  const pctPos = metrics.total ? Math.round((metrics.evPositiveCount / metrics.total) * 100) : 0;
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <Panel>
        <Stat label="Props analisadas" value={<AnimatedNumber value={metrics.total} format={int} />} sub="no resultado filtrado" />
      </Panel>
      <Panel>
        <Stat
          label="EV Positivo"
          value={<AnimatedNumber value={metrics.evPositiveCount} format={int} />}
          accentClass="text-ev-strong"
          sub={`${pctPos}% do total`}
        />
      </Panel>
      <Panel>
        <Stat
          label="Strong Bets"
          value={<AnimatedNumber value={metrics.strong} format={int} />}
          accentClass="text-accent"
          sub="EV ≥ 8% e prob ≥ 60%"
        />
      </Panel>
      <Panel>
        <Stat
          label="EV médio (positivos)"
          value={<AnimatedNumber value={metrics.avgEv} format={(v) => `${v.toFixed(1)}%`} />}
          accentClass="text-ev-strong"
          sub="apenas props com EV > 0"
        />
      </Panel>
    </div>
  );
}
