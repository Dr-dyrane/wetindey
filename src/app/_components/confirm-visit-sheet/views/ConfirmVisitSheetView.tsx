import {
  React,
  IconOrb,
  ModalSheet,
  Button,
  Input,
  SolidIcon,
  formatNaira,
} from "../imports/imports";
import { type VisitContext, type useConfirmVisitSheet } from "../hooks/useConfirmVisitSheet";
import "../styles/ConfirmVisitSheet.css";

function Banner({
  kind,
  icon,
  children,
}: {
  kind: "confirmed" | "caution" | "unavailable";
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  const map = {
    confirmed: "bg-status-confirmed-bg text-status-confirmed-fg",
    caution: "bg-status-caution-bg text-status-caution-fg",
    unavailable: "bg-status-unavailable-bg text-status-unavailable-fg",
  } as const;
  return (
    <div
      role="status"
      className={`flex items-center gap-2.5 squircle px-4 py-3 text-footnote font-medium ${map[kind]}
                  animate-in fade-in slide-in-from-top-1 duration-standard`}
    >
      <span className="shrink-0">{icon}</span>
      <span>{children}</span>
    </div>
  );
}

function Choice<T extends string>({
  legend,
  options,
  value,
  onSelect,
  disabled,
}: {
  legend: string;
  options: { id: T; label: string; kind: "confirmed" | "unavailable" }[];
  value: T | null;
  onSelect: (v: T) => void;
  disabled?: boolean;
}) {
  return (
    <fieldset disabled={disabled} className="space-y-2 disabled:opacity-50">
      <legend className="mb-2 text-subhead text-text-secondary">{legend}</legend>
      <div className="grid grid-cols-2 gap-1 squircle bg-fillTertiary p-1">
        {options.map((o) => {
          const active = value === o.id;
          return (
            <button
              key={o.id}
              type="button"
              aria-pressed={active}
              onClick={() => onSelect(o.id)}
              className={`flex min-h-tap items-center justify-center gap-2 squircle px-2 text-subhead font-medium
                          transition duration-micro active:scale-[0.97]
                          ${active ? "bg-surface shadow-card text-text-primary" : "text-text-secondary"}`}
            >
              <span
                className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                  o.kind === "confirmed" ? "bg-status-confirmed" : "bg-status-unavailable"
                } ${active ? "" : "opacity-40"}`}
              />
              <span className="truncate">{o.label}</span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

export interface ConfirmVisitSheetViewProps {
  open: boolean;
  visit: VisitContext | null;
  onClose: () => void;
  sheet: ReturnType<typeof useConfirmVisitSheet>;
}

export function ConfirmVisitSheetView({
  open,
  visit,
  onClose,
  sheet,
}: ConfirmVisitSheetViewProps) {
  if (!visit) return null;

  const {
    t,
    translate,
    wasThere,
    setWasThere,
    priceRight,
    setPriceRight,
    didBuy,
    setDidBuy,
    realPrice,
    setRealPrice,
    needsPrice,
  } = sheet;

  const quoted =
    visit.quotedPriceMax && visit.quotedPriceMax > visit.quotedPriceMin
      ? `${formatNaira(visit.quotedPriceMin)}–${formatNaira(visit.quotedPriceMax)}`
      : formatNaira(visit.quotedPriceMin);

  return (
    <ModalSheet open={open} onClose={onClose} title={t.title} size="form">
      <div className="space-y-5 px-4 py-4">
        <Banner
          kind="caution"
          icon={
            <IconOrb size={32} tone="status-caution">
              <SolidIcon name="warning" size={18} />
            </IconOrb>
          }
        >
          <span>
            <span className="block font-semibold">{translate("contribution.paused_title")}</span>
            <span className="mt-0.5 block font-normal">{translate("contribution.paused_body")}</span>
          </span>
        </Banner>

        <div className="squircle-card bg-surface dark:bg-surface-elevated px-4 py-3">
          <p className="text-body font-semibold text-text-primary">
            {visit.itemName}
            <span className="font-normal text-text-secondary"> · {visit.variantName}</span>
          </p>
          <p className="mt-0.5 text-footnote text-text-secondary">
            {t.at(visit.placeName)} · {quoted} / {visit.unitName}
          </p>
        </div>

        <Choice
          legend={t.qThere}
          value={wasThere}
          onSelect={setWasThere}
          disabled
          options={[
            { id: "yes", label: t.thereYes, kind: "confirmed" },
            { id: "no", label: t.thereNo, kind: "unavailable" },
          ]}
        />

        {wasThere === "yes" && (
          <div className="space-y-5 animate-in fade-in slide-in-from-bottom-1 duration-standard">
            <Choice
              legend={t.qPrice(quoted)}
              value={priceRight}
              onSelect={setPriceRight}
              disabled
              options={[
                { id: "yes", label: t.priceYes, kind: "confirmed" },
                { id: "no", label: t.priceNo, kind: "unavailable" },
              ]}
            />

            {needsPrice && (
              <div className="space-y-1.5 animate-in fade-in duration-standard">
                <label htmlFor="visit-real-price" className="block text-footnote text-text-secondary">
                  {t.priceLabel}
                </label>
                <Input
                  id="visit-real-price"
                  data-autofocus
                  type="number"
                  inputMode="decimal"
                  min={0}
                  value={realPrice}
                  onChange={(e) => setRealPrice(e.target.value)}
                  placeholder={t.pricePlaceholder}
                  disabled
                />
              </div>
            )}

            <Choice
              legend={t.qBuy}
              value={didBuy}
              onSelect={setDidBuy}
              disabled
              options={[
                { id: "yes", label: t.buyYes, kind: "confirmed" },
                { id: "no", label: t.buyNo, kind: "unavailable" },
              ]}
            />
          </div>
        )}

        {needsPrice && (
          <Button
            type="button"
            variant="primary"
            size="md"
            className="w-full"
            disabled
          >
            {translate("contribution.paused_action")}
          </Button>
        )}
      </div>
    </ModalSheet>
  );
}
