"use client";

import React, { useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { ModalSheet } from "./ModalSheet";

/* Not exported: every caller passes options as an object literal and never names
   the type. Kept as a named interface because SheetPickerProps reads better. */
interface PickerOption {
  id: string;
  label: string;
  /** Secondary line — a price, a distance, an address. */
  detail?: string;
  disabled?: boolean;
}

interface SheetPickerProps {
  options: PickerOption[];
  value?: string | null;
  onSelect: (id: string) => void;
  title: string;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
}

/**
 * A choice control that presents a SHEET, not a dropdown.
 *
 * This is what the HIG actually asks for, twice over:
 *
 *   · "Avoid displaying popovers in compact views" — a dropdown anchored to its
 *     trigger is a popover, and every phone is a compact view. Apple's remedy
 *     is explicit: present a sheet instead.
 *   · "Use an action sheet — not a menu — to provide choices related to an
 *     action." Picking the market you are reporting a price for is part of that
 *     action, not an elective browse.
 *
 * A dropdown also cannot do what this needs: 30 markets do not fit under a
 * trigger, and each row carries a second line of context. A sheet gets the full
 * height, the scroll, and the two-line rows.
 */
export function SheetPicker({
  options,
  value,
  onSelect,
  title,
  label,
  placeholder = "Choose",
  disabled,
}: SheetPickerProps) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.id === value) ?? null;

  const commit = (id: string) => {
    onSelect(id);
    setOpen(false);
  };

  return (
    <div>
      {label && (
        <label className="mb-1.5 block text-footnote text-text-secondary">{label}</label>
      )}

      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="flex min-h-tap w-full items-center justify-between gap-2 bg-fillTertiary px-4 text-left
                   squircle text-text-primary
                   disabled:opacity-40 active:scale-[0.99] transition-transform duration-instant"
      >
        <span className={`truncate text-body ${selected ? "text-text-primary" : "text-text-tertiary"}`}>
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-text-tertiary" strokeWidth={2.5} />
      </button>

      <ModalSheet open={open} onClose={() => setOpen(false)} title={title} size="form">
        <div className="px-4 py-2">
          <div className="overflow-hidden bg-surface dark:bg-surface-elevated squircle-card">
            {options.length === 0 && (
              <p className="px-4 py-3 text-body text-text-tertiary">Nothing available</p>
            )}
            {options.map((o) => {
              const isSel = o.id === value;
              return (
                <button
                  key={o.id}
                  type="button"
                  disabled={o.disabled}
                  onClick={() => commit(o.id)}
                  aria-current={isSel}
                  /* Rows separate by fill on press, never by a rule. */
                  className="flex min-h-tap w-full items-center gap-3 px-4 py-2.5 text-left
                             disabled:opacity-40 active:bg-fillTertiary transition-colors duration-instant"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-body text-text-primary">{o.label}</span>
                    {o.detail && (
                      <span className="mt-0.5 block truncate text-footnote text-text-secondary">{o.detail}</span>
                    )}
                  </span>
                  {isSel && <Check className="h-5 w-5 shrink-0 text-status-info" strokeWidth={2.5} />}
                </button>
              );
            })}
          </div>
        </div>
      </ModalSheet>
    </div>
  );
}
