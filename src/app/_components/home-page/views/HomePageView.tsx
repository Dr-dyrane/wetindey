import {
  ExchangePanel,
  AsyncList,
  ItemCard,
  PhotoCredits,
  AlertTriangle,
  AdaptiveShell,
  ItemDetailSheet,
  GetItSheet,
  ConfirmVisitSheet,
  PresentationHost,
  SettingsSheet,
  ProfileSheet,
  ReportPriceSheet,
  CategorySelectorSheet,
  MapPresentation
} from "../imports/imports";
import { useHomePage } from "../hooks/useHomePage";
import { HomePlaceDetailView } from "./HomePlaceDetailView";
import { HomeSheetHeaderView } from "./HomeSheetHeaderView";
import "../styles/HomePage.css";

type HomePageViewProps = ReturnType<typeof useHomePage>;

export function HomePageView({
  theme,
  toggleTheme,
  t,
  locale,
  setLocale,
  cameraCenter,
  setCameraCenter,
  activeRadiusKm,
  setActiveRadiusKm,
  activeDetent,
  setActiveDetent,
  mapRetryCapability,
  setMapRetryCapability,
  detailPlaceId,
  setDetailPlaceId,
  isPending,
  insetProbeRef,
  leadingInset,
  isRegular,
  surface,
  openSurface,
  closeSurface,
  isSettingsOpen,
  openSettings,
  closeSettings,
  isReportOpen,
  openReport,
  closeReport,
  isProfileOpen,
  openProfile,
  closeProfile,
  activeCategory,
  isCategoryOpen,
  setIsCategoryOpen,
  exchangeFilter,
  setExchangeFilter,
  selectedExchangeLocationId,
  setSelectedExchangeLocationId,
  detailItem,
  setDetailItem,
  getItTarget,
  setGetItTarget,
  pendingVisit,
  setPendingVisit,
  searchQuery,
  popularItems,
  searchResults,
  searchError,
  setSearchRetryNonce,
  placeOffers,
  placeOffersError,
  setPlaceOffersRetry,
  isSearching,
  isPlaceOffersLoading,
  location,
  searchOrigin,
  sessionUser,
  resolvedSelfAvatarUrl,
  resolvedSelfIdentity,
  submitPlaces,
  submitItems,
  submitVariants,
  submitUnits,
  formPlaceId,
  formItemId,
  formVariantId,
  formUnitId,
  formPrice,
  formAvailable,
  setFormPlaceId,
  setFormItemId,
  setFormVariantId,
  setFormUnitId,
  setFormPrice,
  setFormAvailable,
  anyLoadError,
  retryFailed,
  handleSessionChange,
  handleSearchChange,
  handleSelectItem,
  handleSelectPlaceOffer,
  handleItemOffersChange,
  handleSelectOffer,
  filteredExchangeLocations,
  exchangeLocationDiscoveryStatus,
  crossCategorySignals,
  handleSelectExchangeLocation,
  handleMarkerSelection,
  handleCategoryChange,
  clearSearch,
  detailPlace,
  mapMarkers,
  route,
  handleOriginDisclosed,
  handleArmVisit,
  handleRecenter,
  locateError,
  setLocateError,
  dismissLocateError
}: HomePageViewProps) {
  // 1. Map node (base layer)
  const mapNode = (
    <MapPresentation
      mapMarkers={mapMarkers}
      selectedPlaceId={
        activeCategory === "money" ? selectedExchangeLocationId : detailPlaceId
      }
      onMarkerClick={handleMarkerSelection}
      cameraCenter={cameraCenter}
      selfIdentity={resolvedSelfIdentity}
      route={route}
      activeDetent={activeDetent}
      leadingInset={leadingInset}
      isRegular={isRegular}
      locationLabel={location.label}
      theme={theme}
      toggleTheme={toggleTheme}
      openLocationSurface={() => openSurface({ kind: "location" })}
      handleRecenter={handleRecenter}
      locateError={locateError}
      setLocateError={setLocateError}
      dismissLocateError={dismissLocateError}
      onRetryCapabilityChange={setMapRetryCapability}
      insetProbeRef={insetProbeRef}
    />
  );

  // 2. Sheet node (left sidebar on desktop / bottom sheet on mobile)
  const sheetNode = (
    <div className="home-sheet-content">
      <HomeSheetHeaderView
        t={t}
        activeCategory={activeCategory}
        setIsCategoryOpen={setIsCategoryOpen}
        crossCategorySignals={crossCategorySignals}
        handleCategoryChange={handleCategoryChange}
        openReport={openReport}
        openProfile={openProfile}
        sessionUser={sessionUser}
        resolvedSelfAvatarUrl={resolvedSelfAvatarUrl}
        searchQuery={searchQuery}
        handleSearchChange={handleSearchChange}
        clearSearch={clearSearch}
      />

      {/* The app's level-0 scroller, sibling to NavigationStack's level-1
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
          that box's only child is `h-full`. */}
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
            {/* A. Popular items */}
            {!searchQuery && (
              <div className="space-y-2.5">
                <div className="flex items-baseline justify-between px-0.5">
                  <h4 className="text-footnote font-semibold text-text-primary">
                    {t.popular_items} {location.label}
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
                    title: `No prices within ${activeRadiusKm} km`,
                    description: "Be the first to report one."
                  }}
                  errorState={{
                    title: anyLoadError ?? "Could not load",
                    description: "Check your network and try again.",
                    retryLabel: "Try again"
                  }}
                  footer={popularItems && <PhotoCredits items={popularItems} />}
                />
              </div>
            )}

            {/* B. Search results. One branch, not two, the old "searching" branch
                rendered h-12 bars that stood in for ItemCards and jumped the layout
                the moment real rows arrived. */}
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
                  title: t.no_results,
                  description: "Try a local name like “ewa” or “dodo”."
                }}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );

  // 3. Place detail, level 1 of the navigation stack, in BOTH size classes.
  //
  // Not a sidebar and not desktop-only: RegularShell's right island is gone, so
  // both shells hand this node to the same NavigationStack, compact inside the
  // bottom sheet, regular inside the left panel.
  //
  // ONE way in: tapping a pin. The offer list hands off to GetItSheet directly
  // and never pushes this, because a level the user did not ask for stacks under
  // that modal and hides the map behind two full surfaces.
  //
  // Place → its items. Offer detail is NOT this axis and does not belong here;
  // ItemDetailSheet owns item → its places, on both shells.
  const detailNode =
    activeCategory === "food" && detailPlace ? (
      <HomePlaceDetailView
        detailPlace={detailPlace}
        isRegular={isRegular}
        placeOffers={placeOffers}
        placeOffersError={placeOffersError}
        isPlaceOffersLoading={isPlaceOffersLoading}
        searchOrigin={searchOrigin}
        locationLabel={location.label}
        handleSelectPlaceOffer={handleSelectPlaceOffer}
        setDetailPlaceId={setDetailPlaceId}
        setGetItTarget={setGetItTarget}
        setPlaceOffersRetry={setPlaceOffersRetry}
      />
    ) : undefined;

  return (
    <div className="home-page-container">
      {/* `detailLabel` and `onDetailBack` name and pop level 1. Both are driven
          by the same `detailPlaceId` that gates `detailNode`, so the level, its
          title and its back button cannot disagree about what is open. */}
      <AdaptiveShell
        mapNode={mapNode}
        sheetNode={sheetNode}
        detailNode={detailNode}
        detailLabel={detailPlace?.name}
        onDetailBack={() => setDetailPlaceId(null)}
        activeDetent={activeDetent}
        setActiveDetent={setActiveDetent}
        mapRetryCapability={mapRetryCapability}
      />

      {/* Progressive reveal: each task presents its own surface over the map
          and the results sheet, instead of taking their place. */}

      {/* rice → long-grain → 50 kg bag → ranked offers. */}
      <ItemDetailSheet
        open={activeCategory === "food" && Boolean(detailItem)}
        onClose={() => setDetailItem(null)}
        item={detailItem}
        center={searchOrigin}
        radiusKm={activeRadiusKm}
        areaName={location.label}
        onSelectOffer={handleSelectOffer}
        onOffersChange={handleItemOffersChange}
        t={t}
      />

      {/* The lookup becomes a trip. */}
      <GetItSheet
        open={activeCategory === "food" && Boolean(getItTarget)}
        onClose={() => setGetItTarget(null)}
        target={getItTarget}
        onOriginDisclosed={handleOriginDisclosed}
        onGoThere={handleArmVisit}
      />

      {/* The trip becomes an answer. This is the part that compounds. */}
      <ConfirmVisitSheet
        open={activeCategory === "food" && Boolean(pendingVisit)}
        visit={pendingVisit}
        onClose={() => setPendingVisit(null)}
        lang={locale}
      />

      {/* The presentation spine: the four controller surfaces (location, my
          reports, report a problem, about), each gated by `surface`. One is open
          at a time, so opening any of them closes the others and none peeks above
          the next, and this is where a hash deep-link surfaces. */}
      <PresentationHost
        surface={surface}
        onClose={closeSurface}
        radiusKm={activeRadiusKm}
        onCommitLocation={(coords) => setCameraCenter(coords)}
        signedIn={Boolean(sessionUser)}
        onReportPrice={() => {
          // The empty-state exit from My reports: close this surface, then open
          // the report-price sheet, which stays page.tsx's own boolean.
          closeSurface();
          openReport();
        }}
        manageProfileUser={sessionUser}
        onSessionChange={handleSessionChange}
      />

      <SettingsSheet
        open={isSettingsOpen}
        onClose={closeSettings}
        lang={locale}
        onLangChange={setLocale}
        theme={theme}
        onToggleTheme={toggleTheme}
        radiusKm={activeRadiusKm}
        onRadiusChange={setActiveRadiusKm}
        t={t}
      />

      <ProfileSheet
        open={isProfileOpen}
        onClose={closeProfile}
        onOpenSettings={openSettings}
        onChangeArea={() => openSurface({ kind: "location" })}
        onOpenMyReports={() => openSurface({ kind: "my-reports" })}
        onOpenReportProblem={() => openSurface({ kind: "report-problem" })}
        onOpenAbout={() => openSurface({ kind: "about" })}
        onOpenManageProfile={() => openSurface({ kind: "manage-profile" })}
        currentAreaName={location.label}
        user={sessionUser}
        onSessionChange={handleSessionChange}
      />

      <ReportPriceSheet
        open={activeCategory === "food" && isReportOpen}
        onClose={closeReport}
        t={t}
        places={submitPlaces}
        items={submitItems}
        variants={submitVariants}
        units={submitUnits}
        placeId={formPlaceId}
        itemId={formItemId}
        variantId={formVariantId}
        unitId={formUnitId}
        price={formPrice}
        available={formAvailable}
        onPlaceId={setFormPlaceId}
        onItemId={setFormItemId}
        onVariantId={setFormVariantId}
        onUnitId={setFormUnitId}
        onPrice={setFormPrice}
        onAvailable={setFormAvailable}
      />

      <CategorySelectorSheet
        open={isCategoryOpen}
        onClose={() => setIsCategoryOpen(false)}
        activeCategory={activeCategory}
        onCategoryChange={handleCategoryChange}
        t={t}
      />
    </div>
  );
}
