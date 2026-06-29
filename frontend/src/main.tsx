import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import App from "./App";
import { MotionProvider } from "./components/motion/MotionProvider";
import { initTheme } from "./hooks/useTheme";
import "./styles/global.css";

// Aplica o tema salvo antes do primeiro paint (evita flash).
initTheme();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Não re-tenta 404 (ex.: jogador inexistente) e limita o resto a 1 retry.
      retry: (failureCount, error) => {
        if (error instanceof Error && error.message.includes("404")) return false;
        return failureCount < 1;
      },
    },
  },
});

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <MotionProvider>
          <App />
        </MotionProvider>
      </QueryClientProvider>
    </StrictMode>,
  );
}
