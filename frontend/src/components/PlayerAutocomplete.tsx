// Combobox de jogador — sugere nomes do data warehouse ao digitar.
// Debounce local + navegação por teclado (↑ ↓ Enter Esc), tokenizado.

import { useEffect, useRef, useState } from "react";

import { usePlayerSearch } from "../api/queries";
import { cn } from "../lib/cn";

export function PlayerAutocomplete({
  value,
  onChange,
  placeholder,
  inputClassName,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  inputClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [debounced, setDebounced] = useState(value);
  const boxRef = useRef<HTMLDivElement>(null);

  // Debounce: só consulta 200ms após parar de digitar.
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), 200);
    return () => clearTimeout(t);
  }, [value]);

  const { data } = usePlayerSearch(debounced);
  // Não sugere quando o texto já é exatamente um nome escolhido.
  const suggestions = (data ?? []).filter((n) => n.toLowerCase() !== value.trim().toLowerCase());
  const show = open && suggestions.length > 0;

  // Fecha ao clicar fora.
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  // Índice ativo clampado ao tamanho atual da lista (evita índice fora de faixa
  // quando as sugestões mudam, sem precisar de setState em effect).
  const activeIdx = suggestions.length ? Math.min(active, suggestions.length - 1) : 0;

  function pick(name: string) {
    onChange(name);
    setOpen(false);
  }

  function onKey(e: React.KeyboardEvent) {
    if (!show) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((activeIdx + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((activeIdx - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      pick(suggestions[activeIdx]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={boxRef} className="relative">
      <input
        className={inputClassName}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setActive(0);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKey}
        placeholder={placeholder}
        role="combobox"
        aria-expanded={show}
        aria-autocomplete="list"
        autoComplete="off"
      />
      {show && (
        <ul className="absolute z-30 mt-1 max-h-60 w-full overflow-auto rounded-md border border-border-strong bg-overlay py-1 shadow-lg">
          {suggestions.map((name, i) => (
            <li key={name}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(name);
                }}
                onMouseEnter={() => setActive(i)}
                className={cn(
                  "block w-full cursor-pointer px-3 py-1.5 text-left font-mono text-sm",
                  i === activeIdx ? "bg-accent/15 text-accent" : "text-fg-muted hover:text-fg",
                )}
              >
                {name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
