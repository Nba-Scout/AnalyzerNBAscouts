// Tela de carregamento inicial — migrado de static/app.jsx::LoadingScreen.

export function LoadingScreen() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0f0f13",
        color: "#8888a0",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
        fontFamily: "'JetBrains Mono', monospace",
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 10,
          flexShrink: 0,
          background: "linear-gradient(135deg, #6366f1, #4f46e5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 16,
          fontWeight: 700,
          color: "#fff",
        }}
      >
        NS
      </div>
      <div style={{ fontSize: 12, letterSpacing: 0.5, color: "#5a5a72" }}>Buscando props de hoje…</div>
      <div style={{ display: "flex", gap: 6 }}>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            style={{
              display: "inline-block",
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: "#6366f1",
              opacity: 0.2,
              animation: `nbaPulse 1.2s ease-in-out ${i * 0.2}s infinite`,
            }}
          />
        ))}
      </div>
      <style>{`
        @keyframes nbaPulse {
          0%, 80%, 100% { opacity: 0.2; }
          40%            { opacity: 1;   }
        }
      `}</style>
    </div>
  );
}
