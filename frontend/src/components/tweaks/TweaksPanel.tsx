// Painel de tweaks flutuante — migrado de static/tweaks-panel.jsx::TweaksPanel.
//
// Diferença de produção: o legado só abria via protocolo postMessage do host de
// design (__activate_edit_mode). Aqui ele também abre por um botão flutuante (⚙),
// para que oddMode/kellyMode/bankroll sejam ajustáveis fora do host. O protocolo
// do host continua ligado, mas guardado por `window.parent !== window` (no-op em produção).

import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";

import { TWEAKS_STYLE } from "./style";

const inIframe = (): boolean => typeof window !== "undefined" && window.parent !== window;

function postToHost(message: unknown): void {
  if (!inIframe()) return;
  try {
    window.parent.postMessage(message, "*");
  } catch {
    /* cross-origin: ignore */
  }
}

const PAD = 16;

export function TweaksPanel({ title = "Ajustes", children }: { title?: string; children?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const dragRef = useRef<HTMLDivElement>(null);
  // Posição em estado (não ref): a regra react-hooks/refs proíbe ler ref no render,
  // e o style precisa do valor atual a cada paint.
  const [pos, setPos] = useState({ x: PAD, y: PAD });

  const clampToViewport = useCallback(() => {
    const panel = dragRef.current;
    if (!panel) return;
    const w = panel.offsetWidth;
    const h = panel.offsetHeight;
    const maxRight = Math.max(PAD, window.innerWidth - w - PAD);
    const maxBottom = Math.max(PAD, window.innerHeight - h - PAD);
    setPos((p) => ({
      x: Math.min(maxRight, Math.max(PAD, p.x)),
      y: Math.min(maxBottom, Math.max(PAD, p.y)),
    }));
  }, []);

  useEffect(() => {
    if (!open) return;
    clampToViewport();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", clampToViewport);
      return () => window.removeEventListener("resize", clampToViewport);
    }
    const ro = new ResizeObserver(clampToViewport);
    ro.observe(document.documentElement);
    return () => ro.disconnect();
  }, [open, clampToViewport]);

  // Protocolo do host de design — registra o listener ANTES de anunciar
  // disponibilidade (senão um activate poderia chegar antes do handler existir).
  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      // Protocolo dev-only: só aceita mensagens same-origin (o host de design
      // roda no mesmo Vite em dev; em produção não há parent/host).
      if (e.origin !== window.location.origin) return;
      const t = (e?.data as { type?: string } | null)?.type;
      if (t === "__activate_edit_mode") setOpen(true);
      else if (t === "__deactivate_edit_mode") setOpen(false);
    };
    window.addEventListener("message", onMsg);
    postToHost({ type: "__edit_mode_available" });
    return () => window.removeEventListener("message", onMsg);
  }, []);

  const dismiss = () => {
    setOpen(false);
    postToHost({ type: "__edit_mode_dismissed" });
  };

  const onDragStart = (e: React.MouseEvent) => {
    const panel = dragRef.current;
    if (!panel) return;
    const r = panel.getBoundingClientRect();
    const sx = e.clientX;
    const sy = e.clientY;
    const startRight = window.innerWidth - r.right;
    const startBottom = window.innerHeight - r.bottom;
    const move = (ev: MouseEvent) => {
      const w = panel.offsetWidth;
      const h = panel.offsetHeight;
      const maxRight = Math.max(PAD, window.innerWidth - w - PAD);
      const maxBottom = Math.max(PAD, window.innerHeight - h - PAD);
      setPos({
        x: Math.min(maxRight, Math.max(PAD, startRight - (ev.clientX - sx))),
        y: Math.min(maxBottom, Math.max(PAD, startBottom - (ev.clientY - sy))),
      });
    };
    const up = () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };

  if (!open) {
    return (
      <>
        <style>{TWEAKS_STYLE}</style>
        <button type="button" className="twk-fab" title={title} aria-label={title} onClick={() => setOpen(true)}>
          ⚙
        </button>
      </>
    );
  }

  return (
    <>
      <style>{TWEAKS_STYLE}</style>
      <div ref={dragRef} className="twk-panel" style={{ right: pos.x, bottom: pos.y }}>
        <div className="twk-hd" onMouseDown={onDragStart}>
          <b>{title}</b>
          <button className="twk-x" aria-label="Fechar tweaks" onMouseDown={(e) => e.stopPropagation()} onClick={dismiss}>
            ✕
          </button>
        </div>
        <div className="twk-body">{children}</div>
      </div>
    </>
  );
}
