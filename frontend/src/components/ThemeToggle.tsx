// Toggle de tema dark/light — tokenizado (Etapa 5).

import { useTheme } from "../hooks/useTheme";

export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const isDark = theme === "dark";
  return (
    <button
      onClick={toggle}
      title={isDark ? "Tema claro" : "Tema escuro"}
      aria-label={isDark ? "Alternar para tema claro" : "Alternar para tema escuro"}
      className="inline-flex h-8 w-8 flex-shrink-0 cursor-pointer items-center justify-center rounded-md border border-border text-sm leading-none text-fg-muted transition-colors hover:border-accent hover:text-accent"
    >
      {isDark ? "☀" : "☾"}
    </button>
  );
}
