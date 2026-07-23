import {
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
import { useEverPresented } from "../hooks/useEverPresented";
import { HomePlaceDetailView } from "./HomePlaceDetailView";
import { HomeSheetHeaderView } from "./HomeSheetHeaderView";
import { HomeSheetResultsView } from "./HomeSheetResultsView";
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
  submitVocabStatus,
  retrySubmissionVocabulary,
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
  handleDismissItemDetail,
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
  routeTint,
  handleOriginDisclosed,
  handleArmVisit,
  handleRecenter,
  locateError,
  setLocateError,
  dismissLocateError
}: HomePageViewProps) {
  // Once-opened latches for the code-split sheets: not rendered until first
  // open (their chunks must not download at boot), never un-rendered after
  // (ModalSheet's exit animation needs the component alive through it).
  const settingsEver = useEverPresented(isSettingsOpen);
  const profileEver = useEverPresented(isProfileOpen);
  const reportEver = useEverPresented(activeCategory === "food" && isReportOpen);

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
      routeTint={routeTint}
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

      <HomeSheetResultsView
        activeCategory={activeCategory}
        activeRadiusKm={activeRadiusKm}
        searchOrigin={searchOrigin}
        filteredExchangeLocations={filteredExchangeLocations}
        exchangeLocationDiscoveryStatus={exchangeLocationDiscoveryStatus}
        exchangeFilter={exchangeFilter}
        setExchangeFilter={setExchangeFilter}
        setSelectedExchangeLocationId={setSelectedExchangeLocationId}
        selectedExchangeLocationId={selectedExchangeLocationId}
        handleSelectExchangeLocation={handleSelectExchangeLocation}
        searchQuery={searchQuery}
        location={location}
        popularItems={popularItems}
        isPending={isPending}
        anyLoadError={anyLoadError}
        retryFailed={retryFailed}
        handleSelectItem={handleSelectItem}
        searchResults={searchResults}
        isSearching={isSearching}
        searchError={searchError}
        setSearchRetryNonce={setSearchRetryNonce}
      />
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
        onClose={handleDismissItemDetail}
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

      {settingsEver && (
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
      )}

      {profileEver && (
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
      )}

      {reportEver && (
      <ReportPriceSheet
        open={activeCategory === "food" && isReportOpen}
        onClose={closeReport}
        t={t}
        places={submitPlaces}
        items={submitItems}
        variants={submitVariants}
        units={submitUnits}
        vocabStatus={submitVocabStatus}
        onRetryVocab={retrySubmissionVocabulary}
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
      )}

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
