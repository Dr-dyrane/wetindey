"use client";

import React, { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";

export interface MenuOption {
  id: string;
  label: string;
  /** Secondary line, e.g. a price or a distance. */
  detail?: string;
  icon?: React.ReactNode;
  destructive?: boolean;
  disabled?: boolean;
}

interface DropdownMenuProps {
  options: MenuOption[];
  value?: string | null;
  onSelect: (id: string) => void;
  /** Shown when nothing is selected. */
  placeholder?: string;
  label?: string;
  align?: "start" | "end";
  /** Renders the trigger as a plain button rather than a form field. */
  variant?: "field" | "button";
  triggerContent?: React.ReactNode;
  disabled?: boolean;
}

/**
 * iOS-style pull-down menu.
 *
 * Replaces the native <select> for action and choice affordances. A native
 * select can only render a flat list of strings, which forced the price form to
 * throw away the detail that makes a choice obvious — which market is nearest,
 * what a unit actually costs. This renders arbitrary content per row, marks the
 * current selection with a checkmark, and reads as one of the app's own
 * surfaces rather than an OS widget dropped into it.
 *
 * Keyboard: Enter/Space/ArrowDown open, arrows move, Enter selects, Escape
 * closes and returns focus to the trigger.
 */
export function DropdownMenu({
  options,
  value,
  onSelect,
  placeholder = "Select",
  label,
  align = "start",
  variant = "field",
  triggerContent,
  disabled,
}: DropdownMenuProps) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listId = useId();

  const selected = options.find((o) => o.id === value) ?? null;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    if (open) setActiveIndex(options.findIndex((o) => o.id === value));
  }, [open, options, value]);

  const commit = (o: MenuOption) => {
    if (o.disabled) return;
    onSelect(o.id);
    setOpen(false);
    triggerRef.current?.focus();
  };

  const onTriggerKey = (e: React.KeyboardEvent) => {
    if (["ArrowDown", "Enter", " "].includes(e.key)) {
      e.preventDefault();
      setOpen(true);
    }
  };

  const onListKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const dir = e.key === "ArrowDown" ? 1 : -1;
      let i = activeIndex;
      // Skip disabled rows so arrowing never parks on something inert.
      for (let n = 0; n < options.length; n++) {
        i = (i + dir + options.length) % options.length;
        if (!options[i].disabled) break;
      }
      setActiveIndex(i);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (options[activeIndex]) commit(options[activeIndex]);
    }
  };

  return (
    <div ref={rootRef} className="relative">
      {label && (
        <label className="block text-[11px] font-semibold uppercase tracking-wider text-text-tertiary mb-1.5">
          {label}
        </label>
      )}

      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={onTriggerKey}
        className={
          variant === "field"
            ? `w-full flex items-center justify-between gap-2 rounded-input px-3.5 py-2.5 text-left
               bg-surface text-text-primary shadow-card
               ring-1 ring-inset ring-separator
               disabled:opacity-40 active:scale-[0.99] transition-transform duration-instant`
            : `inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-semibold
               bg-fillSecondary text-text-primary active:scale-95 transition-transform duration-instant
               disabled:opacity-40`
        }
      >
        {triggerContent ?? (
          <span className={`truncate text-[15px] ${selected ? "text-text-primary" : "text-text-tertiary"}`}>
            {selected?.label ?? placeholder}
          </span>
        )}
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-text-tertiary transition-transform duration-micro ${open ? "rotate-180" : ""}`}
          strokeWidth={2.5}
        />
      </button>

      {open && (
        <div
          id={listId}
          role="listbox"
          tabIndex={-1}
          onKeyDown={onListKey}
          aria-activedescendant={options[activeIndex] ? `${listId}-${options[activeIndex].id}` : undefined}
          ref={(el) => el?.focus()}
          className={`absolute z-50 mt-1.5 min-w-full max-h-64 overflow-y-auto overscroll-contain
                      rounded-[14px] bg-surface-elevated shadow-raised ring-1 ring-inset ring-separator
                      py-1 outline-none
                      animate-in fade-in zoom-in-95 duration-micro origin-top
                      ${align === "end" ? "right-0" : "left-0"}`}
        >
          {options.length === 0 && (
            <p className="px-3.5 py-2.5 text-[13px] text-text-tertiary">Nothing available</p>
          )}
          {options.map((o, i) => {
            const isSel = o.id === value;
            return (
              <button
                key={o.id}
                id={`${listId}-${o.id}`}
                role="option"
                aria-selected={isSel}
                disabled={o.disabled}
                onClick={() => commit(o)}
                onMouseEnter={() => setActiveIndex(i)}
                className={`w-full flex items-center gap-2.5 px-3.5 py-2 text-left text-[15px]
                            disabled:opacity-40
                            ${i === activeIndex ? "bg-fillTertiary" : ""}
                            ${o.destructive ? "text-status-unavailable-fg" : "text-text-primary"}`}
              >
                <span className="w-4 shrink-0">
                  {isSel && <Check className="h-4 w-4 text-status-info" strokeWidth={3} />}
                </span>
                {o.icon && <span className="shrink-0 text-text-secondary">{o.icon}</span>}
                <span className="flex-1 min-w-0 truncate">{o.label}</span>
                {o.detail && <span className="shrink-0 text-[13px] text-text-secondary tabular-nums">{o.detail}</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
