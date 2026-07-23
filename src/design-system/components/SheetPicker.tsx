"use client";

import React, { useRef, useState } from "react";
import { useT } from "@/core/i18n";
import { SolidIcon } from "@/design-system/icons/SolidIcon";
import { IconOrb } from "./IconOrb";
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
  // Zero-wiring module store (see @/core/i18n): no provider, no prop threading.
  const t = useT();
  return (
    <div className="px-4 py-2">
      <div className="squircle-card overflow-hidden bg-surface-card">
        {options.length === 0 && (
          <p className="px-4 py-3 text-body text-text-tertiary">{t("picker.empty")}</p>
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
                <IconOrb tone="neutral">
                  <SolidIcon name="check" size={16} />
                </IconOrb>
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
  placeholder,
  disabled,
}: SheetPickerProps) {
  const t = useT();
  // Not a default parameter: the fallback needs the hook above. Every live call
  // site passes its own translated placeholder; this covers the one that forgets.
  const resolvedPlaceholder = placeholder ?? t("picker.placeholder");
  const navigation = useModalSheetNavigation();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [fallbackOpen, setFallbackOpen] = useState(false);
  const [childId, setChildId] = useState<string | null>(null);
  const selected = options.find((option) => option.id === value) ?? null;
  const labelId = React.useId();
  const valueId = React.useId();
  const triggerId = React.useId();
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
        <label
          id={labelId}
          htmlFor={triggerId}
          className="mb-1.5 block text-footnote text-text-secondary"
        >
          {label}
        </label>
      )}

      {/* The accessible name must carry the CURRENT VALUE, not just the label:
          `aria-labelledby` replaces content, so label-only meant a screen
          reader heard "Market, button" and never what was chosen. Composing
          label id + value span id reads "Market, Mile 12 Market". */}
      <button
        ref={triggerRef}
        id={triggerId}
        type="button"
        disabled={disabled}
        onClick={openPicker}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-labelledby={label ? `${labelId} ${valueId}` : valueId}
        className={`squircle flex min-h-tap w-full items-center justify-between gap-2 bg-controlFill px-4 text-left text-text-primary disabled:opacity-40 ${transition.press}`}
      >
        <span
          id={valueId}
          className={`truncate text-body ${selected ? "text-text-primary" : "text-text-tertiary"}`}
        >
          {selected?.label ?? resolvedPlaceholder}
        </span>
        <span className="shrink-0 text-text-tertiary">
          <SolidIcon name="chevron-down" size={16} />
        </span>
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
