// Tooltip — dica no hover, tokenizada. Em vistas densas substitui labels.

import { type ReactNode, useState } from "react";

export function Tooltip({ text, children }: { text: string; children: ReactNode }) {
  const [show, setShow] = useState(false);
  return (
    <span className="relative inline-flex items-center" onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      {children}
      {show && (
        <span
          role="tooltip"
          className="absolute bottom-[calc(100%+6px)] left-1/2 z-50 max-w-[260px] -translate-x-1/2 whitespace-normal rounded-md border border-border-strong bg-overlay px-2.5 py-1.5 text-left font-sans text-[11.5px] leading-relaxed text-fg shadow-lg pointer-events-none"
        >
          {text}
        </span>
      )}
    </span>
  );
}
