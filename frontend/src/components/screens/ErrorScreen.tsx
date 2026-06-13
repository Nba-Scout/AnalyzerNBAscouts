// Tela de erro com retry — migrado de static/app.jsx::ErrorScreen.

export function ErrorScreen({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0f0f13",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 18,
        padding: 32,
        textAlign: "center",
        fontFamily: "'JetBrains Mono', monospace",
      }}
    >
      <div
        style={{
          padding: "14px 20px",
          borderRadius: 8,
          background: "rgba(239,68,68,0.08)",
          border: "1px solid rgba(239,68,68,0.25)",
          fontSize: 12,
          color: "#fca5a5",
          maxWidth: 480,
          lineHeight: 1.6,
        }}
      >
        Erro ao buscar props:
        <br />
        {error}
      </div>
      <button
        onClick={onRetry}
        style={{
          padding: "8px 20px",
          borderRadius: 6,
          background: "#6366f1",
          border: "1px solid #4f46e5",
          color: "#fff",
          fontFamily: "inherit",
          fontSize: 12,
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        Tentar novamente
      </button>
    </div>
  );
}
