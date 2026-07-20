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
    currency,
    amounts,
    rateTrendState,
    selectedMeta,
    visibleRate,
    viewMode,
    setViewMode,
  } = panel;

  const conversionAnnouncement =
    visibleRate && currency
      ? amounts.lastEdited === "foreign" && amounts.ngn
        ? `Estimated ${amounts.ngn} Nigerian naira`
        : amounts.lastEdited === "ngn" && amounts.foreign
          ? `Estimated ${amounts.foreign} ${REFERENCE_CURRENCY_META[currency].name}`
          : ""
      : "";
  const sortedExchangeLocations = [...locations].sort(
    (left, right) =>
      getHaversineDistance(origin.lat, origin.lng, left.lat, left.lng) -
      getHaversineDistance(origin.lat, origin.lng, right.lat, right.lng)
  );
  const nearestLocationDistance =
    sortedExchangeLocations.length > 0
      ? formatDistance(
          getHaversineDistance(
            origin.lat,
            origin.lng,
            sortedExchangeLocations[0]!.lat,
            sortedExchangeLocations[0]!.lng
          )
        )
      : null;
  const trendPoints =
    rateTrendState.kind === "ready"
      ? normalizeTrendPoints(rateTrendState.points)
      : [];

  return (
    <div className="space-y-4 px-3 pb-[calc(max(var(--sheet-hidden,0px),var(--safe-area-bottom))+20px)]">
      <div className="flex min-h-tap items-center justify-between px-1">
        <p className="text-caption-1 font-semibold uppercase tracking-[0.08em] text-text-tertiary">Aboki FX</p>
        <button
          type="button"
          onClick={() => setViewMode(viewMode === "answer" ? "evidence" : "answer")}
          className={`exchange-view-link ${transition.press}`}
        >
          {viewMode === "answer" ? "Trend" : "Back"}
        </button>
      </div>

      {viewMode === "answer" ? (
        <section className="space-y-4" aria-labelledby="exchange-answer-heading">
          <div className="exchange-answer-summary px-1">
            {visibleRate && selectedMeta ? (
              <>
                <p className="text-caption-1 font-semibold uppercase tracking-[0.08em] text-text-tertiary">
                  {providerLabel(visibleRate)} · {selectedMeta.symbol}1
                </p>
                <p className="exchange-answer-rate tabular-nums text-text-primary">
                  ₦{visibleRate.rate.toLocaleString("en-NG", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </p>
                {rateTrendState.kind === "ready" && (
                  <p className="text-footnote font-semibold text-text-secondary">
                    {trendMeaning(rateTrendState.points)}
                  </p>
                )}
              </>
            ) : (
              <>
                <p className="text-caption-1 font-semibold uppercase tracking-[0.08em] text-text-tertiary">
                  Reference rate
                </p>
                <p className="exchange-answer-rate text-text-primary">Checking rate</p>
              </>
            )}
          </div>

          <div className="exchange-decision-row">
            <IconOrb size={32} tone="status-caution">
              <SolidIcon name="warning" size={18} />
            </IconOrb>
            <div className="min-w-0">
              <h2 id="exchange-answer-heading" className="text-body font-semibold text-text-primary">
                Nearby exchange not confirmed
              </h2>
              <p className="text-footnote text-text-secondary">
                {sortedExchangeLocations.length} samples
                {nearestLocationDistance ? ` · nearest ${nearestLocationDistance}` : ""}
              </p>
            </div>
          </div>

          <ConversionRail panel={panel} />

          <button
            type="button"
            onClick={() => setViewMode("nearby")}
            className={`exchange-primary-action ${transition.press}`}
          >
            See nearby exchange points
          </button>
          <p className="sr-only" aria-live="polite" aria-atomic="true">{conversionAnnouncement}</p>
        </section>
      ) : viewMode === "evidence" ? (
        <section className="space-y-3" aria-labelledby="exchange-evidence-heading">
          <div className="px-1">
            <h2 id="exchange-evidence-heading" className="text-title-3 font-semibold text-text-secondary">Recent movement</h2>
            {trendPoints.length >= 2 && visibleRate ? (
              <>
                <p className="mt-1 text-title-1 font-semibold text-text-primary">{trendMeaning(trendPoints)}</p>
                <RateTrend points={trendPoints} />
                <p className="mt-1 text-caption-1 text-text-tertiary">
                  {providerLabel(visibleRate)} · {formatEffectiveDate(visibleRate.effectiveDate)}
                </p>
              </>
            ) : (
              <p className="mt-1 text-body text-text-secondary">Not enough history yet</p>
            )}
          </div>
        </section>
      ) : (
        <section className="space-y-3" aria-labelledby="sample-nearby-heading">
          <div className="px-1">
            <h2 id="sample-nearby-heading" className="text-title-3 font-semibold text-text-secondary">Sample exchange points</h2>
            <p className="mt-1 text-title-1 font-semibold text-text-primary">
              {sortedExchangeLocations[0]?.name ?? "No nearby sample"}
            </p>
            <p className="mt-0.5 text-footnote text-text-secondary">
              {sortedExchangeLocations.length} prototype locations · not verified
              {nearestLocationDistance ? ` · nearest ${nearestLocationDistance}` : ""}
            </p>
          </div>

          <div className="space-y-1">
            {sortedExchangeLocations.map((location) => {
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
          <button type="button" onClick={() => setViewMode("answer")} className={`exchange-primary-action ${transition.press}`}>Back to answer</button>
        </section>
      )}
    </div>
  );
}

function ConversionRail({
  panel,
}: {
  panel: ReturnType<typeof useExchangePanel>;
}) {
  const {
    amountId,
    ngnAmountId,
    foreignErrorId,
    ngnErrorId,
    currency,
    amounts,
    catalogState,
    availableCurrencies,
    enterCurrency,
    editAmount,
    foreignError,
    ngnError,
    conversionReversed,
    toggleConversionDirection,
  } = panel;
  const foreignRow = (
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
  );
  const ngnRow = (
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
  );

  return (
    <>
      <p id="exchange-reference-note" className="sr-only">
        Reference rates are not merchant quotes.
      </p>
      <div className="exchange-conversion-canvas squircle bg-controlFill px-2">
        {conversionReversed ? ngnRow : foreignRow}
        <button
          type="button"
          onClick={toggleConversionDirection}
          className="exchange-relationship"
          aria-label="Swap conversion direction"
        >
          <span aria-hidden="true">⇄</span>
        </button>
        {conversionReversed ? foreignRow : ngnRow}
      </div>
      {foreignError && <p id={foreignErrorId} role="alert" className="px-1 text-footnote text-status-danger-fg">{foreignError}</p>}
      {ngnError && <p id={ngnErrorId} role="alert" className="px-1 text-footnote text-status-danger-fg">{ngnError}</p>}
    </>
  );
}

function trendMeaning(points: ReferenceRatePoint[]): string {
  const ordered = normalizeTrendPoints(points);
  if (ordered.length < 2) return "Not enough history yet";
  const first = ordered[0]!;
  const last = ordered[ordered.length - 1]!;
  const change = ((last.rate - first.rate) / first.rate) * 100;
  const elapsedDays = Math.round(
    (Date.parse(last.date) - Date.parse(first.date)) / 86_400_000
  );
  if (Math.abs(change) < 0.05) return "Stable across recent updates";
  if (!Number.isFinite(elapsedDays) || elapsedDays < 1) {
    return `Rate ${change > 0 ? "up" : "down"} ${Math.abs(change).toFixed(1)}% across recent updates`;
  }
  return `Rate ${change > 0 ? "up" : "down"} ${Math.abs(change).toFixed(1)}% over ${elapsedDays} ${elapsedDays === 1 ? "day" : "days"}`;
}

function normalizeTrendPoints(points: ReferenceRatePoint[]): ReferenceRatePoint[] {
  return points
    .filter(
      (point) =>
        Number.isFinite(point.rate) &&
        point.rate > 0 &&
        Number.isFinite(Date.parse(point.date))
    )
    .sort((left, right) => Date.parse(left.date) - Date.parse(right.date));
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
    <div className="exchange-trend" role="img" aria-label={`${direction} ${Math.abs(change).toFixed(1)} percent across recent rate updates`}>
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true">
        <path d={path} />
      </svg>
      <p>
        {direction}
        {direction === "Stable" ? "" : ` ${Math.abs(change).toFixed(1)}%`}
        <span> · recent rate updates</span>
      </p>
    </div>
  );
}
