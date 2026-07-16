"use client";

import React from "react";
import { Sun, Moon } from "lucide-react";
import { ModalSheet } from "@/design-system/components/ModalSheet";

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

/** iOS inset-grouped list section. */
function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="px-4 text-[13px] font-normal uppercase tracking-wide text-text-secondary">{title}</h3>
      <div className="mx-4 squircle bg-surface shadow-card overflow-hidden">
        {children}
      </div>
    </section>
  );
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
  return (
    <div role="tablist" className="m-3 grid gap-1 squircle bg-fillTertiary p-1" style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }}>
      {options.map((o) => {
        const active = o.id === value;
        return (
          <button
            key={o.id}
            role="tab"
            aria-selected={active}
            type="button"
            onClick={() => onChange(o.id)}
            className={`flex items-center justify-center gap-1.5 squircle py-1.5 text-[13px] font-medium transition-all duration-micro
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
        <Group title={t.language}>
          <Segmented<LangType>
            value={lang}
            onChange={onLangChange}
            options={[
              { id: "en", label: "English" },
              { id: "pidgin", label: "Pidgin" },
              { id: "yoruba", label: "Yorùbá" },
            ]}
          />
        </Group>

        <Group title={t.theme}>
          <Segmented
            value={theme === "dark" ? "dark" : "light"}
            onChange={(v) => {
              if (v !== theme) onToggleTheme();
            }}
            options={[
              { id: "light", label: (<><Sun className="h-3.5 w-3.5" /> {t.light_mode}</>) },
              { id: "dark", label: (<><Moon className="h-3.5 w-3.5" /> {t.dark_mode}</>) },
            ]}
          />
        </Group>

        <Group title={t.radius}>
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
        </Group>
      </div>
    </ModalSheet>
  );
}
