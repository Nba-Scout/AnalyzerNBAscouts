// App shell do C2 — monta o Dashboard + painel de tweaks.
// Navegação para a página de jogador via hash (#player/Nome); o HashRouter e a
// página Player completos chegam no C3, que substitui este mount por rotas.

import { TweaksPanel } from "./components/tweaks/TweaksPanel";
import { TweakNumber, TweakRadio, TweakSection } from "./components/tweaks/controls";
import { type Tweaks, useTweaks } from "./hooks/useTweaks";
import { Dashboard } from "./pages/Dashboard";

export default function App() {
  const { tweaks, setTweak } = useTweaks();
  const onPlayer = (name: string) => {
    window.location.hash = `player/${encodeURIComponent(name)}`;
  };

  return (
    <>
      <Dashboard onPlayer={onPlayer} tweaks={tweaks} setTweak={setTweak} />
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
        <TweakSection label="Bankroll">
          <TweakNumber
            label="Valor (R$)"
            value={tweaks.bankroll ?? 1000}
            min={0}
            max={100000}
            step={50}
            unit="R$"
            onChange={(v) => setTweak("bankroll", v)}
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
