// Landing / Home (Etapa 6 do redesign) — porta de entrada de marketing antes do
// painel. Fica FORA do <Layout> (sem FAB de tweaks). Dark-first, tokenizada,
// motion via `m.*` (LazyMotion domAnimation → só initial/animate no mount, sem
// whileInView). Sem foto de terceiros: o visual do hero/CTA é gradiente CSS +
// grid sutil. Cópias fiéis ao mockup do usuário.

import { type ReactNode } from "react";
import { m } from "motion/react";
import { useNavigate } from "react-router-dom";

import { ThemeToggle } from "../../components/ThemeToggle";
import { cn } from "../../lib/cn";

const container = { hidden: {}, show: { transition: { staggerChildren: 0.07, delayChildren: 0.04 } } };
const item = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0 } };

/* ---- ícones (stroke = currentColor, 20px) ---- */
const sv = "h-5 w-5";
function IconTrend() {
  return (
    <svg
      className={sv}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 3v18h18" />
      <path d="m7 14 4-4 3 3 5-6" />
      <path d="M15 7h4v4" />
    </svg>
  );
}
function IconClock() {
  return (
    <svg
      className={sv}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}
function IconArrowUp() {
  return (
    <svg
      className={sv}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 19V5" />
      <path d="m5 12 7-7 7 7" />
    </svg>
  );
}
function IconList() {
  return (
    <svg
      className={sv}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M8 6h13M8 12h13M8 18h13" />
      <path d="M3 6h.01M3 12h.01M3 18h.01" />
    </svg>
  );
}
function IconTrophy() {
  return (
    <svg
      className={sv}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M6 4h12v4a6 6 0 0 1-12 0V4Z" />
      <path d="M18 5h2a2 2 0 0 1-2 4M6 5H4a2 2 0 0 0 2 4" />
      <path d="M12 14v4M9 21h6M10 18h4" />
    </svg>
  );
}
function IconRefresh() {
  return (
    <svg
      className={sv}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M21 12a9 9 0 1 1-3-6.7" />
      <path d="M21 4v5h-5" />
    </svg>
  );
}

function Logo({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-accent font-mono text-[13px] font-bold text-accent-fg shadow-md">
        NS
      </div>
      <div className="text-base font-bold leading-none tracking-tight">NBA Scout</div>
    </div>
  );
}

// Painel "court" — foto (se houver) sobre um fallback de gradiente + grid.
// `image` aponta para public/; se o arquivo não existir, o onError esconde o
// <img> e o fundo âmbar/quadra aparece no lugar (nunca quebra).
function CourtVisual({
  children,
  image,
  alt,
  overlay = "bottom",
}: {
  children?: ReactNode;
  image?: string;
  alt?: string;
  overlay?: "bottom" | "full";
}) {
  return (
    <div
      className="relative aspect-[16/9] w-full overflow-hidden rounded-2xl border border-border"
      style={{ background: "linear-gradient(135deg, var(--c-raised), var(--c-surface) 45%, var(--c-canvas))" }}
    >
      {/* grid sutil de quadra (fallback) */}
      <div
        className="absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            "linear-gradient(var(--c-border) 1px, transparent 1px), linear-gradient(90deg, var(--c-border) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
        }}
        aria-hidden
      />
      <div
        className="absolute -inset-24 opacity-60 blur-3xl"
        style={{ background: "radial-gradient(closest-side, rgba(245,158,11,0.20), transparent)" }}
        aria-hidden
      />
      <div className="absolute top-0 left-1/2 h-full w-px -translate-x-1/2 bg-border" aria-hidden />
      <div
        className="absolute top-1/2 left-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full border border-border"
        aria-hidden
      />

      {/* foto real (por cima do fallback) — escurecida via brightness p/ casar
          com o tema dark e dar legibilidade ao texto/chips */}
      {image && (
        <img
          src={image}
          alt={alt ?? ""}
          className="absolute inset-0 h-full w-full object-cover brightness-[.62] saturate-[.92] contrast-[1.05]"
          loading="lazy"
          decoding="async"
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
        />
      )}

      {/* overlay p/ legibilidade do texto/chips */}
      <div
        className={cn(
          "absolute inset-0",
          overlay === "full"
            ? "bg-gradient-to-t from-canvas/90 via-canvas/55 to-canvas/40"
            : "bg-gradient-to-t from-canvas/85 via-canvas/25 to-transparent",
        )}
        aria-hidden
      />

      {children}
    </div>
  );
}

