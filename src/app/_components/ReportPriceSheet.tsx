"use client";

import React from "react";
import { IconOrb } from "@/design-system/components/IconOrb";
import { ModalSheet } from "@/design-system/components/ModalSheet";
import { SheetPicker } from "@/design-system/components/SheetPicker";
import { Button } from "@/design-system/components/Button";
import { Input } from "@/design-system/components/Input";
import { SolidIcon } from "@/design-system/icons/SolidIcon";

interface Option {
  id: string;
  name: string;
}

interface ReportPriceSheetProps {
  open: boolean;
  onClose: () => void;
  t: Record<string, string>;

  places: Option[];
  items: Option[];
  variants: { id: string; itemId: string; displayName: string }[];
  units: { id: string; displayName: string }[];

  placeId: string;
  itemId: string;
  variantId: string;
  unitId: string;
  price: string;
  available: "available" | "unavailable";

  onPlaceId: (v: string) => void;
  onItemId: (v: string) => void;
  onVariantId: (v: string) => void;
  onUnitId: (v: string) => void;
  onPrice: (v: string) => void;
  onAvailable: (v: "available" | "unavailable") => void;

}

/** Inline result banner. Uses the status ramp so meaning is carried by colour + icon + text. */
function Banner({ kind, icon, children }: { kind: "confirmed" | "caution" | "unavailable"; icon: React.ReactNode; children: React.ReactNode }) {
  const map = {
    confirmed: "bg-status-confirmed-bg text-status-confirmed-fg",
    caution: "bg-status-caution-bg text-status-caution-fg",
    unavailable: "bg-status-unavailable-bg text-status-unavailable-fg",
  } as const;
  return (
    <div role="status" className={`mx-4 flex items-center gap-2.5 squircle-card px-4 py-3 text-[13px] font-medium ${map[kind]} animate-in fade-in slide-in-from-top-1 duration-standard`}>
      <span className="shrink-0">{icon}</span>
      <span>{children}</span>
    </div>
  );
}

export function ReportPriceSheet(p: ReportPriceSheetProps) {
  const variantsForItem = p.variants.filter((v) => v.itemId === p.itemId);
  return (
    <ModalSheet open={p.open} onClose={p.onClose} title={p.t.report_price} size="page">
      <form onSubmit={(event) => event.preventDefault()} className="space-y-5 py-4">
        <Banner
          kind="caution"
          icon={
            <IconOrb size={32} tone="status-caution">
              <SolidIcon name="warning" size={18} />
            </IconOrb>
          }
        >
          <span>
            <span className="block font-semibold">{p.t["contribution.paused_title"]}</span>
            <span className="mt-0.5 block font-normal">{p.t["contribution.paused_body"]}</span>
          </span>
        </Banner>

        {/* Pull-down menus rather than horizontal pill rails. With 15 markets and
            11 items, a rail hid most options off-screen behind a swipe and gave
            no indication of how many there were. */}
        <div className="mx-4 space-y-4">
          <SheetPicker
            title={p.t.market}
            label={p.t.market}
            options={p.places.map((x) => ({ id: x.id, label: x.name }))}
            value={p.placeId}
            onSelect={p.onPlaceId}
            placeholder="Choose market"
            disabled
          />

          <SheetPicker
            title={p.t.item}
            label={p.t.item}
            options={p.items.map((x) => ({ id: x.id, label: x.name }))}
            value={p.itemId}
            onSelect={p.onItemId}
            placeholder="Choose item"
            disabled
          />

          <SheetPicker
            title={p.t.variant}
            label={p.t.variant}
            options={variantsForItem.map((v) => ({ id: v.id, label: v.displayName }))}
            value={p.variantId}
            onSelect={p.onVariantId}
            placeholder={variantsForItem.length ? "Choose quality" : "Pick an item first"}
            disabled
          />

          <SheetPicker
            title={p.t.unit}
            label={p.t.unit}
            options={p.units.map((u) => ({ id: u.id, label: u.displayName }))}
            value={p.unitId}
            onSelect={p.onUnitId}
            placeholder="Choose unit"
            disabled
          />

          <div className="space-y-1.5">
            <label htmlFor="price" className="block text-footnote text-text-secondary">
              {p.t.price_paid}
            </label>
            <Input
              id="price"
              type="number"
              inputMode="decimal"
              value={p.price}
              onChange={(e) => p.onPrice(e.target.value)}
              placeholder="₦ e.g. 3500"
              className="px-4"
              disabled
            />
          </div>

          <div className="space-y-1.5">
            <span className="block text-footnote text-text-secondary">
              {p.t.availability}
            </span>
            <div className="grid grid-cols-2 gap-1 squircle bg-fillTertiary p-1">
              {([
                { id: "available", label: p.t.available, kind: "confirmed" },
                { id: "unavailable", label: p.t.unavailable, kind: "unavailable" },
              ] as const).map((o) => {
                const active = p.available === o.id;
                return (
                  <button
                    key={o.id}
                    type="button"
                    aria-pressed={active}
                    aria-disabled="true"
                    disabled
                    onClick={() => p.onAvailable(o.id)}
                    className={`flex items-center justify-center gap-1.5 squircle py-2 text-[13px] font-medium transition duration-micro
                      ${active ? "bg-surface shadow-card" : "text-text-secondary"}`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        o.kind === "confirmed" ? "bg-status-confirmed" : "bg-status-unavailable"
                      } ${active ? "" : "opacity-40"}`}
                    />
                    <span className={active ? "text-text-primary" : ""}>{o.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <Button type="submit" variant="primary" size="md" className="w-full" disabled>
            {p.t["contribution.paused_action"]}
          </Button>
        </div>
      </form>
    </ModalSheet>
  );
}
