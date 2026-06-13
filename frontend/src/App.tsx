// Placeholder do C1 — exercita a camada de dados (useProps) + um átomo (QuotaBadge).
// O App real (HashRouter + Dashboard/Player) chega no C3.

import { useProps } from "./api/queries";
import { QuotaBadge } from "./components/atoms";

export default function App() {
  const { data, isLoading, isError } = useProps();

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--bg-base, #0f0f13)",
        color: "var(--text-primary, #e8e8f0)",
        fontFamily: "'Inter Tight', sans-serif",
        padding: 24,
      }}
    >
      <header style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            background: "linear-gradient(135deg, #6366f1, #4f46e5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 16,
            fontWeight: 700,
            color: "#fff",
            fontFamily: "'JetBrains Mono', monospace",
          }}
        >
          NS
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 18 }}>NBA Scout</div>
          <div style={{ fontSize: 12, color: "#8888a0" }}>Fundação do frontend (C1) — Dashboard e Player chegam no C2/C3</div>
        </div>
      </header>

      {isLoading && <div style={{ color: "#8888a0" }}>Carregando props…</div>}
      {isError && <div style={{ color: "#fca5a5" }}>Backend indisponível (esperado sem a API rodando).</div>}
      {data && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <QuotaBadge used={data.quota_limit - data.quota_remaining} limit={data.quota_limit} />
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, color: "#cbd5e1" }}>
            {data.props.length} props {data.demo_mode ? "· DEMO" : ""}
          </div>
        </div>
      )}
    </div>
  );
}
