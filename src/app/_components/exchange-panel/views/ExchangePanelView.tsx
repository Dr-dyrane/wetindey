import React from "react";
import {
  IconOrb,
  Skeleton,
  SolidIcon,
  transition,
  REFERENCE_CURRENCY_META,
  CurrencyFlag,
  CurrencyPickerSheet,
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
    <div className="space-y-4 px-3 pb-[calc(max(var(--sheet-hidden,0px),var(--safe-area-bottom))+20px)]">
      <section className="space-y-2.5" aria-labelledby="exchange-reference-heading">
        <div className="px-1">
          <h2
            id="exchange-reference-heading"
            className="text-title-2 font-semibold text-text-primary"
          >
            Naira reference
          </h2>
        </div>

        <div className="squircle-card space-y-3 bg-surface-card p-3">
          <div>
            <label
              htmlFor={amountId}
              className="mb-1.5 block text-footnote font-semibold text-text-secondary"
            >
              Amount
            </label>
            <div
              className={`squircle flex min-h-[64px] items-center gap-2 bg-controlFill px-3 ${transition.focus} focus-within:bg-surface-card focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-focusRing`}
            >
              <input
                id={amountId}
                value={amounts.foreign}
                onChange={(event) => editAmount("foreign", event.target.value)}
                inputMode="decimal"
                autoComplete="off"
                placeholder="100"
                aria-invalid={foreignError ? true : undefined}
                aria-describedby={
                  foreignError
                    ? `${foreignErrorId} exchange-reference-note`
                    : "exchange-reference-note"
                }
                data-autofocus
                className="min-w-0 flex-1 bg-transparent text-title-1 font-semibold tabular-nums text-text-primary placeholder:text-text-tertiary"
              />
              {catalogState.kind === "loading" && !currency ? (
                <Skeleton className="h-11 w-24 rounded-[14px]" />
              ) : (
                <CurrencyPickerSheet
                  available={availableCurrencies}
                  value={currency}
                  onSelect={enterCurrency}
                  disabled={catalogState.kind !== "ready"}
                />
              )}
            </div>
            {foreignError && (
              <p
                id={foreignErrorId}
                role="alert"
                className="text-status-danger-fg mt-1.5 px-1 text-footnote"
              >
                {foreignError}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor={ngnAmountId}
              className="mb-1.5 block text-footnote font-semibold text-text-secondary"
            >
              Naira
            </label>
            <div
              className={`squircle flex min-h-[64px] items-center gap-2 bg-controlFill px-3 ${transition.focus} focus-within:bg-surface-card focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-focusRing`}
            >
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
                className="min-w-0 flex-1 bg-transparent text-title-1 font-semibold tabular-nums text-text-primary placeholder:text-text-tertiary"
              />
              <span className="squircle flex h-11 shrink-0 items-center gap-2 bg-surface-card px-3 text-body font-semibold text-text-primary">
                <CurrencyFlag code="NGN" />
                NGN
              </span>
            </div>
            {ngnError && (
              <p
                id={ngnErrorId}
                role="alert"
                className="text-status-danger-fg mt-1.5 px-1 text-footnote"
              >
                {ngnError}
              </p>
            )}
          </div>

          <p className="sr-only" aria-live="polite" aria-atomic="true">
            {conversionAnnouncement}
          </p>

          <div
            className="squircle min-h-[104px] bg-fillTertiary p-3"
            aria-live="polite"
            aria-atomic="true"
          >
            <div className="flex items-center justify-between gap-3">
              <p className="text-footnote font-semibold text-text-secondary">Reference rate</p>
            </div>

            {catalogState.kind === "loading" && !visibleRate ? (
              <div aria-label="Loading available reference currencies" className="mt-3 space-y-3">
                <Skeleton className="h-9 w-3/4" />
                <Skeleton className="h-3 w-44" />
              </div>
            ) : catalogState.kind === "empty" ? (
              <div className="mt-3 space-y-3">
                <div>
                  <p role="status" className="text-body font-semibold text-text-primary">
                    No Naira pairs
                  </p>
                  <p className="mt-1 text-footnote text-text-secondary">
                    Try again.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={retryCatalog}
                  className={`squircle min-h-tap bg-controlFill px-3 text-footnote font-semibold text-text-primary ${transition.press}`}
                >
                  <span className="mr-1.5 inline-flex align-middle">
                    <SolidIcon name="refresh" size={16} />
                  </span>
                  Try again
                </button>
              </div>
            ) : catalogState.kind === "error" && !visibleRate ? (
              <div className="mt-3 space-y-3">
                <div>
                  <p role="alert" className="text-body font-semibold text-text-primary">
                    Couldn’t load currencies
                  </p>
                  <p className="mt-1 text-footnote text-text-secondary">
                    {offline ? "Offline. Try again when connected." : "Try again."}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={retryCatalog}
                  className={`squircle min-h-tap bg-controlFill px-3 text-footnote font-semibold text-text-primary ${transition.press}`}
                >
                  <span className="mr-1.5 inline-flex align-middle">
                    <SolidIcon name="refresh" size={16} />
                  </span>
                  Try again
                </button>
              </div>
            ) : rateState.kind === "loading" && !rateState.cached ? (
              <div aria-label="Loading the reference rate" className="mt-3 space-y-3">
                <Skeleton className="h-9 w-3/4" />
                <Skeleton className="h-3 w-44" />
              </div>
            ) : rateState.kind === "unavailable" ? (
              <div className="mt-3">
                <p role="status" className="text-body font-semibold text-text-primary">
                  Pair unavailable
                </p>
                <p className="mt-1 text-footnote text-text-secondary">
                  Choose another currency.
                </p>
              </div>
            ) : rateState.kind === "error" ? (
              <div className="mt-3 space-y-3">
                <div>
                  <p role="alert" className="text-body font-semibold text-text-primary">
                    Couldn’t load rate
                  </p>
                  <p className="mt-1 text-footnote text-text-secondary">
                    {offline ? "Offline. Try again when connected." : "Try again."}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={retryRate}
                  className={`squircle min-h-tap bg-controlFill px-3 text-footnote font-semibold text-text-primary ${transition.press}`}
                >
                  <span className="mr-1.5 inline-flex align-middle">
                    <SolidIcon name="refresh" size={16} />
                  </span>
                  Try again
                </button>
              </div>
            ) : visibleRate && selectedMeta ? (
              <div className="mt-1">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-body font-semibold text-text-primary">
                    {providerLabel(visibleRate)}
                  </p>
                  {usingSavedRate && (
                    <span className="shrink-0 text-caption-1 font-semibold text-status-caution-fg">
                      {offline ? "Saved · Offline" : "Saved"}
                    </span>
                  )}
                </div>
                <p className="mt-2 text-caption-1 tabular-nums leading-snug text-text-secondary">
                  {selectedMeta.symbol}1 = ₦{RATE_FORMATTER.format(visibleRate.rate)} · Effective{" "}
                  {formatEffectiveDate(visibleRate.effectiveDate)}
                </p>
                {(rateState.kind === "loading" ||
                  (rateState.kind === "ready" && rateState.refreshFailed) ||
                  offline ||
                  catalogState.kind === "loading" ||
                  catalogState.kind === "error") && (
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <p role="status" className="text-caption-1 text-status-caution-fg">
                      {offline
                        ? "Offline · saved rate"
                        : catalogState.kind === "error"
                          ? "Currency list unavailable · saved rate"
                          : catalogState.kind === "loading"
                            ? "Updating currencies · saved rate"
                            : "Updating rate · saved rate"}
                    </p>
                    {!offline && catalogState.kind !== "loading" && (
                      <button
                        type="button"
                        onClick={catalogState.kind === "error" ? retryCatalog : retryRate}
                        className={`min-h-tap shrink-0 px-2 text-footnote font-semibold text-status-caution-fg ${transition.press}`}
                      >
                        Refresh
                      </button>
                    )}
                  </div>
                )}
              </div>
            ) : null}
          </div>

          <p
            id="exchange-reference-note"
            className="text-caption-1 leading-snug text-text-tertiary"
          >
            Reference only — no money exchange.
          </p>
        </div>
      </section>

      <section className="space-y-2.5" aria-labelledby="sample-nearby-heading">
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
            const distance = "0.5 km";
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
