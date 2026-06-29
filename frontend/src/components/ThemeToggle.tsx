// Toggle de tema dark/light. Estilo inline provisório (alinhado ao header atual);
// será reescrito com tokens/primitivos na Etapa 3/4.

import { useTheme } from "../hooks/useTheme";

export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const isDark = theme === "dark";
  return (
    <button
      onClick={toggle}
      title={isDark ? "Tema claro" : "Tema escuro"}
      aria-label={isDark ? "Alternar para tema claro" : "Alternar para tema escuro"}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 32,
        height: 32,
        flexShrink: 0,
        borderRadius: 6,
        background: "transparent",
        border: "1px solid var(--c-border)",
        color: "var(--c-fg-muted)",
        cursor: "pointer",
        fontSize: 14,
        lineHeight: 1,
        transition: "color .15s, border-color .15s",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.color = "var(--c-accent)";
        e.currentTarget.style.borderColor = "var(--c-accent)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.color = "var(--c-fg-muted)";
        e.currentTarget.style.borderColor = "var(--c-border)";
      }}
    >
      {isDark ? "☀" : "☾"}
    </button>
  );
}
