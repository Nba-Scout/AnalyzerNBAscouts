// App shell — HashRouter. `/` = Landing (marketing, fora do Layout → sem tweaks);
// o painel vive em `/dashboard`, `/player/:name`, `/bets` dentro do <Layout>.
// O tweaks vive num único useTweaks no Layout e é compartilhado via Outlet context
// (senão Dashboard e Player teriam instâncias separadas do estado). Preserva URLs
// no formato hash (#/player/Nome).

import { lazy, Suspense } from "react";
import { AnimatePresence, m } from "motion/react";
import { HashRouter, Outlet, Route, Routes, useLocation, useNavigate, useOutletContext, useParams } from "react-router-dom";

import { TweaksPanel } from "./components/tweaks/TweaksPanel";
import { TweakNumber, TweakRadio, TweakSection } from "./components/tweaks/controls";
import { type Tweaks, type TweaksApi, useTweaks } from "./hooks/useTweaks";
import { Backtest } from "./pages/Backtest";
import { Bets } from "./pages/Bets";
import { Dashboard } from "./pages/Dashboard";
import { Landing } from "./pages/Landing";
import { Player } from "./pages/Player";

// Styleguide é dev-only — carregado sob demanda (fora do bundle principal).
const Styleguide = lazy(() => import("./pages/Styleguide/Styleguide").then((m) => ({ default: m.Styleguide })));

function Layout() {
  const api = useTweaks();
  const { tweaks, setTweak } = api;
  const location = useLocation();

  return (
    <>
      <AnimatePresence mode="wait" initial={false}>
        <m.div
          key={location.pathname}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          <Outlet context={api} />
        </m.div>
      </AnimatePresence>
      <TweaksPanel title="Ajustes">
        <TweakSection label="Layout">
          <TweakRadio
            label="Variação"
            value={tweaks.variation}
            onChange={(v) => setTweak("variation", v as Tweaks["variation"])}
            options={[
              { value: "terminal", label: "Terminal" },
              { value: "cards", label: "Cards" },
              { value: "editorial", label: "Editorial" },
            ]}
          />
        </TweakSection>
        <TweakSection label="Banca">
          <TweakNumber
            label="Valor (R$)"
            value={tweaks.bankroll ?? 1000}
            min={0}
            max={100000}
            step={50}
            unit="R$"
            onChange={(v) => setTweak("bankroll", v)}
          />
          <TweakRadio
            label="Unidade (banca em Nu)"
            value={String(tweaks.bankrollUnits ?? 100)}
            onChange={(v) => setTweak("bankrollUnits", Number(v))}
            options={[
              { value: "50", label: "50u" },
              { value: "100", label: "100u" },
              { value: "150", label: "150u" },
              { value: "200", label: "200u" },
            ]}
          />
        </TweakSection>
        <TweakSection label="Formato">
          <TweakRadio
            label="Odds"
            value={tweaks.oddMode}
            onChange={(v) => setTweak("oddMode", v as Tweaks["oddMode"])}
            options={[
              { value: "decimal", label: "Decimais" },
              { value: "implied", label: "% Implícita" },
            ]}
          />
          <TweakRadio
            label="Kelly"
            value={tweaks.kellyMode}
            onChange={(v) => setTweak("kellyMode", v as Tweaks["kellyMode"])}
            options={[
              { value: "full", label: "Full" },
              { value: "half", label: "1/2" },
              { value: "quarter", label: "1/4" },
              { value: "eighth", label: "1/8" },
            ]}
          />
        </TweakSection>
      </TweaksPanel>
    </>
  );
}

function DashboardRoute() {
  const { tweaks, setTweak } = useOutletContext<TweaksApi>();
  const navigate = useNavigate();
  return (
    <Dashboard
      onPlayer={(n) => navigate(`/player/${encodeURIComponent(n)}`)}
      onBets={() => navigate("/bets")}
      onBacktest={() => navigate("/backtest")}
      tweaks={tweaks}
      setTweak={setTweak}
    />
  );
}

function PlayerRoute() {
  const { tweaks } = useOutletContext<TweaksApi>();
  const navigate = useNavigate();
  const { name } = useParams();
  return <Player name={name ?? ""} onBack={() => navigate("/dashboard")} tweaks={tweaks} />;
}

function BetsRoute() {
  const { tweaks } = useOutletContext<TweaksApi>();
  const navigate = useNavigate();
  return <Bets onBack={() => navigate("/dashboard")} bankroll={tweaks.bankroll ?? 1000} />;
}

function BacktestRoute() {
  const navigate = useNavigate();
  return <Backtest onBack={() => navigate("/dashboard")} />;
}

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route
          path="styleguide"
          element={
            <Suspense fallback={null}>
              <Styleguide />
            </Suspense>
          }
        />
        <Route index element={<Landing />} />
        <Route element={<Layout />}>
          <Route path="dashboard" element={<DashboardRoute />} />
          <Route path="player/:name" element={<PlayerRoute />} />
          <Route path="bets" element={<BetsRoute />} />
          <Route path="backtest" element={<BacktestRoute />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
