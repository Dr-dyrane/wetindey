"use client";

import React from "react";
import { IconOrb } from "@/design-system/components/IconOrb";
import { ModalSheet } from "@/design-system/components/ModalSheet";
import { ListGroup } from "@/design-system/components/ListRow";
import { SolidIcon } from "@/design-system/icons/SolidIcon";
import { shippableLocales } from "@/core/i18n";
import { haptics } from "@/lib/haptics";

/**
 * A second declaration of `Locale`, kept only because `page.tsx` passes `lang`
 * and `onLangChange` typed against it and `page.tsx` belongs to another lane
 * today. It is structurally identical to `Locale` in `@/core/i18n`, so the two
 * cannot silently disagree — but a fourth copy of a locale list is exactly the
 * drift this change removes from the options array, so it should collapse into
 * `Locale` the moment the same hand holds both files.
 */
export type LangType = "en" | "pidgin" | "yoruba";

interface SettingsSheetProps {
  open: boolean;
  onClose: () => void;
  lang: LangType;
  onLangChange: (l: LangType) => void;
  theme: string;
  onToggleTheme: () => void;
  radiusKm: number;
  onRadiusChange: (km: number) => void;
  t: Record<string, string>;
}

/** Segmented control, matching the platform's own. */
function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { id: T; label: React.ReactNode }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const handleChange = (id: T) => {
    if (id !== value) {
      haptics.selection();
      onChange(id);
    }
  };

  return (
    <div role="group" className="m-3 grid gap-1 squircle bg-fillTertiary p-1" style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }}>
      {options.map((o) => {
        const active = o.id === value;
        return (
          <button
            key={o.id}
            aria-pressed={active}
            type="button"
            onClick={() => handleChange(o.id)}
            className={`flex min-h-tap items-center justify-center gap-1.5 squircle py-1.5 text-[13px] font-medium transition duration-micro
              ${active ? "bg-surface text-text-primary shadow-card" : "text-text-secondary active:opacity-60"}`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function SettingsSheet({
  open,
  onClose,
  lang,
  onLangChange,
  theme,
  onToggleTheme,
  radiusKm,
  onRadiusChange,
  t,
}: SettingsSheetProps) {
  return (
    <ModalSheet open={open} onClose={onClose} title={t.settings} size="form">
      <div className="space-y-6 py-4">
        <ListGroup header={t.language}>
          {/* Options come from the module that owns the gate, never from a list
              here. `setLocale` silently refuses a locale it will not honour, so
              a hardcoded "Yorùbá" renders a button that does nothing — and this
              codebase does not ship dead controls. Yorùbá returns to this picker
              the day a native speaker clears it, with nothing to change here. */}
          <Segmented<LangType>
            value={lang}
            onChange={onLangChange}
            options={[...shippableLocales()]}
          />
        </ListGroup>

        <ListGroup header={t.theme}>
          <Segmented
            value={theme === "dark" ? "dark" : "light"}
            onChange={(v) => {
              if (v !== theme) onToggleTheme();
            }}
            options={[
              {
                id: "light",
                label: (
                  <>
                    <IconOrb tone="neutral">
                      <SolidIcon name="sun" size={16} />
                    </IconOrb>
                    {t.light_mode}
                  </>
                ),
              },
              {
                id: "dark",
                label: (
                  <>
                    <IconOrb tone="neutral">
                      <SolidIcon name="moon" size={16} />
                    </IconOrb>
                    {t.dark_mode}
                  </>
                ),
              },
            ]}
          />
        </ListGroup>

        <ListGroup header={t.radius}>
          <div className="px-4 py-3.5 space-y-2">
            <div className="flex items-baseline justify-between">
              <span className="text-[15px] text-text-primary">Search radius</span>
              <span className="text-[15px] font-semibold text-text-primary tabular-nums">{radiusKm} km</span>
            </div>
            <input
              type="range"
              min="1"
              max="20"
              value={radiusKm}
              aria-label="Search radius in kilometres"
              onChange={(e) => onRadiusChange(parseInt(e.target.value))}
              className="w-full h-1.5 rounded-full appearance-none cursor-pointer bg-fillTertiary accent-status-info"
            />
            <div className="flex justify-between text-[11px] text-text-tertiary tabular-nums">
              <span>1 km</span>
              <span>20 km</span>
            </div>
          </div>
        </ListGroup>
      </div>
    </ModalSheet>
  );
}
