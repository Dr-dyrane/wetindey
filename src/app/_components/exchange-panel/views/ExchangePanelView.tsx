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
  type ReferenceRatePoint,
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
    rateTrendState,
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
    visibleRate,
    viewMode,
    setViewMode,
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
  const bdcLocations = locations.filter((location) => location.kind === "bdc");
  const nearestLocationDistance =
    bdcLocations.length > 0
      ? formatDistance(
          Math.min(
            ...bdcLocations.map((location) =>
              getHaversineDistance(origin.lat, origin.lng, location.lat, location.lng)
            )
          )
        )
      : null;

  return (
    <div className="space-y-4 px-3 pb-[calc(max(var(--sheet-hidden,0px),var(--safe-area-bottom))+20px)]">
      <div className="flex min-h-tap items-center justify-between px-1">
        <p className="text-caption-1 font-semibold uppercase tracking-[0.08em] text-text-tertiary">
          Aboki FX
        </p>
        <button
          type="button"
          onClick={() => setViewMode(viewMode === "rate" ? "nearby" : "rate")}
          className={`exchange-view-link ${transition.press}`}
        >
          {viewMode === "rate" ? "Nearby" : "Rate"}
        </button>
      </div>

      {viewMode === "rate" ? (
        <section className="space-y-3" aria-labelledby="exchange-reference-heading">
          <div className="px-1">
            <h2 id="exchange-reference-heading" className="text-title-3 font-semibold text-text-secondary">
              Naira reference
            </h2>
            {visibleRate && selectedMeta ? (
              <>
                <p className="mt-1 text-large-title font-semibold tabular-nums text-text-primary">
                  {selectedMeta.symbol}1 <span className="text-text-tertiary">=</span> ₦{RATE_FORMATTER.format(visibleRate.rate)}
                </p>
                {rateTrendState.kind === "ready" && <RateTrend points={rateTrendState.points} />}
                <p className="mt-1 text-caption-1 text-text-tertiary">
                  {providerLabel(visibleRate)} · {formatEffectiveDate(visibleRate.effectiveDate)}
                  {usingSavedRate ? offline ? " · saved offline" : " · saved" : ""}
                </p>
              </>
            ) : catalogState.kind === "loading" || rateState.kind === "loading" ? (
              <div className="mt-2 space-y-2" aria-label="Loading reference rate">
                <Skeleton className="h-9 w-3/4" />
                <Skeleton className="h-3 w-40" />
              </div>
            ) : catalogState.kind === "empty" ? (
              <RateFailure message="No Naira pairs" onRetry={retryCatalog} />
            ) : rateState.kind === "unavailable" ? (
              <p className="mt-2 text-body text-text-secondary">Pair unavailable.</p>
            ) : (
              <RateFailure
                message={offline ? "Rate unavailable offline" : "Couldn’t load rate"}
                onRetry={catalogState.kind === "error" ? retryCatalog : retryRate}
              />
            )}
          </div>

          <div className="exchange-conversion-canvas squircle bg-controlFill px-2">
            <div className="exchange-amount-row">
              <label htmlFor={amountId} className="sr-only">Foreign amount</label>
              <input
                id={amountId}
                value={amounts.foreign}
                onChange={(event) => editAmount("foreign", event.target.value)}
                inputMode="decimal"
                autoComplete="off"
                placeholder="100"
                aria-invalid={foreignError ? true : undefined}
                aria-describedby={foreignError ? `${foreignErrorId} exchange-reference-note` : "exchange-reference-note"}
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
              <SolidIcon name="chevron-down" size={16} />
            </div>
            <div className="exchange-amount-row">
              <label htmlFor={ngnAmountId} className="sr-only">Naira amount</label>
              <input
                id={ngnAmountId}
                value={amounts.ngn}
                onChange={(event) => editAmount("ngn", event.target.value)}
                inputMode="decimal"
                autoComplete="off"
                placeholder="100000"
                aria-invalid={ngnError ? true : undefined}
                aria-describedby={ngnError ? `${ngnErrorId} exchange-reference-note` : "exchange-reference-note"}
                className="exchange-amount-input"
              />
              <span className="exchange-currency-chip"><CurrencyFlag code="NGN" />NGN</span>
            </div>
          </div>

          {foreignError && <p id={foreignErrorId} role="alert" className="px-1 text-footnote text-status-danger-fg">{foreignError}</p>}
          {ngnError && <p id={ngnErrorId} role="alert" className="px-1 text-footnote text-status-danger-fg">{ngnError}</p>}
          <p className="sr-only" aria-live="polite" aria-atomic="true">{conversionAnnouncement}</p>
          <p id="exchange-reference-note" className="px-1 text-caption-1 text-text-tertiary">Reference only</p>
        </section>
      ) : (
        <section className="space-y-3" aria-labelledby="sample-nearby-heading">
          <div className="px-1">
            <h2 id="sample-nearby-heading" className="text-title-2 font-semibold text-text-primary">Nearby exchange</h2>
            <p className="mt-1 text-title-3 font-semibold text-text-primary">Not confirmed</p>
            <p className="mt-0.5 text-footnote text-text-secondary">
              {nearestLocationDistance
                ? `${bdcLocations.length} sample BDC${bdcLocations.length === 1 ? "" : "s"} · nearest ${nearestLocationDistance}`
                : "No nearby BDC sample"}
            </p>
          </div>

          <div className="space-y-1">
            {bdcLocations.slice(0, 3).map((location) => {
              const selected = location.id === selectedLocationId;
              const distance = formatDistance(getHaversineDistance(origin.lat, origin.lng, location.lat, location.lng));
              return (
                <button
                  key={location.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => onSelectLocation(location)}
                  className={`exchange-location-row ${selected ? "bg-fillSecondary" : ""} ${transition.press}`}
                >
                  <IconOrb size={32} tone="domain-money"><SolidIcon name="money" size={18} /></IconOrb>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-body font-semibold text-text-primary">{location.name}</span>
                    <span className="block truncate text-footnote text-text-secondary">{location.description}</span>
                  </span>
                  <span className="shrink-0 text-caption-1 tabular-nums text-text-tertiary">{distance}</span>
                </button>
              );
            })}
          </div>
          {bdcLocations.length === 0 && <p className="px-1 py-4 text-body text-text-secondary">No BDC samples nearby.</p>}
        </section>
      )}
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

function RateTrend({ points }: { points: ReferenceRatePoint[] }) {
  const values = points.map((point) => point.rate);
  const first = values[0]!;
  const last = values[values.length - 1]!;
  const low = Math.min(...values);
  const high = Math.max(...values);
  const spread = high - low || 1;
  const width = 240;
  const height = 44;
  const path = values
    .map((value, index) => {
      const x = (index / Math.max(values.length - 1, 1)) * width;
      const y = height - 4 - ((value - low) / spread) * (height - 8);
      return `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const change = ((last - first) / first) * 100;
  const direction = Math.abs(change) < 0.05 ? "Stable" : change > 0 ? "Up" : "Down";

  return (
    <div className="exchange-trend" role="img" aria-label={`${direction} ${Math.abs(change).toFixed(1)} percent over seven observations`}>
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true">
        <path d={path} />
      </svg>
      <p>
        {direction}
        {direction === "Stable" ? "" : ` ${Math.abs(change).toFixed(1)}%`}
        <span> · 7 observations</span>
      </p>
    </div>
  );
}
