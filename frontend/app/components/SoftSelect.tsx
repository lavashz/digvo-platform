"use client";

import { useEffect, useRef, useState } from "react";

export type SoftSelectOption = { value: string; label: string };

interface SoftSelectProps {
  value: string;
  options: SoftSelectOption[];
  onChange: (value: string) => void;
  ariaLabel?: string;
  className?: string;
}

export default function SoftSelect({
  value,
  options,
  onChange,
  ariaLabel,
  className = "",
}: SoftSelectProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const current = options.find((o) => o.value === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        aria-label={ariaLabel}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="w-full lg:min-w-[12rem] flex items-center justify-between gap-3 bg-panel-2 border border-white/[0.1] hover:border-white/[0.18] focus:border-brand/60 rounded-full px-4 py-3 text-sm text-white outline-none transition"
      >
        <span className="truncate text-left">{current?.label ?? "—"}</span>
        <span className={`text-zinc-500 text-[10px] transition ${open ? "rotate-180" : ""}`}>▼</span>
      </button>
      {open && (
        <ul
          role="listbox"
          className="absolute z-30 mt-2 w-full min-w-[12rem] max-h-64 overflow-auto rounded-2xl border border-white/[0.1] bg-[#121214] shadow-2xl shadow-black/50 py-1 animate-fade-in"
        >
          {options.map((o) => {
            const active = o.value === value;
            return (
              <li key={o.value}>
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => {
                    onChange(o.value);
                    setOpen(false);
                  }}
                  className={`w-full text-left px-4 py-2.5 text-sm transition ${
                    active
                      ? "bg-brand/15 text-brand"
                      : "text-zinc-200 hover:bg-white/[0.06]"
                  }`}
                >
                  {o.label}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}