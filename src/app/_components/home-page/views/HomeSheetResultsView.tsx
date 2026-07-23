import {
  ExchangePanel,
  AsyncList,
  ItemCard,
  PhotoCredits,
  AlertTriangle
} from "../imports/imports";
import { useT } from "@/core/i18n";
import type { useHomePage } from "../hooks/useHomePage";

type HomePageState = ReturnType<typeof useHomePage>;

type HomeSheetResultsViewProps = Pick<
  HomePageState,
  | "activeCategory"
  | "activeRadiusKm"
  | "searchOrigin"
  | "filteredExchangeLocations"
  | "exchangeLocationDiscoveryStatus"
  | "exchangeFilter"
  | "setExchangeFilter"
  | "setSelectedExchangeLocationId"
  | "selectedExchangeLocationId"
  | "handleSelectExchangeLocation"
  | "searchQuery"
  | "location"
  | "popularItems"
  | "isPending"
  | "anyLoadError"
  | "retryFailed"
  | "handleSelectItem"
  | "searchResults"
  | "isSearching"
  | "searchError"
  | "setSearchRetryNonce"
>;

export function HomeSheetResultsView({
  activeCategory,
  activeRadiusKm,
  searchOrigin,
  filteredExchangeLocations,
  exchangeLocationDiscoveryStatus,
  exchangeFilter,
  setExchangeFilter,
  setSelectedExchangeLocationId,
  selectedExchangeLocationId,
  handleSelectExchangeLocation,
  searchQuery,
  location,
  popularItems,
  isPending,
  anyLoadError,
  retryFailed,
  handleSelectItem,
  searchResults,
  isSearching,
  searchError,
  setSearchRetryNonce
}: HomeSheetResultsViewProps) {
  // useT(), not the t dictionary prop the hook still exports for older views:
  // home.empty_prices_title interpolates {km}, which only useT() fills.
  const t = useT();
  return (
    /* The app's level-0 scroller, sibling to NavigationStack's level-1
       scroller inside the same sheet; the two reserve their bottom strip the
       same way, and must keep agreeing.

       That reservation is the LARGER of two strips, never their sum.
       `--sheet-hidden` is the part of the sheet hanging below the viewport at
       the current detent, which BottomSheet publishes because only it knows
       the number. It starts at the viewport's bottom edge, so it already
       spans the home indicator, and adding the safe area to it would pad the
       same 34px twice. At `large` the sheet is docked, `--sheet-hidden` is 0,
       and the safe area is the whole reservation. 20px is the breathing room.
       The `0px` fallback is load-bearing, the regular shell mounts no
       BottomSheet, so the variable is undefined there and `max()` yields the
       safe area alone, the padding it has always had, with no branch on size
       class.

       `overscroll-contain` keeps an overscroll at either end of this list
       from chaining out to the document behind the sheet. It has no bearing
       on BottomSheet's wrapper box, which cannot scroll in the first place:
       that box's only child is `h-full`. */
    <div
      className={`flex-1 overflow-y-auto overscroll-contain ${
        activeCategory === "food"
          ? "px-3 pb-[calc(max(var(--sheet-hidden,0px),var(--safe-area-bottom))+20px)]"
          : ""
      }`}
    >
      {activeCategory === "money" ? (
        <ExchangePanel
          origin={searchOrigin}
          locations={filteredExchangeLocations}
          locationDiscoveryStatus={exchangeLocationDiscoveryStatus}
          filter={exchangeFilter}
          onFilterChange={(filter) => {
            setExchangeFilter(filter);
            setSelectedExchangeLocationId(null);
          }}
          selectedLocationId={selectedExchangeLocationId}
          onSelectLocation={handleSelectExchangeLocation}
        />
      ) : (
        <div className="space-y-4">
          {!searchQuery && (
            <div className="space-y-2.5">
              <div className="flex items-baseline justify-between px-0.5">
                <h4 className="text-footnote font-semibold text-text-primary">
                  {t("popular_items")} {location.label}
                </h4>
                {popularItems && popularItems.length > 0 && (
                  <span className="text-caption-1 text-text-secondary tabular-nums">
                    {popularItems.reduce((n, i) => n + (i.offerCount ?? 0), 0)} prices
                  </span>
                )}
              </div>

              {/* `subject` is the location, because the list IS about the
                  location now. AsyncList remounts its skeletons when the subject
                  changes, so switching area shows the list loading rather than
                  silently swapping Festac's prices for Yaba's under a header
                  that already says Yaba. This was previously omitted, correctly,
                  at the time, because the query ignored location and a refetch
                  returned byte-identical rows. It no longer does. */}
              <AsyncList
                subject={`${location.label}·${activeRadiusKm}`}
                items={popularItems}
                isLoading={isPending}
                error={anyLoadError}
                onRetry={retryFailed}
                keyExtractor={(item) => item.id}
                renderItem={(item) => <ItemCard item={item} onSelect={handleSelectItem} />}
                skeletonCount={4}
                empty={{
                  title: t("home.empty_prices_title", { km: activeRadiusKm }),
                  description: t("home.empty_prices_body")
                }}
                errorState={{
                  title: anyLoadError ?? t("home.err_load_title"),
                  description: t("home.err_network_body"),
                  retryLabel: t("home.retry")
                }}
                footer={popularItems && <PhotoCredits items={popularItems} />}
              />
            </div>
          )}

          {/* One search branch, not two: skeletons retain ItemCard geometry. */}
          {searchQuery && (
            <AsyncList
              items={searchResults}
              isLoading={isSearching}
              error={searchError}
              onRetry={() => setSearchRetryNonce((nonce) => nonce + 1)}
              errorState={searchError ? { description: searchError } : undefined}
              subject={searchQuery}
              keyExtractor={(item) => item.id}
              renderItem={(item) => <ItemCard item={item} onSelect={handleSelectItem} />}
              skeletonCount={3}
              empty={{
                icon: <AlertTriangle className="h-7 w-7" />,
                title: t("no_results"),
                description: t("home.search_empty_body")
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}
