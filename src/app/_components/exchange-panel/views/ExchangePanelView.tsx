import React from "react";
import {
  IconOrb,
  Skeleton,
  SolidIcon,
  transition,
  CurrencyPickerSheet,
  formatDistance,
  getHaversineDistance,
  useT,
  type ReferenceRatePoint,
} from "../imports/imports";
import {
  formatEffectiveDate,
  getCrossRate,
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
  locationDiscoveryStatus,
  selectedLocationId,
  onSelectLocation,
  panel,
}: ExchangePanelViewProps) {
  const t = useT();
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
    trendPeriod,
    setTrendPeriod,
    trendInsight,
    enterCurrency,
    editAmount,
    foreignError,
    ngnError,
    availableCurrencies,
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
          previews={catalogState.kind === "ready" ? catalogState.entries : []}
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
          value={baseCurrency}
          onSelect={enterBaseCurrency}
          previews={catalogState.kind === "ready" ? catalogState.entries : []}
          disabled={catalogState.kind !== "ready"}
        />
      )}
    </div>
  );

  const foreignInput = (
    <div className="exchange-slender-row">
      <label htmlFor={amountId} className="sr-only">{t("exchange.foreign_amount_label")}</label>
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
      <label htmlFor={ngnAmountId} className="sr-only">{t("exchange.naira_amount_label")}</label>
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

  const activeCrossRate = getCrossRate(currency, baseCurrency, visibleRate);

  return (
    <div className="space-y-3 px-3 pb-[calc(max(var(--sheet-hidden,0px),var(--safe-area-bottom))+20px)]">
      {/* 1. HERO RATE CARD (Slender  HIG Container) */}
      <section aria-label={t("exchange.reference_rate_answer")} className="squircle-card bg-surface-card p-3.5 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-caption-1 font-semibold text-text-secondary">
            {visibleRate
              ? t(visibleRate.provider === "CBN" ? "exchange.provider_cbn" : "exchange.provider_frankfurter")
              : t("exchange.reference_rate")}
          </span>
          {visibleRate && (
            <span className="text-caption-2 font-medium text-text-tertiary">
              {t("exchange.effective", { date: formatEffectiveDate(visibleRate.effectiveDate, t) })}
            </span>
          )}
        </div>

        {currency === baseCurrency ? (
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-title-1 font-bold tracking-tight text-text-primary tabular-nums">
              1.00
            </span>
            <span className="squircle bg-fillSecondary px-2 py-0.5 text-caption-1 font-semibold tabular-nums text-text-secondary">
              {t("exchange.same_currency")}
            </span>
          </div>
        ) : (
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-title-1 font-bold tracking-tight text-text-primary tabular-nums">
              {baseCurrency === "NGN" ? "₦" : ""}
              {activeCrossRate === null
                ? "—"
                : activeCrossRate.toLocaleString("en-NG", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
            </span>
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
        )}
      </section>

      {/* 2. DUAL CONVERTER RAIL (Slender Interactive Inputs with 180° Spring Swap) */}
      <section aria-label={t("exchange.converter_section")} className="squircle-card bg-surface-card p-3.5 space-y-2.5">
        <div className="space-y-2">
          {conversionReversed ? ngnInput : foreignInput}

          <div className="flex justify-center my-0.5">
            <button
              type="button"
              onClick={toggleConversionDirection}
              className={`exchange-swap-button ${transition.press}`}
              aria-label={t("exchange.swap_direction")}
            >
              <CoinsExchange size={18} />
            </button>
          </div>

          {conversionReversed ? foreignInput : ngnInput}
        </div>

        {foreignError && <p id={foreignErrorId} role="alert" className="text-footnote text-status-danger-fg px-1">{foreignError}</p>}
        {ngnError && <p id={ngnErrorId} role="alert" className="text-footnote text-status-danger-fg px-1">{ngnError}</p>}

        <p className="text-caption-1 text-text-tertiary text-center leading-snug">
          {t("exchange.rate_disclaimer")}
        </p>
      </section>

      {/* 3. TIME-GATED TREND & STORY INSIGHT CARD */}
      {trendInsight && (
        <section aria-label={t("exchange.trend_section")} className="squircle-card bg-surface-card p-3.5 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-footnote font-semibold text-text-secondary">{t("exchange.rate_movement")}</h3>
            <div className="flex gap-1 bg-fillTertiary p-0.5 squircle" role="radiogroup" aria-label={t("exchange.trend_time_range")}>
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
            <span>{t("exchange.high_label")} <strong className="text-text-primary tabular-nums">{baseCurrency === "NGN" ? "₦" : ""}{trendInsight.high.toFixed(2)}</strong></span>
            <span>{t("exchange.low_label")} <strong className="text-text-primary tabular-nums">{baseCurrency === "NGN" ? "₦" : ""}{trendInsight.low.toFixed(2)}</strong></span>
          </div>

          <SparklineGraph points={trendInsight.points} />

          <p className="text-footnote font-medium text-text-secondary leading-snug">
            {trendInsight.narrative}
          </p>
        </section>
      )}

      {/* 4. NEARBY MAP LISTINGS */}
      <section aria-label={t("exchange.nearby_title")} className="space-y-2">
        <div className="px-1 flex items-center justify-between">
          <h3 className="text-footnote font-semibold text-text-secondary">{t("exchange.nearby_title")}</h3>
          {locationDiscoveryStatus === "sample" ? (
            <span className="text-caption-1 font-medium text-text-tertiary">{t("exchange.sample")}</span>
          ) : nearestDist ? (
            <span className="text-caption-1 text-text-tertiary">{t("exchange.nearest", { dist: nearestDist })}</span>
          ) : null}
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

          {locationDiscoveryStatus === "loading" && (
            <div className="p-4 text-center text-footnote text-text-secondary" role="status">
              {t("exchange.finding_nearby")}
            </div>
          )}

          {locationDiscoveryStatus === "ready" && sortedLocations.length === 0 && (
            <div className="p-4 text-center text-footnote text-text-secondary">
              {t("exchange.no_listings")}
            </div>
          )}

          {locationDiscoveryStatus === "unavailable" && (
            <div className="p-4 text-center text-footnote text-text-secondary">
              {t("exchange.nearby_unavailable")}
            </div>
          )}
        </div>

        <p className="px-1 text-caption-1 text-text-tertiary">
          {locationDiscoveryStatus === "sample"
            ? t("exchange.sample_disclaimer")
            : t("exchange.listings_disclaimer")}
        </p>
      </section>
    </div>
  );
}

function SparklineGraph({ points }: { points: ReferenceRatePoint[] }) {
  const t = useT();
  if (points.length < 2) return null;
  const values = points.map((p) => p.rate);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const spread = max - min || 1;
  const width = 300;
  const height = 48;
  const coordinates = values.map((value, index) => ({
    x: (index / (values.length - 1)) * width,
    y: height - 6 - ((value - min) / spread) * (height - 12),
  }));
  const firstPoint = coordinates[0]!;
  const path = coordinates.slice(0, -1).reduce((result, point, index) => {
    const previous = coordinates[index - 1] ?? point;
    const next = coordinates[index + 1]!;
    const afterNext = coordinates[index + 2] ?? next;
    const controlOneX = point.x + (next.x - previous.x) / 6;
    const controlOneY = point.y + (next.y - previous.y) / 6;
    const controlTwoX = next.x - (afterNext.x - point.x) / 6;
    const controlTwoY = next.y - (afterNext.y - point.y) / 6;
    return `${result} C${controlOneX.toFixed(1)},${controlOneY.toFixed(
      1
    )} ${controlTwoX.toFixed(1)},${controlTwoY.toFixed(1)} ${next.x.toFixed(
      1
    )},${next.y.toFixed(1)}`;
  }, `M${firstPoint.x.toFixed(1)},${firstPoint.y.toFixed(1)}`);

  const areaPath = `${path} L ${width},${height} L 0,${height} Z`;
  const change = values.at(-1)! - values[0]!;
  const threshold = Math.abs(values[0]!) * 0.0005;
  const direction =
    Math.abs(change) <= threshold ? "stable" : change > 0 ? "rising" : "falling";
  const tone =
    direction === "rising"
      ? "text-status-confirmed-fg"
      : direction === "falling"
        ? "text-status-caution-fg"
        : "text-text-secondary";

  return (
    <div
      className={`relative w-full overflow-hidden ${tone}`}
      style={{ height: `${height}px` }}
    >
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="h-full w-full"
        role="img"
        aria-label={t("exchange.trend_aria", { direction })}
      >
        <defs>
          <linearGradient id="sparkline-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.2" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#sparkline-grad)" />
        <path
          d={path}
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

function CoinsExchange({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="8" cy="8" r="4.5" />
      <circle cx="16" cy="16" r="4.5" />
      <path d="M15 8h2a2 2 0 0 1 2 2v1" />
      <path d="M18 12l2-2-2-2" />
      <path d="M9 16H7a2 2 0 0 1-2-2v-1" />
      <path d="M6 12L4 14l2 2" />
    </svg>
  );
}
