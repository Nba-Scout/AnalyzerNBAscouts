import { defineConfig } from "vitest/config";

// Config dedicada do Vitest (separada de vite.config.ts para evitar conflito de
// tipos entre o Vite do projeto e o Vite empacotado pelo Vitest). Os testes do C1
// são de funções puras (sem JSX) — nenhum plugin de transform é necessário aqui.
export default defineConfig({
  test: {
    environment: "jsdom",
    globals: false,
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
});
