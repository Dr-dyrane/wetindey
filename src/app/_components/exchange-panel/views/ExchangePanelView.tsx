import React from "react";
import {
  IconOrb,
  Skeleton,
  SolidIcon,
  transition,
  REFERENCE_CURRENCY_META,
  CurrencyFlag,
  CurrencyPickerSheet,
  formatDistance,
  getHaversineDistance,
} from "../imports/imports";
import {
  RATE_FORMATTER,
  providerLabel,
  formatEffectiveDate,
  type ExchangePanelProps,
  type useExchangePanel,
} from "../hooks/useExchangePanel";
import "../styles/ExchangePanel.css";

export interface ExchangePanelViewProps extends ExchangePanelProps {
  panel: ReturnType<typeof useExchangePanel>;
}

export function ExchangePanelView({
  origin,
  locations,
  filter,
  onFilterChange,
  selectedLocationId,
  onSelectLocation,
  panel,
}: ExchangePanelViewProps) {
  const {
    amountId,
    foreignErrorId,
    ngnAmountId,
    ngnErrorId,
    currency,
    amounts,
    catalogState,
    rateState,
    setCatalogRetry,
    setRateRetry,
    offline,
    enterCurrency,
    editAmount,
    foreignError,
    ngnError,
    usingSavedRate,
    availableCurrencies,
    selectedMeta,
    selectedLocation,
    visibleRate,
  } = panel;

  const retryCatalog = () => setCatalogRetry((value) => value + 1);
  const retryRate = () => setRateRetry((value) => value + 1);
  const conversionAnnouncement =
    visibleRate && currency
      ? amounts.lastEdited === "foreign" && amounts.ngn
        ? `Estimated ${amounts.ngn} Nigerian naira`
        : amounts.lastEdited === "ngn" && amounts.foreign
          ? `Estimated ${amounts.foreign} ${REFERENCE_CURRENCY_META[currency].name}`
          : ""
      : "";

  return (
    <div className="space-y-5 px-3 pb-[calc(max(var(--sheet-hidden,0px),var(--safe-area-bottom))+20px)]">
      <section className="space-y-3" aria-labelledby="exchange-reference-heading">
        <div className="px-1">
          <p className="text-caption-1 font-semibold uppercase tracking-[0.08em] text-text-tertiary">
            Aboki FX
          </p>
          <h2
            id="exchange-reference-heading"
            className="mt-0.5 text-title-2 font-semibold text-text-primary"
          >
            What is it worth?
          </h2>
        </div>

        <div className="exchange-conversion-canvas squircle-card bg-surface-card px-3 py-2">
          <div className="exchange-amount-row">
            <label htmlFor={amountId} className="sr-only">
              Foreign amount
            </label>
            <input
              id={amountId}
              value={amounts.foreign}
              onChange={(event) => editAmount("foreign", event.target.value)}
              inputMode="decimal"
              autoComplete="off"
              placeholder="100"
              aria-invalid={foreignError ? true : undefined}
              aria-describedby={
                foreignError ? `${foreignErrorId} exchange-reference-note` : "exchange-reference-note"
              }
              data-autofocus
              className="exchange-amount-input"
            />
            {catalogState.kind === "loading" && !currency ? (
              <Skeleton className="h-9 w-24 rounded-[14px]" />
            ) : (
              <CurrencyPickerSheet
                available={availableCurrencies}
                value={currency}
                onSelect={enterCurrency}
                disabled={catalogState.kind !== "ready"}
              />
            )}
          </div>

          <div className="exchange-relationship" aria-hidden="true">
            <span />
            <SolidIcon name="chevron-down" size={14} />
            <span />
          </div>

          <div className="exchange-amount-row">
            <label htmlFor={ngnAmountId} className="sr-only">
              Naira amount
            </label>
            <input
              id={ngnAmountId}
              value={amounts.ngn}
              onChange={(event) => editAmount("ngn", event.target.value)}
              inputMode="decimal"
              autoComplete="off"
              placeholder="100000"
              aria-invalid={ngnError ? true : undefined}
              aria-describedby={
                ngnError ? `${ngnErrorId} exchange-reference-note` : "exchange-reference-note"
              }
              className="exchange-amount-input"
            />
            <span className="exchange-currency-chip">
              <CurrencyFlag code="NGN" />
              NGN
            </span>
          </div>
        </div>

        {foreignError && (
          <p id={foreignErrorId} role="alert" className="px-1 text-footnote text-status-danger-fg">
            {foreignError}
          </p>
        )}
        {ngnError && (
          <p id={ngnErrorId} role="alert" className="px-1 text-footnote text-status-danger-fg">
            {ngnError}
          </p>
        )}
        <p className="sr-only" aria-live="polite" aria-atomic="true">
          {conversionAnnouncement}
        </p>

        <div className="exchange-actions">
          <details className="exchange-rate-disclosure">
            <summary className={transition.press}>
              <span>View exchange rate</span>
              <SolidIcon name="chevron-down" size={16} />
            </summary>
            <div className="exchange-rate-detail" aria-live="polite" aria-atomic="true">
              {catalogState.kind === "loading" && !visibleRate ? (
                <Skeleton className="h-5 w-3/4" />
              ) : catalogState.kind === "empty" ? (
                <RateFailure message="No Naira pairs" onRetry={retryCatalog} />
              ) : catalogState.kind === "error" && !visibleRate ? (
                <RateFailure
                  message={offline ? "Currencies unavailable offline" : "Couldn’t load currencies"}
                  onRetry={retryCatalog}
                />
              ) : rateState.kind === "loading" && !rateState.cached ? (
                <Skeleton className="h-5 w-3/4" />
              ) : rateState.kind === "unavailable" ? (
                <p role="status">Pair unavailable. Choose another currency.</p>
              ) : rateState.kind === "error" ? (
                <RateFailure
                  message={offline ? "Rate unavailable offline" : "Couldn’t load rate"}
                  onRetry={retryRate}
                />
              ) : visibleRate && selectedMeta ? (
                <>
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold text-text-primary">{providerLabel(visibleRate)}</p>
                    {usingSavedRate && (
                      <span className="text-caption-1 font-semibold text-status-caution-fg">
                        {offline ? "Saved · Offline" : "Saved"}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 tabular-nums">
                    {selectedMeta.symbol}1 = ₦{RATE_FORMATTER.format(visibleRate.rate)} ·{" "}
                    {formatEffectiveDate(visibleRate.effectiveDate)}
                  </p>
                </>
              ) : null}
            </div>
          </details>

          <a
            href="#nearby-exchange-locations"
            onClick={() => onFilterChange("bdc")}
            className={`exchange-nearby-action ${transition.press}`}
          >
            <SolidIcon name="map-pin" size={16} />
            Nearby BDCs
          </a>
        </div>

        <p id="exchange-reference-note" className="px-1 text-caption-1 text-text-tertiary">
          Reference only
        </p>
      </section>

      <section
        id="nearby-exchange-locations"
        className="scroll-mt-4 space-y-2.5"
        aria-labelledby="sample-nearby-heading"
      >
        <div className="px-1">
          <div className="flex items-center justify-between gap-3">
            <h2 id="sample-nearby-heading" className="text-title-3 font-semibold text-text-primary">
              Nearby locations
            </h2>
            <span className="shrink-0 text-caption-1 font-semibold text-text-tertiary">Sample</span>
          </div>
          <p className="mt-0.5 text-caption-1 leading-snug text-text-tertiary">
            Synthetic places · not verified.
          </p>
        </div>

        <div
          className="squircle grid grid-cols-3 gap-1 bg-fillTertiary p-1"
          aria-label="Filter Sample locations"
        >
          {(
            [
              ["all", "All"],
              ["bank", "Banks"],
              ["bdc", "BDCs"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={filter === value}
              onClick={() => onFilterChange(value)}
              className={`squircle min-h-tap px-2 text-footnote font-semibold transition-colors duration-instant active:opacity-60 ${
                filter === value
                  ? "bg-surface-card text-text-primary shadow-card"
                  : "text-text-secondary"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {selectedLocation && (
          <div
            role="status"
            className="squircle flex min-h-tap items-center gap-2.5 bg-fillTertiary px-3 py-2"
          >
            <IconOrb tone="context-location">
              <SolidIcon name="map-pin" size={16} />
            </IconOrb>
            <p className="truncate text-footnote font-semibold text-text-secondary">
              {selectedLocation.name} selected
            </p>
          </div>
        )}

        <div className="space-y-2">
          {locations.map((location) => {
            const selected = location.id === selectedLocationId;
            const distance = formatDistance(
              getHaversineDistance(origin.lat, origin.lng, location.lat, location.lng)
            );
            return (
              <button
                key={location.id}
                type="button"
                aria-pressed={selected}
                onClick={() => onSelectLocation(location)}
                className={`squircle-card grid min-h-[64px] w-full grid-cols-[2.25rem_minmax(0,1fr)_auto] items-center gap-3 p-3 text-left transition-colors duration-instant active:opacity-60 ${
                  selected ? "bg-fillSecondary" : "bg-surface-card"
                }`}
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center">
                  <IconOrb size={32} tone="domain-money">
                    <SolidIcon name={location.kind === "bank" ? "building" : "money"} size={18} />
                  </IconOrb>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-body font-semibold text-text-primary">
                    {location.name}
                  </span>
                  <span className="mt-0.5 block truncate text-footnote text-text-secondary">
                    {location.description}
                  </span>
                </span>
                <span className="shrink-0 whitespace-nowrap text-caption-1 tabular-nums text-text-tertiary">
                  {distance}
                </span>
              </button>
            );
          })}
        </div>

        {locations.length === 0 && (
          <div className="squircle-card bg-fillTertiary px-4 py-6 text-center">
            <p className="text-body font-semibold text-text-primary">No matching places</p>
            <p className="mt-1 text-footnote text-text-secondary">Change filter.</p>
          </div>
        )}
      </section>
    </div>
  );
}

function RateFailure({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <p role="alert">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="min-h-tap shrink-0 px-2 font-semibold text-text-primary"
      >
        Retry
      </button>
    </div>
  );
}
