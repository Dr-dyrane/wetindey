import "../styles/SettingsSheet.css";
import {
  React,
  IconOrb,
  ModalSheet,
  ListGroup,
  SolidIcon,
  shippableLocales,
} from "../imports/imports";
import type { LangType, SettingsSheetProps } from "../SettingsSheet";
import type { useSettingsSheet } from "../hooks/useSettingsSheet";

export interface SettingsSheetViewProps extends SettingsSheetProps {
  sheet: ReturnType<typeof useSettingsSheet>;
}

function Segmented<T extends string>({
  options,
  value,
  onChange,
  handleSegmentChange,
}: {
  options: { id: T; label: React.ReactNode }[];
  value: T;
  onChange: (v: T) => void;
  handleSegmentChange: (id: T, value: T, onChange: (v: T) => void) => void;
}) {
  return (
    <div role="group" className="m-3 grid gap-1 squircle bg-fillTertiary p-1" style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }}>
      {options.map((o) => {
        const active = o.id === value;
        return (
          <button
            key={o.id}
            aria-pressed={active}
            type="button"
            onClick={() => handleSegmentChange(o.id, value, onChange)}
            className={`settings-segment-label flex min-h-tap items-center justify-center gap-1.5 squircle py-1.5 font-medium transition duration-micro
              ${active ? "bg-surface text-text-primary shadow-card" : "text-text-secondary active:opacity-60"}`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function SettingsSheetView(p: SettingsSheetViewProps) {
  const { handleSegmentChange } = p.sheet;

  return (
    <ModalSheet open={p.open} onClose={p.onClose} title={p.t.settings} size="form">
      <div className="space-y-6 py-4">
        <ListGroup header={p.t.language}>
          <Segmented<LangType>
            value={p.lang}
            onChange={p.onLangChange}
            options={[...shippableLocales()]}
            handleSegmentChange={handleSegmentChange}
          />
        </ListGroup>

        <ListGroup header={p.t.theme}>
          <Segmented
            value={p.theme === "dark" ? "dark" : "light"}
            onChange={(v) => {
              if (v !== p.theme) p.onToggleTheme();
            }}
            options={[
              {
                id: "light",
                label: (
                  <>
                    <IconOrb tone="neutral">
                      <SolidIcon name="sun" size={16} />
                    </IconOrb>
                    {p.t.light_mode}
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
                    {p.t.dark_mode}
                  </>
                ),
              },
            ]}
            handleSegmentChange={handleSegmentChange}
          />
        </ListGroup>

        <ListGroup header={p.t.radius}>
          <div className="px-4 py-3.5 space-y-2">
            <div className="flex items-baseline justify-between">
              <span className="text-[15px] text-text-primary">{p.t["settings.radius_label"]}</span>
              <span className="text-[15px] font-semibold text-text-primary tabular-nums">{p.radiusKm} km</span>
            </div>
            <input
              type="range"
              min="1"
              max="20"
              value={p.radiusKm}
              aria-label={p.t["settings.radius_a11y"]}
              onChange={(e) => p.onRadiusChange(parseInt(e.target.value))}
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