interface Feature {
  icon: ReactNode;
  title: string;
  desc: string;
}

const FEATURES: Feature[] = [
  {
    icon: <IconTrend />,
    title: "EV% em tempo real",
    desc: "Probabilidade real estimada a partir dos últimos 10 jogos, ponderada por playoffs, defesa e pace do adversário, e comparada à odd da casa.",
  },
  {
    icon: <IconClock />,
    title: "Odds ao vivo",
    desc: "Linhas e odds atualizam em tempo real e piscam quando mudam: verde subiu, vermelho desceu. Você vê o mercado se mexer.",
  },
  {
    icon: <IconArrowUp />,
    title: "Kelly fracionado",
    desc: "Stake sugerida por Kelly / 4 conservador, calculada por prop. Gauge visual mostra a força da entrada de relance.",
  },
  {
    icon: <IconList />,
    title: "Rating por prop",
    desc: "Cada entrada classificada como STRONG, VALUE, NEUTRAL ou AVOID, com critérios transparentes de EV mínimo e probabilidade real.",
  },
  {
    icon: <IconTrophy />,
    title: "Histórico de playoffs",
    desc: "Médias de playoffs de temporadas anteriores entram no cálculo quando a amostra é confiável. Jogos de PO destacados no histórico.",
  },
  {
    icon: <IconRefresh />,
    title: "Cache inteligente",
    desc: "Resultados salvos entre sessões e quota da Odds API monitorada. 500 requests por mês rendem a temporada inteira.",
  },
];

