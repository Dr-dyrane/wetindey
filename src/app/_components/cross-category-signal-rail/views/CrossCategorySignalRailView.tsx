import {
  Utensils,
  ChevronRight,
  CurrencyFlag,
} from "../imports/imports";
import type { CrossCategorySignalRailProps } from "../CrossCategorySignalRail";
import type { useCrossCategorySignalRail } from "../hooks/useCrossCategorySignalRail";
import "../styles/CrossCategorySignalRail.css";

export interface CrossCategorySignalRailViewProps extends CrossCategorySignalRailProps {
  sheet: ReturnType<typeof useCrossCategorySignalRail>;
}

export function CrossCategorySignalRailView(p: CrossCategorySignalRailViewProps) {
  const { index, setPaused } = p.sheet;

  const signal = p.signals[index];
  if (!signal) return <span className="min-w-0 flex-1" aria-hidden />;

  return (
    <button
      type="button"
      className="group grid h-9 min-w-0 flex-1 place-items-center px-0.5 text-left active:scale-[0.96] transition-transform duration-150"
      aria-label={signal.accessibleLabel}
      onClick={() => p.onActivate(signal.category)}
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <span className="cross-category-signal-pill relative flex w-full min-w-0 items-center justify-between overflow-hidden bg-fillSecondary px-2 shadow-sm transition-all hover:bg-fillTertiary">
        <span
          key={signal.id}
          className="cross-category-signal-enter flex min-w-0 items-center gap-1.5"
        >
          {/* Live pulse indicator */}
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-status-confirmed-fg animate-pulse" aria-hidden />

          {signal.visual === "usd" ? (
            <CurrencyFlag code="USD" className="h-3.5 w-3.5 shrink-0" />
          ) : (
            <Utensils
              className="h-3.5 w-3.5 shrink-0 text-domain-food"
              strokeWidth={2.4}
              aria-hidden
            />
          )}

          <div className="flex items-center gap-1 min-w-0 truncate">
            {signal.code && (
              <span className="text-caption-1 font-bold text-text-primary shrink-0">
                {signal.code}
              </span>
            )}
            <span className="text-caption-1 font-medium text-text-secondary truncate">
              {signal.amount}
            </span>
            {signal.trendText && (
              <span
                className={`squircle px-1 py-0.25 text-[10px] font-bold tabular-nums shrink-0 ${
                  signal.trendTone === "positive"
                    ? "bg-status-confirmed-bg text-status-confirmed-fg"
                    : signal.trendTone === "negative"
                      ? "bg-status-caution-bg text-status-caution-fg"
                      : "bg-fillTertiary text-text-secondary"
                }`}
              >
                {signal.trendText}
              </span>
            )}
          </div>
        </span>

        <ChevronRight className="h-3 w-3 shrink-0 text-text-tertiary transition-transform group-hover:translate-x-0.5" aria-hidden />
      </span>
    </button>
  );
}
