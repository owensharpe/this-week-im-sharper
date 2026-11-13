"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

/**
 * A small button that opens a grid of choices, in the Markets panel style.
 * Choices can be grouped, carry a hint (e.g. today's yield) and be disabled.
 * Keyboard: arrows move between enabled choices, Home/End jump to the ends,
 * Enter picks, Escape closes.
 */

export interface PickerOption {
  value: string;
  label: string;
  hint?: string;
  group?: string;
  disabled?: boolean;
}

export function OptionPicker({
  value,
  options,
  onChange,
  name,
  columns = 4,
}: {
  value: string;
  options: PickerOption[];
  onChange: (value: string) => void;
  /** Accessible name, e.g. "Short tenor". */
  name: string;
  columns?: number;
}) {
  const [open, setOpen] = useState(false);
  const [alignRight, setAlignRight] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const current = options.find((o) => o.value === value);

  const close = (refocus = true) => {
    setOpen(false);
    if (refocus) triggerRef.current?.focus();
  };

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    // Start on the current choice.
    listRef.current?.querySelector<HTMLButtonElement>('[aria-selected="true"]')?.focus();
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      close();
      return;
    }
    const buttons = [...(listRef.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? [])];
    const at = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const next =
      e.key === "ArrowRight" || e.key === "ArrowDown"
        ? at + 1
        : e.key === "ArrowLeft" || e.key === "ArrowUp"
          ? at - 1
          : e.key === "Home"
            ? 0
            : e.key === "End"
              ? buttons.length - 1
              : null;
    if (next == null) return;
    e.preventDefault();
    buttons[Math.max(0, Math.min(buttons.length - 1, next))]?.focus();
  };

  const groups = [...new Set(options.map((o) => o.group ?? ""))];

  return (
    <div ref={rootRef} className="relative inline-block">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${name}: ${current?.label ?? value}`}
        onClick={() => {
          if (open) return close(false);
          const rect = triggerRef.current?.getBoundingClientRect();
          setAlignRight(rect ? rect.left + 260 > window.innerWidth : false);
          setOpen(true);
        }}
        className="inline-flex items-center gap-1 rounded-md border border-[color:var(--viz-border)] px-2 py-1 font-mono text-[12px] tabular-nums text-[color:var(--viz-ink)] transition-colors hover:border-[color:var(--viz-ink)]"
      >
        {current?.label ?? value}
        <ChevronDown className={`size-3.5 text-[color:var(--viz-muted)] transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>

      {open && (
        <div
          ref={listRef}
          role="listbox"
          aria-label={name}
          onKeyDown={onKey}
          className={`absolute top-full z-40 mt-1.5 w-[260px] rounded-lg border p-2.5 shadow-lg ${alignRight ? "right-0" : "left-0"}`}
          style={{ background: "var(--viz-panel)", borderColor: "var(--viz-border)", color: "var(--viz-ink)" }}
        >
          {groups.map((group) => {
            const inGroup = options.filter((o) => (o.group ?? "") === group);
            // A short group (the five bills) sits on one row rather than wrapping one over.
            const cols = inGroup.length <= columns + 1 ? inGroup.length : columns;
            return (
            <div key={group || "all"} className="mb-1.5 last:mb-0">
              {group && (
                <p className="mb-1 px-1 font-mono text-[10px] uppercase tracking-[0.2em]" style={{ color: "var(--viz-muted)" }}>
                  {group}
                </p>
              )}
              <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
                {inGroup.map((o) => {
                    const on = o.value === value;
                    return (
                      <button
                        key={o.value}
                        type="button"
                        role="option"
                        aria-selected={on}
                        disabled={o.disabled}
                        tabIndex={on ? 0 : -1}
                        onClick={() => {
                          onChange(o.value);
                          close();
                        }}
                        className={[
                          "flex flex-col items-center rounded-md px-1 py-1.5 font-mono transition-colors",
                          on
                            ? "bg-[color:var(--viz-ink)] text-[color:var(--viz-panel)]"
                            : "hover:bg-[color:color-mix(in_oklch,var(--viz-ink)_8%,transparent)] focus-visible:bg-[color:color-mix(in_oklch,var(--viz-ink)_8%,transparent)]",
                          o.disabled ? "cursor-default opacity-30 hover:bg-transparent" : "",
                        ].join(" ")}
                      >
                        <span className="text-[13px] font-semibold leading-tight">{o.label}</span>
                        {o.hint && (
                          <span
                            className="text-[10px] tabular-nums leading-tight"
                            style={{ color: on ? "var(--viz-panel)" : "var(--viz-muted)", opacity: on ? 0.75 : 1 }}
                          >
                            {o.hint}
                          </span>
                        )}
                      </button>
                    );
                  })}
              </div>
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
