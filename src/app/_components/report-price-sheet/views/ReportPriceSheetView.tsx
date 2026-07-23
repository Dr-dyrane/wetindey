import "../styles/ReportPriceSheet.css";
import {
  React,
  IconOrb,
  ModalSheet,
  SheetPicker,
  Button,
  Input,
  SolidIcon,
  EvidenceMediaField,
} from "../imports/imports";
import type { useReportPriceSheet } from "../hooks/useReportPriceSheet";

interface Option {
  id: string;
  name: string;
}

export interface ReportPriceSheetProps {
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

export interface ReportPriceSheetViewProps extends ReportPriceSheetProps {
  sheet: ReturnType<typeof useReportPriceSheet>;
}

function Banner({ kind, icon, children }: { kind: "confirmed" | "caution" | "neutral"; icon: React.ReactNode; children: React.ReactNode }) {
  const map = {
    confirmed: "bg-status-confirmed-bg text-status-confirmed-fg",
    caution: "bg-status-caution-bg text-status-caution-fg",
    neutral: "bg-fillSecondary text-text-primary",
  } as const;
  return (
    <div role="status" aria-live="polite" className={`flex items-center gap-2.5 squircle-card px-4 py-3 text-[13px] font-medium ${map[kind]} animate-in fade-in slide-in-from-top-1 duration-standard`}>
      <span className="shrink-0">{icon}</span>
      <span>{children}</span>
    </div>
  );
}

function errorCopy(
  state: Extract<ReturnType<typeof useReportPriceSheet>["submission"], { phase: "error" }>,
  t: Record<string, string>
): string {
  switch (state.code) {
    case "client_required":
      return t["contribution.required"];
    case "client_price":
      return t["contribution.price_required"];
    case "maintenance":
      return t["contribution.maintenance"];
    case "invalid_input":
      return t["contribution.invalid_input"];
    case "reporting_disabled":
      return t["contribution.reporting_disabled"];
    case "rate_limited":
      return t["contribution.rate_limited"].replace(
        "{duration}",
        `${Math.max(1, Math.ceil((state.retryAfterSeconds ?? 60) / 60))} min`
      );
    case "idempotency_conflict":
      return t["contribution.idempotency_conflict"];
    case "transport":
      return t["contribution.transport"];
  }
}

export function ReportPriceSheetView(p: ReportPriceSheetViewProps) {
  const { variantsForItem, submission } = p.sheet;
  const locked = submission.phase === "submitting" || submission.phase === "success";
  const status =
    submission.phase === "success"
      ? {
          kind: "confirmed" as const,
          title: p.t["contribution.received_title"],
          body: p.t[
            submission.replayed
              ? "contribution.replayed_body"
              : "contribution.received_body"
          ],
          icon: "check" as const,
        }
      : submission.phase === "error"
        ? {
            kind: "caution" as const,
            title: p.t["contribution.try_again_title"],
            body: errorCopy(submission, p.t),
            icon: "warning" as const,
          }
        : null;

  return (
    <ModalSheet open={p.open} onClose={p.onClose} title={p.t.report_price} size="page">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void p.sheet.submit({
            placeId: p.placeId,
            itemId: p.itemId,
            variantId: p.variantId,
            unitId: p.unitId,
            price: p.price,
            available: p.available,
          });
        }}
        className="space-y-4 px-4 py-4"
      >
        {status && (
          <Banner
            kind={status.kind}
            icon={
              <IconOrb size={32} tone={status.kind === "confirmed" ? "status-confirmed" : "status-caution"}>
                <SolidIcon name={status.icon} size={18} />
              </IconOrb>
            }
          >
            <span>
              <span className="block font-semibold">{status.title}</span>
              <span className="mt-0.5 block font-normal">{status.body}</span>
            </span>
          </Banner>
        )}

        {submission.phase !== "success" ? (
          <>
          <SheetPicker
            title={p.t.market}
            label={p.t.market}
            options={p.places.map((x) => ({ id: x.id, label: x.name }))}
            value={p.placeId}
            onSelect={p.onPlaceId}
            placeholder={p.t["report.choose_market"]}
            disabled={locked}
          />

          <SheetPicker
            title={p.t.item}
            label={p.t.item}
            options={p.items.map((x) => ({ id: x.id, label: x.name }))}
            value={p.itemId}
            onSelect={p.onItemId}
            placeholder={p.t["report.choose_item"]}
            disabled={locked}
          />

          <SheetPicker
            title={p.t.variant}
            label={p.t.variant}
            options={variantsForItem.map((v) => ({ id: v.id, label: v.displayName }))}
            value={p.variantId}
            onSelect={p.onVariantId}
            placeholder={variantsForItem.length ? p.t["report.choose_quality"] : p.t["report.pick_item_first"]}
            disabled={locked || !p.itemId || !variantsForItem.length}
          />

          <SheetPicker
            title={p.t.unit}
            label={p.t.unit}
            options={p.units.map((u) => ({ id: u.id, label: u.displayName }))}
            value={p.unitId}
            onSelect={p.onUnitId}
            placeholder={p.t["report.choose_unit"]}
            disabled={locked}
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
              placeholder={p.t["report.price_placeholder"]}
              className="px-4"
              disabled={locked || p.available === "unavailable"}
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
                    disabled={locked}
                    onClick={() => p.onAvailable(o.id)}
                    className={`flex min-h-tap items-center justify-center gap-1.5 squircle py-2 text-[13px] font-medium transition duration-micro
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

          <Button type="submit" variant="primary" size="md" className="w-full" disabled={locked} isLoading={submission.phase === "submitting"}>
            {submission.phase === "submitting" ? p.t["report.submitting"] : p.t.submit}
          </Button>
          </>
        ) : (
          <>
            <EvidenceMediaField observationId={p.sheet.admittedObservationId} />
            <div className="report-price-action-bar">
              <Button type="button" variant="secondary" size="md" onClick={p.sheet.reset}>
                {p.t["contribution.new_report"]}
              </Button>
              <Button type="button" variant="primary" size="md" onClick={p.onClose}>
                {p.t.done}
              </Button>
            </div>
          </>
        )}
      </form>
    </ModalSheet>
  );
}
