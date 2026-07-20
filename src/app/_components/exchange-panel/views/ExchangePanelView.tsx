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
    amountId,
    foreignErrorId,
    ngnAmountId,
    ngnErrorId,
    currency,
    baseCurrency,
    enterBaseCurrency,
    amounts,
    catalogState,
    rateState,
    trendPeriod,
    setTrendPeriod,
    trendInsight,
    enterCurrency,
    editAmount,
    foreignError,
    ngnError,
    availableCurrencies,
    selectedMeta,
    visibleRate,
    conversionReversed,
    toggleConversionDirection,
  } = panel;

  const sortedLocations = [...locations].sort(
    (a, b) =>
      getHaversineDistance(origin.lat, origin.lng, a.lat, a.lng) -
      getHaversineDistance(origin.lat, origin.lng, b.lat, b.lng)
  );

  const nearestDist =
    sortedLocations.length > 0
      ? formatDistance(
          getHaversineDistance(
            origin.lat,
            origin.lng,
            sortedLocations[0]!.lat,
            sortedLocations[0]!.lng
          )
        )
      : null;

  const foreignPicker = (
    <div className="flex items-center gap-2">
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

  const ngnPicker = (
    <div className="flex items-center gap-2">
      {catalogState.kind === "loading" && !currency ? (
        <Skeleton className="h-9 w-24 rounded-[14px]" />
      ) : (
        <CurrencyPickerSheet
          available={availableCurrencies}
          value={baseCurrency as any}
          onSelect={(selected) => enterBaseCurrency(selected as string)}
          disabled={catalogState.kind !== "ready"}
        />
      )}
    </div>
  );

  const foreignInput = (
    <div className="exchange-slender-row">
      <label htmlFor={amountId} className="sr-only">Foreign amount</label>
      <input
        id={amountId}
        value={amounts.foreign}
        onChange={(e) => editAmount("foreign", e.target.value)}
        inputMode="decimal"
        autoComplete="off"
        placeholder="100"
        aria-invalid={foreignError ? true : undefined}
        aria-describedby={foreignError ? foreignErrorId : undefined}
        data-autofocus
        className="exchange-amount-input text-title-2 font-bold tabular-nums"
      />
      {foreignPicker}
    </div>
  );

  const ngnInput = (
    <div className="exchange-slender-row">
      <label htmlFor={ngnAmountId} className="sr-only">Naira amount</label>
      <input
        id={ngnAmountId}
        value={amounts.ngn}
        onChange={(e) => editAmount("ngn", e.target.value)}
        inputMode="decimal"
        autoComplete="off"
        placeholder="100000"
        aria-invalid={ngnError ? true : undefined}
        aria-describedby={ngnError ? ngnErrorId : undefined}
        className="exchange-amount-input text-title-2 font-bold tabular-nums"
      />
      {ngnPicker}
    </div>
  );

  return (
    <div className="space-y-3 px-3 pb-[calc(max(var(--sheet-hidden,0px),var(--safe-area-bottom))+20px)]">
      {/* 1. HERO RATE CARD (Slender  HIG Container) */}
      <section aria-label="Reference Rate Answer" className="squircle-card bg-surface-card p-3.5 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-caption-1 font-semibold text-text-secondary">
            {visibleRate ? providerLabel(visibleRate) : "CBN reference"}
          </span>
          {visibleRate && (
            <span className="text-caption-2 font-medium text-text-tertiary">
              Effective {formatEffectiveDate(visibleRate.effectiveDate)}
            </span>
          )}
        </div>

        {currency === baseCurrency ? (
          <div className="flex items-baseline justify-between gap-3">
            <div className="flex items-baseline gap-2">
              <span className="text-title-1 font-bold tracking-tight text-text-primary tabular-nums">
                1.00
              </span>
              <span className="text-footnote font-semibold text-text-secondary">
                per {currency ?? "unit"}
              </span>
            </div>
            <span className="squircle bg-fillSecondary px-2 py-0.5 text-caption-1 font-semibold tabular-nums text-text-secondary">
              1:1 Same currency
            </span>
          </div>
        ) : visibleRate && selectedMeta ? (
          <div className="flex items-baseline justify-between gap-3">
            <div className="flex items-baseline gap-2">
              <span className="text-title-1 font-bold tracking-tight text-text-primary tabular-nums">
                ₦{visibleRate.rate.toLocaleString("en-NG", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
              <span className="text-footnote font-semibold text-text-secondary">
                per {selectedMeta.code}
              </span>
            </div>
            {trendInsight && (
              <span
                className={`squircle px-2 py-0.5 text-caption-1 font-semibold tabular-nums ${
                  trendInsight.percentChange >= 0
                    ? "bg-status-confirmed-bg text-status-confirmed-fg"
                    : "bg-status-caution-bg text-status-caution-fg"
                }`}
              >
                {trendInsight.percentChange >= 0 ? "▲ +" : "▼ "}
                {Math.abs(trendInsight.percentChange).toFixed(1)}%
              </span>
            )}
          </div>
        ) : (
          <div className="py-2">
            <Skeleton className="h-8 w-48 rounded-[12px]" />
          </div>
        )}
      </section>

      {/* 2. DUAL CONVERTER RAIL (Slender Interactive Inputs with 180° Spring Swap) */}
      <section aria-label="Interactive Currency Converter" className="squircle-card bg-surface-card p-3.5 space-y-2.5">
        <div className="space-y-2">
          {conversionReversed ? ngnInput : foreignInput}

          <div className="flex justify-center my-1">
            <button
              type="button"
              onClick={toggleConversionDirection}
              className={`exchange-swap-button ${transition.press}`}
              aria-label="Swap conversion direction"
            >
              <SolidIcon name="refresh" size={16} />
            </button>
          </div>

          {conversionReversed ? foreignInput : ngnInput}
        </div>

        {foreignError && <p id={foreignErrorId} role="alert" className="text-footnote text-status-danger-fg px-1">{foreignError}</p>}
        {ngnError && <p id={ngnErrorId} role="alert" className="text-footnote text-status-danger-fg px-1">{ngnError}</p>}

        <p className="text-caption-1 text-text-tertiary text-center leading-snug">
          Reference rate estimate · WetinDey does not exchange money.
        </p>
      </section>

      {/* 3. TIME-GATED TREND & STORY INSIGHT CARD */}
      {trendInsight && (
        <section aria-label="Rate Movement Trend" className="squircle-card bg-surface-card p-3.5 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-footnote font-semibold text-text-secondary">Rate Movement</h3>
            <div className="flex gap-1 bg-fillTertiary p-0.5 squircle" role="radiogroup" aria-label="Trend Time Range">
              {(["7d", "14d", "30d"] as const).map((period) => (
                <button
                  key={period}
                  type="button"
                  role="radio"
                  aria-checked={trendPeriod === period}
                  onClick={() => setTrendPeriod(period)}
                  className={`px-2 py-0.5 text-caption-1 font-semibold uppercase squircle transition-all ${
                    trendPeriod === period
                      ? "bg-surface-card text-text-primary shadow-card"
                      : "text-text-tertiary"
                  }`}
                >
                  {period}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between text-caption-1 font-medium text-text-secondary">
            <span>High: <strong className="text-text-primary tabular-nums">₦{trendInsight.high.toFixed(2)}</strong></span>
            <span>Low: <strong className="text-text-primary tabular-nums">₦{trendInsight.low.toFixed(2)}</strong></span>
          </div>

          <SparklineGraph points={trendInsight.points} />

          <p className="text-footnote font-medium text-text-secondary leading-snug">
            {trendInsight.narrative}
          </p>
        </section>
      )}

      {/* 4. NEARBY SAMPLE EXCHANGE OUTLETS CARD GROUP */}
      <section aria-label="Sample Exchange Points" className="space-y-2">
        <div className="px-1 flex items-center justify-between">
          <h3 className="text-footnote font-semibold text-text-secondary">Sample Exchange Points</h3>
          {nearestDist && (
            <span className="text-caption-1 text-text-tertiary">Nearest {nearestDist}</span>
          )}
        </div>

        <div className="squircle-card bg-surface-card divide-y divide-fillSecondary overflow-hidden">
          {sortedLocations.map((location) => {
            const selected = location.id === selectedLocationId;
            const dist = formatDistance(
              getHaversineDistance(origin.lat, origin.lng, location.lat, location.lng)
            );

            return (
              <button
                key={location.id}
                type="button"
                aria-pressed={selected}
                onClick={() => onSelectLocation(location)}
                className={`flex min-h-[52px] w-full items-center justify-between gap-3 p-3 text-left transition-colors ${
                  selected ? "bg-fillSecondary" : "active:bg-fillTertiary"
                }`}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <IconOrb size={32} tone="domain-money">
                    <SolidIcon name={location.kind === "bank" ? "building" : "money"} size={16} />
                  </IconOrb>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-subhead font-semibold text-text-primary">
                      {location.name}
                    </p>
                    <p className="truncate text-caption-1 text-text-secondary">
                      {location.description}
                    </p>
                  </div>
                </div>
                <span className="shrink-0 text-caption-1 tabular-nums font-medium text-text-tertiary">
                  {dist}
                </span>
              </button>
            );
          })}

          {sortedLocations.length === 0 && (
            <div className="p-4 text-center text-footnote text-text-secondary">
              No sample exchange locations nearby.
            </div>
          )}
        </div>

        <p className="px-1 text-caption-1 text-text-tertiary">
          Prototype locations · not verified quotes or live inventory.
        </p>
      </section>
    </div>
  );
}

function SparklineGraph({ points }: { points: ReferenceRatePoint[] }) {
  if (points.length < 2) return null;
  const values = points.map((p) => p.rate);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const spread = max - min || 1;
  const width = 300;
  const height = 48;

  const path = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * width;
      const y = height - 6 - ((v - min) / spread) * (height - 12);
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  const areaPath = `${path} L ${width},${height} L 0,${height} Z`;

  return (
    <div className="relative w-full overflow-hidden" style={{ height: `${height}px` }}>
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="w-full h-full">
        <defs>
          <linearGradient id="sparkline-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-focus-ring)" stopOpacity="0.2" />
            <stop offset="100%" stopColor="var(--color-focus-ring)" stopOpacity="0.0" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#sparkline-grad)" />
        <path
          d={path}
          fill="none"
          stroke="var(--color-focus-ring)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}
