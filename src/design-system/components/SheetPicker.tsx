"use client";

import React, { useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { ModalSheet, useModalSheetNavigation } from "./ModalSheet";
import { transition } from "@/design-system/motion";

interface PickerOption {
  id: string;
  label: string;
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

function PickerOptions({
  options,
  value,
  onSelect,
}: {
  options: PickerOption[];
  value?: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="px-4 py-2">
      <div className="squircle-card overflow-hidden bg-surface-card">
        {options.length === 0 && (
          <p className="px-4 py-3 text-body text-text-tertiary">Nothing available</p>
        )}
        {options.map((option) => {
          const selected = option.id === value;
          return (
            <button
              key={option.id}
              type="button"
              disabled={option.disabled}
              onClick={() => onSelect(option.id)}
              aria-current={selected}
              className={`flex min-h-tap w-full items-center gap-3 px-4 py-2.5 text-left active:bg-fillTertiary disabled:opacity-40 ${transition.feedback}`}
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-body text-text-primary">{option.label}</span>
                {option.detail && (
                  <span className="mt-0.5 block truncate text-footnote text-text-secondary">
                    {option.detail}
                  </span>
                )}
              </span>
              {selected && (
                <Check className="h-5 w-5 shrink-0 text-status-info" strokeWidth={2.5} />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * A choice control that uses the existing modal's contextual navigation when
 * one is present. This removes the historical ModalSheet-inside-ModalSheet
 * behavior without downgrading a compact choice to a dropdown.
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
  const navigation = useModalSheetNavigation();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [fallbackOpen, setFallbackOpen] = useState(false);
  const [childId, setChildId] = useState<string | null>(null);
  const selected = options.find((option) => option.id === value) ?? null;
  const labelId = React.useId();
  const isOpen = navigation ? navigation.childOpen && navigation.childId === childId : fallbackOpen;

  const commit = (id: string) => {
    onSelect(id);
    if (navigation) {
      setChildId(null);
      navigation.popChild();
    } else {
      setFallbackOpen(false);
    }
  };

  const openPicker = () => {
    if (!navigation) {
      setFallbackOpen(true);
      return;
    }

    const nextChildId = navigation.pushChild({
      title,
      returnFocus: triggerRef.current,
      content: <PickerOptions options={options} value={value} onSelect={commit} />,
    });
    setChildId(nextChildId);
  };

  return (
    <div>
      {label && (
        <label id={labelId} className="mb-1.5 block text-footnote text-text-secondary">
          {label}
        </label>
      )}

      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={openPicker}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-labelledby={label ? labelId : undefined}
        aria-label={label ? undefined : title}
        className={`squircle flex min-h-tap w-full items-center justify-between gap-2 bg-controlFill px-4 text-left text-text-primary disabled:opacity-40 ${transition.press}`}
      >
        <span
          className={`truncate text-body ${selected ? "text-text-primary" : "text-text-tertiary"}`}
        >
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-text-tertiary" strokeWidth={2.5} />
      </button>

      {/* Standalone use remains supported. All live call sites are inside a
          ModalSheet and therefore take the contextual-push path above. */}
      {!navigation && (
        <ModalSheet
          open={fallbackOpen}
          onClose={() => setFallbackOpen(false)}
          title={title}
          size="form"
        >
          <PickerOptions options={options} value={value} onSelect={commit} />
        </ModalSheet>
      )}
    </div>
  );
}
