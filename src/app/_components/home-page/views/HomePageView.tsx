import React, { useMemo } from "react";
import {
  NigeriaLogo,
  ChevronDown,
  Plus,
  Avatar,
  SearchField,
  ExchangePanel,
  CrossCategorySignalRail,
  AsyncList,
  ItemCard,
  PhotoCredits,
  AlertTriangle,
  Button,
  Navigation,
  MapPin,
  X,
  PlaceOfferRow,
  PlaceOfferRowSkeleton,
  AdaptiveShell,
  ItemDetailSheet,
  GetItSheet,
  ConfirmVisitSheet,
  PresentationHost,
  SettingsSheet,
  ProfileSheet,
  ReportPriceSheet,
  CategorySelectorSheet,
  MapPresentation,
  formatDistance,
  getHaversineDistance
} from "../imports/imports";
import { useHomePage } from "../hooks/useHomePage";
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
      browsingAnchor={{
        lat: searchOrigin.lat,
        lng: searchOrigin.lng,
        label: location.label,
      }}
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
      {/* Brand & search header */}
      <div className="flex flex-col gap-2.5 px-4 pt-0 pb-2.5">
        <div className="flex w-full items-center gap-1">
          <div className="flex shrink-0 items-center space-x-1.5">
            <NigeriaLogo className="h-7 w-7" />
            <button
              type="button"
              onClick={() => setIsCategoryOpen(true)}
              className="flex h-9 items-center text-text-primary active:scale-95 transition-all duration-instant text-[13px] font-bold"
            >
              <span className="flex h-[30px] items-center gap-0.5 rounded-[18px] bg-fillSecondary px-2.5 shadow-sm">
                <span>
                  {activeCategory === "money"
                    ? "Aboki FX"
                    : (t as Record<string, string>).category_food || "Food"}
                </span>
                <ChevronDown className="h-3 w-3 text-text-secondary" />
              </span>
            </button>
          </div>

          <CrossCategorySignalRail
            signals={crossCategorySignals}
            onActivate={handleCategoryChange}
          />

          {/* Both actions present a sheet over this one rather than replacing
              its contents, so the search context stays put underneath. */}
          <div className="flex shrink-0 items-center gap-1">
            {activeCategory === "food" && (
              <button
                type="button"
                onClick={openReport}
                className="grid h-9 w-9 place-items-center text-text-primary
                           active:scale-90 transition-transform duration-instant"
                aria-label={t.report_price}
              >
                <span className="grid h-[30px] w-[30px] place-items-center rounded-full bg-fillSecondary shadow-sm">
                  <Plus className="h-4 w-4" strokeWidth={2.5} />
                </span>
              </button>
            )}

            <button
              type="button"
              onClick={openProfile}
              className="grid h-11 w-11 place-items-center squircle-full
                         active:scale-90 transition-transform duration-instant"
              aria-label="Profile"
            >
              {/* The one piece of persistent recognition chrome in the app.
                  Without a name it drew the anonymous silhouette forever, so
                  signing in changed nothing anyone could see: you were
                  recognised only inside the sheet you had to reopen to check.
                  `||`, not `??`, email OTP mints users with name: "". */}
              <Avatar
                name={sessionUser ? sessionUser.name || sessionUser.email : undefined}
                url={resolvedSelfAvatarUrl}
                size={32}
              />
            </button>
          </div>
        </div>

        {activeCategory === "food" && (
          <SearchField
            value={searchQuery}
            onChange={handleSearchChange}
            onClear={clearSearch}
            placeholder={t.search_placeholder}
          />
        )}
      </div>

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
  const detailNode = useMemo(() => {
    if (activeCategory !== "food" || !detailPlace) return undefined;

    const visitLabel = /kiosk|shop|supermarket/.test(detailPlace.placeType.toLowerCase())
      ? "Visit shop"
      : "Visit market";

    const getItAction = (
      <div
        className={`stack-surface z-10 shrink-0 ${isRegular ? "static pt-1" : "static py-2"}`}
      >
        <Button
          variant="primary"
          size="md"
          className="w-full flex items-center justify-center"
          onClick={() =>
            setGetItTarget({
              placeId: detailPlace.id,
              placeName: detailPlace.name,
              lat: detailPlace.location.lat,
              lng: detailPlace.location.lng,
              address: detailPlace.address,
              areaName: location.label,
              // Reached from a pin, so there is no single price under test,
              // and therefore nothing to confirm on the way back.
              offer: null
            })
          }
        >
          <Navigation className="h-4 w-4 mr-1.5" />
          {visitLabel}
        </Button>
      </div>
    );

    return (
      <div
        data-navigation-detail-bounded
        className="home-detail-bounded"
      >
        <div className="flex shrink-0 items-start justify-between">
          <div className="flex-1 pr-4">
            <h2 className="text-headline tracking-tight text-text-primary">{detailPlace.name}</h2>
            <p className="text-caption-1 text-text-secondary mt-1 flex items-center">
              <MapPin className="h-3.5 w-3.5 text-accent mr-1 shrink-0" />
              {/* From the user, not from the camera, this panel opens by
                  tapping a pin, which centres the camera ON that pin, so
                  measuring from `cameraCenter` printed "0 m away" for every
                  market you clicked. */}
              {formatDistance(
                getHaversineDistance(
                  searchOrigin.lat,
                  searchOrigin.lng,
                  detailPlace.location.lat,
                  detailPlace.location.lng
                )
              )}{" "}
              • {detailPlace.address || `${location.label}, Lagos`}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setDetailPlaceId(null)}
            aria-label="Close"
            className="grid min-h-tap min-w-tap shrink-0 place-items-center rounded-full
                       text-text-secondary transition-colors hover:text-text-primary
                       focus-visible:outline-2 focus-visible:outline-offset-2
                       focus-visible:outline-accent"
          >
            <span className="grid h-8 w-8 place-items-center rounded-full bg-fillSecondary">
              <X className="h-4 w-4" />
            </span>
          </button>
        </div>

        {!isRegular ? getItAction : null}

        {/* What this market is currently selling. */}
        <div className="-mx-2 flex min-h-0 flex-1 flex-col gap-2">
          <h4 className="shrink-0 px-2 text-footnote text-text-secondary">
            Prices in market
          </h4>
          <div
            data-navigation-detail-scroller
            className="min-h-0 flex-1 overflow-y-auto overscroll-y-none pr-1"
          >
            <AsyncList
              items={placeOffers}
              isLoading={isPlaceOffersLoading}
              error={placeOffersError}
              onRetry={() => setPlaceOffersRetry((attempt) => attempt + 1)}
              subject={detailPlace.id}
              keyExtractor={(offer) => offer.id}
              className={
                isRegular ? "grid-cols-2" : undefined
              }
              renderItem={(offer) => (
                <PlaceOfferRow
                  offer={offer}
                  layout={isRegular ? "regular" : "compact"}
                  onSelect={() => void handleSelectPlaceOffer(offer)}
                />
              )}
              skeleton={<PlaceOfferRowSkeleton layout={isRegular ? "regular" : "compact"} />}
              empty={{
                icon: <MapPin className="h-6 w-6" />,
                title: "No prices here yet",
                description: "Nobody has reported a price at this market."
              }}
              errorState={{
                title: placeOffersError ?? "Could not load",
                description: "Check your network and try again.",
                retryLabel: "Try again"
              }}
            />
          </div>
        </div>

        {isRegular ? getItAction : null}
      </div>
    );
  }, [
    activeCategory,
    detailPlace,
    isRegular,
    placeOffers,
    placeOffersError,
    isPlaceOffersLoading,
    searchOrigin,
    location.label,
    handleSelectPlaceOffer,
    setDetailPlaceId,
    setGetItTarget,
    setPlaceOffersRetry
  ]);

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
