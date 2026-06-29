// CSS do painel de tweaks — DARK GLASS tokenizado (Etapa 4). Usa as CSS vars de
// tema (--c-*), então acompanha dark/light. Substitui o glass claro do legado.

export const TWEAKS_STYLE = `
  .twk-panel{position:fixed;right:16px;bottom:16px;z-index:2147483646;width:284px;
    max-height:calc(100vh - 32px);display:flex;flex-direction:column;
    background:color-mix(in oklab, var(--c-surface) 86%, transparent);
    color:var(--c-text);
    -webkit-backdrop-filter:blur(20px) saturate(140%);backdrop-filter:blur(20px) saturate(140%);
    border:1px solid var(--c-border);border-radius:14px;
    box-shadow:0 1px 0 color-mix(in oklab, var(--c-text) 6%, transparent) inset,0 16px 48px rgba(0,0,0,.5);
    font:11.5px/1.4 "Inter Tight",ui-sans-serif,system-ui,sans-serif;overflow:hidden}
  .twk-hd{display:flex;align-items:center;justify-content:space-between;
    padding:11px 8px 11px 14px;cursor:move;user-select:none;border-bottom:1px solid var(--c-border)}
  .twk-hd b{font-size:11px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--c-text-muted);
    font-family:"JetBrains Mono",monospace}
  .twk-x{appearance:none;border:0;background:transparent;color:var(--c-text-subtle);
    width:22px;height:22px;border-radius:6px;cursor:pointer;font-size:13px;line-height:1}
  .twk-x:hover{background:var(--c-raised);color:var(--c-text)}
  .twk-body{padding:12px 14px 14px;display:flex;flex-direction:column;gap:11px;
    overflow-y:auto;overflow-x:hidden;min-height:0;
    scrollbar-width:thin;scrollbar-color:color-mix(in oklab, var(--c-text) 14%, transparent) transparent}
  .twk-body::-webkit-scrollbar{width:8px}
  .twk-body::-webkit-scrollbar-thumb{background:color-mix(in oklab, var(--c-text) 12%, transparent);border-radius:4px;
    border:2px solid transparent;background-clip:content-box}
  .twk-row{display:flex;flex-direction:column;gap:6px}
  .twk-row-h{flex-direction:row;align-items:center;justify-content:space-between;gap:10px}
  .twk-lbl{display:flex;justify-content:space-between;align-items:baseline;color:var(--c-text-muted)}
  .twk-lbl>span:first-child{font-weight:500}
  .twk-val{color:var(--c-text-subtle);font-variant-numeric:tabular-nums;font-family:"JetBrains Mono",monospace}

  .twk-sect{font-size:10px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;
    color:var(--c-text-subtle);padding:8px 0 0;font-family:"JetBrains Mono",monospace}
  .twk-sect:first-child{padding-top:0}

  .twk-field{appearance:none;width:100%;height:28px;padding:0 8px;
    border:1px solid var(--c-border);border-radius:7px;
    background:var(--c-canvas);color:inherit;font:inherit;outline:none}
  .twk-field:focus{border-color:var(--c-accent)}

  .twk-slider{appearance:none;-webkit-appearance:none;width:100%;height:4px;margin:6px 0;
    border-radius:999px;background:var(--c-border);outline:none;accent-color:var(--c-accent)}
  .twk-slider::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;
    width:14px;height:14px;border-radius:50%;background:var(--c-accent);cursor:pointer}
  .twk-slider::-moz-range-thumb{width:14px;height:14px;border-radius:50%;background:var(--c-accent);border:0;cursor:pointer}

  .twk-seg{position:relative;display:flex;padding:2px;border-radius:8px;
    background:var(--c-canvas);border:1px solid var(--c-border);user-select:none}
  .twk-seg-thumb{position:absolute;top:2px;bottom:2px;border-radius:6px;
    background:color-mix(in oklab, var(--c-accent) 18%, transparent);
    border:1px solid color-mix(in oklab, var(--c-accent) 45%, transparent);
    transition:left .18s cubic-bezier(.3,.7,.4,1),width .18s}
  .twk-seg.dragging .twk-seg-thumb{transition:none}
  .twk-seg button{appearance:none;position:relative;z-index:1;flex:1;border:0;
    background:transparent;color:var(--c-text-muted);font:inherit;font-weight:500;min-height:24px;
    border-radius:6px;cursor:pointer;padding:4px 6px;line-height:1.2;overflow-wrap:anywhere}
  .twk-seg button[aria-checked="true"]{color:var(--c-accent)}

  .twk-toggle{position:relative;width:34px;height:18px;border:0;border-radius:999px;
    background:var(--c-border);transition:background .15s;cursor:pointer;padding:0}
  .twk-toggle[data-on="1"]{background:var(--c-accent)}
  .twk-toggle i{position:absolute;top:2px;left:2px;width:14px;height:14px;border-radius:50%;
    background:var(--c-canvas);transition:transform .15s}
  .twk-toggle[data-on="1"] i{transform:translateX(16px)}

  .twk-num{display:flex;align-items:center;height:28px;padding:0 0 0 8px;
    border:1px solid var(--c-border);border-radius:7px;background:var(--c-canvas)}
  .twk-num-lbl{font-weight:500;color:var(--c-text-muted);cursor:ew-resize;user-select:none;padding-right:8px}
  .twk-num input{flex:1;min-width:0;height:100%;border:0;background:transparent;
    font:inherit;font-family:"JetBrains Mono",monospace;font-variant-numeric:tabular-nums;text-align:right;padding:0 8px 0 0;
    outline:none;color:inherit;-moz-appearance:textfield}
  .twk-num input::-webkit-inner-spin-button,.twk-num input::-webkit-outer-spin-button{-webkit-appearance:none;margin:0}
  .twk-num-unit{padding-right:8px;color:var(--c-text-subtle)}

  .twk-btn{appearance:none;height:28px;padding:0 12px;border:0;border-radius:7px;
    background:var(--c-accent);color:var(--c-accent-fg);font:inherit;font-weight:600;cursor:pointer}
  .twk-btn.secondary{background:var(--c-raised);color:var(--c-text);border:1px solid var(--c-border)}

  .twk-swatch{appearance:none;-webkit-appearance:none;width:56px;height:24px;
    border:1px solid var(--c-border);border-radius:6px;padding:0;cursor:pointer;background:transparent;flex-shrink:0}
  .twk-swatch::-webkit-color-swatch-wrapper{padding:0}
  .twk-swatch::-webkit-color-swatch{border:0;border-radius:5.5px}

  .twk-fab{position:fixed;right:16px;bottom:16px;z-index:2147483645;
    width:42px;height:42px;border-radius:50%;border:1px solid var(--c-border);
    background:color-mix(in oklab, var(--c-surface) 86%, transparent);
    -webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);
    color:var(--c-text-muted);cursor:pointer;font-size:18px;line-height:1;
    display:flex;align-items:center;justify-content:center;
    box-shadow:0 8px 24px rgba(0,0,0,.45);transition:color .15s,border-color .15s,transform .15s}
  .twk-fab:hover{color:var(--c-accent);border-color:color-mix(in oklab, var(--c-accent) 50%, transparent);transform:translateY(-1px)}
`;