export function Landing() {
  const navigate = useNavigate();
  const openPanel = () => navigate("/dashboard");
  const scrollToFeatures = () => document.getElementById("recursos")?.scrollIntoView({ behavior: "smooth" });

  return (
    <div className="min-h-screen bg-canvas font-sans text-fg">
      {/* Nav */}
      <header className="sticky top-0 z-20 border-b border-border bg-canvas/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between px-5 py-3.5 md:px-8">
          <Logo />
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <button
              onClick={openPanel}
              className="rounded-lg border border-border-strong bg-surface px-3.5 py-2 text-sm font-medium text-fg transition-colors hover:border-fg-subtle hover:bg-raised"
            >
              Entrar no painel →
            </button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-[420px] opacity-70"
          style={{ background: "radial-gradient(60% 100% at 50% 0%, rgba(245,158,11,0.14), transparent)" }}
          aria-hidden
        />
        <m.div
          variants={container}
          initial="hidden"
          animate="show"
          className="mx-auto max-w-[900px] px-5 pt-20 pb-10 text-center md:px-8 md:pt-28"
        >
          <m.div variants={item} className="mb-7 flex justify-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3.5 py-1.5 font-mono text-xs text-fg-muted">
              <span className="live-dot" /> Odds ao vivo · playoffs 2026
            </span>
          </m.div>

          <m.h1 variants={item} className="text-balance text-5xl font-extrabold leading-[1.02] tracking-tight md:text-7xl">
            Aposte com matemática,
            <br />
            <span className="text-fg-muted">não com palpite.</span>
          </m.h1>

          <m.p variants={item} className="mx-auto mt-7 max-w-2xl text-lg leading-relaxed text-fg-muted md:text-xl">
            O NBA Scout cruza <span className="font-semibold text-fg">stats reais</span>,{" "}
            <span className="font-semibold text-fg">odds ao vivo</span> e{" "}
            <span className="font-semibold text-fg">defesa do adversário</span> para encontrar props com valor esperado positivo.
            EV%, Kelly e rating em um único painel.
          </m.p>

          <m.div variants={item} className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={openPanel}
              className="inline-flex items-center gap-2 rounded-xl bg-accent px-6 py-3 text-base font-semibold text-accent-fg shadow-md transition-transform hover:scale-[1.02] hover:bg-accent-hover active:scale-[.98]"
            >
              <span aria-hidden>⊞</span> Abrir o painel
            </button>
            <button
              onClick={scrollToFeatures}
              className="inline-flex items-center gap-2 rounded-xl border border-border-strong bg-surface px-6 py-3 text-base font-medium text-fg transition-colors hover:border-fg-subtle hover:bg-raised"
            >
              Como funciona
            </button>
          </m.div>
        </m.div>

        <m.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.5 }}
          className="mx-auto max-w-[1000px] px-5 pb-20 md:px-8"
        >
          <CourtVisual image="/landing-kawhi.webp" alt="Kawhi Leonard — playoffs">
            <div className="absolute right-3 bottom-3 flex flex-wrap justify-end gap-2 font-mono text-[11px] text-fg-muted">
              <span className="rounded-md border border-border bg-canvas/80 px-2.5 py-1 backdrop-blur">
                4 jogos monitorados hoje
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-canvas/80 px-2.5 py-1 backdrop-blur">
                <span className="live-dot" /> 6 strong bets ativas
              </span>
            </div>
          </CourtVisual>
        </m.div>
      </section>

      {/* Recursos */}
      <section id="recursos" className="scroll-mt-20 border-t border-border bg-surface/40">
        <div className="mx-auto max-w-[1200px] px-5 py-20 md:px-8 md:py-28">
          <div className="mb-14 text-center">
            <div className="mb-3 font-mono text-xs tracking-[0.28em] text-accent uppercase">Recursos</div>
            <h2 className="text-4xl font-extrabold tracking-tight md:text-5xl">Tudo que você precisa para achar valor</h2>
            <p className="mx-auto mt-4 max-w-xl text-lg text-fg-muted">
              Da odd crua ao stake sugerido, sem sair de um único painel.
            </p>
          </div>

          <m.div variants={container} initial="hidden" animate="show" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <m.article
                key={f.title}
                variants={item}
                className="rounded-2xl border border-border bg-surface p-6 transition-colors hover:border-border-strong"
              >
                <div className="mb-5 inline-flex h-11 w-11 items-center justify-center rounded-xl border border-accent/25 bg-accent/10 text-accent">
                  {f.icon}
                </div>
                <h3 className="mb-2 text-lg font-semibold tracking-tight">{f.title}</h3>
                <p className="text-sm leading-relaxed text-fg-muted">{f.desc}</p>
              </m.article>
            ))}
          </m.div>
        </div>
      </section>

      {/* CTA band */}
      <section className="relative overflow-hidden border-t border-border">
        <CourtVisual image="/landing-rayallen.jpg" alt="Arremesso decisivo nos playoffs" overlay="full">
          <div className="absolute inset-0 flex flex-col items-center justify-center px-5 text-center">
            <div className="relative">
              <h2 className="text-3xl font-extrabold tracking-tight md:text-5xl">Pronto para achar sua próxima entrada?</h2>
              <p className="mx-auto mt-4 max-w-md text-base text-fg-muted md:text-lg">
                Os jogos de hoje já estão analisados. Sem cadastro, sem burocracia.
              </p>
              <button
                onClick={openPanel}
                className="mt-8 inline-flex items-center gap-2 rounded-xl bg-accent px-6 py-3 text-base font-semibold text-accent-fg shadow-md transition-transform hover:scale-[1.02] hover:bg-accent-hover active:scale-[.98]"
              >
                <span aria-hidden>⊞</span> Abrir o painel
              </button>
            </div>
          </div>
        </CourtVisual>
      </section>

      {/* Footer */}
      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-[1200px] flex-col gap-4 px-5 py-10 md:flex-row md:items-center md:justify-between md:px-8">
          <div className="max-w-md">
            <Logo className="mb-2.5" />
            <p className="text-sm text-fg-subtle">
              Aposte com matemática, não com palpite. EV%, Kelly e rating por prop em um único painel.
            </p>
          </div>
          <div className="font-mono text-xs text-fg-subtle">© 2026 NBA Scout · EV Analyzer</div>
        </div>
      </footer>
    </div>
  );
}
