import React from 'react'
import ReactDOM from 'react-dom/client'
import './styles/global.css'

// TODO (C1): substituir por App.tsx + QueryClientProvider + HashRouter
function ComingSoon() {
  return (
    <div style={{
      minHeight: '100vh', background: '#0f0f13', color: '#8888a0',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', gap: 16,
      fontFamily: "'JetBrains Mono', monospace",
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: 10,
        background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 16, fontWeight: 700, color: '#fff',
      }}>NS</div>
      <div style={{ fontSize: 13, color: '#5a5a72' }}>
        NBA Scout — Vite build ativo. Migração do frontend em progresso.
      </div>
    </div>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ComingSoon />
  </React.StrictMode>,
)
