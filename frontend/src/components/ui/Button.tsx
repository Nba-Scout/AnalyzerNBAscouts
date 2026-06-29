// Button — primitivo tokenizado. Variantes ligadas aos tokens (sem cor inline).

import { type ButtonHTMLAttributes } from "react";

import { cn } from "../../lib/cn";

type Variant = "primary" | "ghost" | "outline" | "subtle";
type Size = "sm" | "md";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-accent text-accent-fg hover:bg-accent-hover",
  ghost: "bg-transparent text-fg-muted hover:text-fg hover:bg-raised",
  outline: "bg-transparent text-fg-muted border border-border hover:border-border-strong hover:text-fg",
  subtle: "bg-surface text-fg border border-border hover:border-border-strong",
};

const SIZES: Record<Size, string> = {
  sm: "h-7 px-2.5 text-xs gap-1",
  md: "h-9 px-3.5 text-sm gap-1.5",
};

export function Button({
  variant = "subtle",
  size = "md",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-md font-sans font-medium cursor-pointer",
        "transition-colors duration-150 active:scale-[.98]",
        "disabled:opacity-50 disabled:pointer-events-none",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    />
  );
}
