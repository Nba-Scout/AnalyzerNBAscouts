// Smoke test do router (React Router v8). Os outros testes são de funções puras;
// este é o único que MONTA o App de verdade — é o que pega quebra de runtime em
// bump do router (HashRouter/Routes/Route/useNavigate/Outlet), que tsc e build não
// detectam. Mantido mínimo de propósito: rota inicial renderiza a Landing e o CTA
// navega para /dashboard.

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import App from "./App";
import { MotionProvider } from "./components/motion/MotionProvider";

function renderApp() {
  // retry: false — as páginas internas buscam a API, que não existe em jsdom;
  // sem isso o teste espera por retries que não interessam aqui.
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MotionProvider>
        <App />
      </MotionProvider>
    </QueryClientProvider>,
  );
}

describe("App router", () => {
  afterEach(() => {
    // globals: false no vitest.config.ts → o auto-cleanup do Testing Library não
    // se registra; sem isso os renders acumulam no mesmo DOM.
    cleanup();
    window.location.hash = "";
  });

  it("renders the Landing page on the initial route", async () => {
    renderApp();
    expect(await screen.findByRole("button", { name: /Entrar no painel/ })).toBeTruthy();
  });

  it("navigates to /dashboard when the panel CTA is clicked", async () => {
    renderApp();
    (await screen.findByRole("button", { name: /Entrar no painel/ })).click();
    await waitFor(() => expect(window.location.hash).toBe("#/dashboard"));
  });
});
