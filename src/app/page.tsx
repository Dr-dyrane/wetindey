"use client";

import React, { useState, useEffect, useTransition, useMemo } from "react";
import { useAtom } from "jotai";
import {
  MapPin,
  Navigation,
  Share2,
  AlertTriangle,
  CheckCircle2,
  ArrowLeft,
  Sun,
  Moon,
  X,
  Settings,
  Plus
} from "lucide-react";

import { Button } from "@/design-system/components/Button";
import { SearchField } from "@/design-system/components/SearchField";
import { Card } from "@/design-system/components/Card";
import { AdaptiveShell } from "@/design-system/components/AdaptiveShell";
import { MapboxCanvas } from "@/design-system/components/MapboxCanvas";
import { Skeleton, CardListSkeleton } from "@/design-system/components/Skeleton";
import { NigeriaLogo } from "@/design-system/components/NigeriaLogo";
import { ItemCard, PhotoCredits, type ItemCardData } from "@/design-system/components/ItemCard";
import { StatusDot } from "@/design-system/components/StatusBadge";
import { SettingsSheet } from "@/app/_components/SettingsSheet";
import { ReportPriceSheet } from "@/app/_components/ReportPriceSheet";

import { useTheme } from "@/core/context/ThemeContext";
import { useGlobalStore } from "@/core/state/globalStore";
import { sheetDetentAtom, activeMarkerIdAtom, searchFocusedAtom } from "@/core/state/uiAtoms";
import {
  searchFoodItems,
  getPopularItems,
  getFoodItemCandidates,
  getPlaces,
  getPlaceOffers,
  getInitialSubmissionData,
  submitObservation
} from "@/app/actions";
import { getHaversineDistance, formatDistance } from "@/lib/geospatial";

interface PlaceData {
  id: string;
  name: string;
  placeType: string;
  location: {
    lat: number;
    lng: number;
  };
  address: string | null;
}

interface Candidate {
  id: string;
  placeId: string;
  placeName: string;
  lat: number;
  lng: number;
  address: string;
  detail: {
    priceMin: number;
    priceMax?: number;
    priceType: string;
    unit: string;
    timestamp: string;
    sourceType: string;
    confidenceLevel: string;
    confidenceScore: number;
  };
}

interface PlaceOffer {
  id: string;
  itemName: string;
  variantName: string;
  priceMin: number;
  priceMax?: number;
  unit: string;
  availabilityState: string;
  freshnessState: string;
}

// Phase 3 Localization Dictionaries
const TRANSLATIONS = {
  en: {
    wetin_dey: "WetinDey",
    search_placeholder: "Wetin you dey find?",
    popular_items: "Popular items around",
    settings: "Settings",
    theme: "Interface Theme",
    radius: "Geospatial Search Radius",
    pilot_areas: "Lagos Pilot Areas",
    report_price: "Report Food Price",
    done: "Done",
    submit: "Submit Report",
    price_paid: "Price Paid (₦)",
    market: "Select Market",
    item: "Select Food Item",
    variant: "Select Quality/Type",
    unit: "Select Packaging",
    availability: "Is it available?",
    available: "Yes, available",
    unavailable: "No, out of stock",
    success_msg: "Report saved successfully!",
    offline_msg: "Saved offline. Will sync when back online!",
    no_results: "No items found",
    locations_found: "locations found",
    reported_price: "Reported Price",
    freshness: "Freshness Status",
    data_confidence: "Data Confidence",
    data_source: "Data Source",
    directions: "Directions",
    share: "Share",
    clear_search: "Clear Search",
    confirmed: "Confirmed Available",
    caution: "Likely Available",
    language: "App Language",
    light_mode: "Light Mode",
    dark_mode: "Dark Mode"
  },
  pidgin: {
    wetin_dey: "WetinDey",
    search_placeholder: "Wetin you dey find?",
    popular_items: "Things people dey buy for",
    settings: "Settings",
    theme: "How app dey look",
    radius: "Distance where you dey find market",
    pilot_areas: "Places where we dey work for Lagos",
    report_price: "Tell us how much dem sell food",
    done: "O ti tan",
    submit: "Send Report",
    price_paid: "Money inside Naira (₦)",
    market: "Which market you go?",
    item: "Which food be dat?",
    variant: "How the quality be?",
    unit: "How dem pack am?",
    availability: "Food dey there?",
    available: "Yes, e dey",
    unavailable: "No, e don finish",
    success_msg: "We don save your report, correct!",
    offline_msg: "Network bad. We save am offline, we go sync later!",
    no_results: "We no find anything",
    locations_found: "places where we see am",
    reported_price: "Price dem tell us",
    freshness: "E dey fresh?",
    data_confidence: "How we trust the report",
    data_source: "Who tell us",
    directions: "Show me road",
    share: "Share",
    clear_search: "Comot Search",
    confirmed: "True-true e dey",
    caution: "Maybe e dey",
    language: "App Language",
    light_mode: "Day time style",
    dark_mode: "Night time style"
  },
  yoruba: {
    wetin_dey: "Kilo n ṣẹlẹ",
    search_placeholder: "Kini o n wa?",
    popular_items: "Awọn ounjẹ ti o wọpọ ni",
    settings: "Eto",
    theme: "Irisi Ohun elo",
    radius: "Ijinna Wiwa Ọja",
    pilot_areas: "Awọn agbegbe Lagos ti a n ṣiṣẹ",
    report_price: "Sọ idiyele ounjẹ",
    done: "O ti tan",
    submit: "Firanṣẹ",
    price_paid: "Iye owo ni Naira (₦)",
    market: "Yan Ọja",
    item: "Yan Ounjẹ",
    variant: "Yan Iru rẹ",
    unit: "Yan Iṣakojọpọ",
    availability: "Ṣe o wa?",
    available: "Bẹẹni, o wa",
    unavailable: "Rara, o ti tan",
    success_msg: "O ti ṣaṣeyọri firanṣẹ tuntun!",
    offline_msg: "Ko si netiwọọki. A ti fipamọ offline lati sync nigbamii!",
    no_results: "A kò rí kankan",
    locations_found: "awọn ọja ti o wa",
    reported_price: "Iye owo ti a sọ",
    freshness: "Ṣe o tun jẹ tuntun?",
    data_confidence: "Igbekele Data",
    data_source: "Orisun Data",
    directions: "Fi ọna han mi",
    share: "Pin",
    clear_search: "Nu Wiwa kuro",
    confirmed: "Daju pe o wa",
    caution: "O le wa",
    language: "Ede Ohun elo",
    light_mode: "Ipo Imọlẹ",
    dark_mode: "Ipo Okunkun"
  }
};

type LangType = "en" | "pidgin" | "yoruba";

export default function HomePage() {
  const { theme, toggleTheme } = useTheme();
  
  // Zustand Global State (L3)
  const {
    mapCenter,
    setMapCenter,
    setSelectedItemId,
    activeRadiusKm,
    setActiveRadiusKm,
    selectedAreaName
  } = useGlobalStore();

  // Jotai Atomic State (L5)
  const [activeDetent, setActiveDetent] = useAtom(sheetDetentAtom);
  const [activeMarkerId, setActiveMarkerId] = useAtom(activeMarkerIdAtom);
  const [_searchFocused, setSearchFocused] = useAtom(searchFocusedAtom);

  // React Transitions
  const [isPending, startTransition] = useTransition();

  // Navigation Panel Views
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [appLang, setAppLang] = useState<LangType>("en");

  // General App States
  const [searchQuery, setSearchQuery] = useState("");
  const [popularItems, setPopularItems] = useState<ItemCardData[]>([]);
  const [searchResults, setSearchResults] = useState<ItemCardData[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<ItemCardData | null>(null);
  const [matchingOffers, setMatchingOffers] = useState<Candidate[]>([]);
  const [allPlaces, setAllPlaces] = useState<PlaceData[]>([]);
  const [placeOffers, setPlaceOffers] = useState<PlaceOffer[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isOffersLoading, setIsOffersLoading] = useState(false);
  const [isPlaceOffersLoading, setIsPlaceOffersLoading] = useState(false);

  // Report Submission Lookup Metadata
  const [submitPlaces, setSubmitPlaces] = useState<{ id: string; name: string }[]>([]);
  const [submitItems, setSubmitItems] = useState<{ id: string; name: string }[]>([]);
  const [submitVariants, setSubmitVariants] = useState<{ id: string; itemId: string; displayName: string }[]>([]);
  const [submitUnits, setSubmitUnits] = useState<{ id: string; displayName: string }[]>([]);

  // Price Submission Form Field States
  const [formPlaceId, setFormPlaceId] = useState("");
  const [formItemId, setFormItemId] = useState("");
  const [formVariantId, setFormVariantId] = useState("");
  const [formUnitId, setFormUnitId] = useState("");
  const [formPrice, setFormPrice] = useState("");
  const [formAvailable, setFormAvailable] = useState<"available" | "unavailable">("available");
  
  // Submission Statuses
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [isOfflineSaved, setIsOfflineSaved] = useState(false);

  // Load baseline data on mount
  useEffect(() => {
    startTransition(async () => {
      try {
        setLoadError(null);

        // Fetch in parallel — these three don't depend on each other, and doing
        // them in series stacked three round-trips before anything rendered.
        const [items, placesList, metadata] = await Promise.all([
          getPopularItems(8),
          getPlaces(),
          getInitialSubmissionData()
        ]);

        setPopularItems(items);
        setAllPlaces(placesList);

        setSubmitPlaces(metadata.places);
        setSubmitItems(metadata.items);
        setSubmitVariants(metadata.variants);
        setSubmitUnits(metadata.units);

        // Set baseline form defaults
        if (metadata.places.length > 0) setFormPlaceId(metadata.places[0].id);
        if (metadata.items.length > 0) setFormItemId(metadata.items[0].id);
        if (metadata.units.length > 0) setFormUnitId(metadata.units[0].id);
      } catch (err) {
        // Previously this effect had no catch, so a database that was down
        // produced an empty map and an empty sheet with no explanation.
        console.error("Failed to load initial data:", err);
        setLoadError("We no fit reach the price data right now.");
      }
    });
  }, []);

  // Phase 4: Sync offline entries once connection is back online
  useEffect(() => {
    const syncOfflineEntries = async () => {
      if (typeof window === "undefined" || !navigator.onLine) return;
      const cached = localStorage.getItem("pending_observations");
      if (!cached) return;

      try {
        const queue = JSON.parse(cached) as Array<{
          placeId: string;
          itemVariantId: string;
          unitId: string;
          priceAmount: number;
          availabilityState: "available" | "unavailable";
        }>;

        if (queue.length === 0) return;

        console.log(`Syncing ${queue.length} offline price reports to Neon database...`);
        for (const item of queue) {
          await submitObservation(item);
        }

        // Clean cache queue once synced
        localStorage.removeItem("pending_observations");
        
        // Refresh active listings
        const updatedPlaces = await getPlaces();
        setAllPlaces(updatedPlaces);
        if (selectedItem) {
          const freshCandidates = await getFoodItemCandidates(selectedItem.id);
          setMatchingOffers(freshCandidates);
        }
      } catch (err) {
        console.error("Failed to sync offline observations:", err);
      }
    };

    window.addEventListener("online", syncOfflineEntries);
    // Sync immediately if we are online on mount
    syncOfflineEntries();

    return () => window.removeEventListener("online", syncOfflineEntries);
  }, [selectedItem]);

  // Synchronize item selection with its matching variants list
  useEffect(() => {
    const matched = submitVariants.filter((v) => v.itemId === formItemId);
    if (matched.length > 0) {
      setFormVariantId(matched[0].id);
    } else {
      setFormVariantId("");
    }
  }, [formItemId, submitVariants]);

  // Fetch available food items and prices in a market when a pin is clicked on startup
  useEffect(() => {
    if (activeMarkerId && !selectedItem) {
      setIsPlaceOffersLoading(true);
      startTransition(async () => {
        const offers = await getPlaceOffers(activeMarkerId);
        setPlaceOffers(offers);
        setIsPlaceOffersLoading(false);
      });
    } else {
      setPlaceOffers([]);
    }
  }, [activeMarkerId, selectedItem]);

  // Handle Search Input transitions
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchQuery(val);

    if (val.trim() === "") {
      setSelectedItem(null);
      setSelectedItemId(null);
      setSearchResults([]);
      setMatchingOffers([]);
      return;
    }

    setIsSearching(true);
    startTransition(async () => {
      const matched = await searchFoodItems(val);
      setSearchResults(matched);
      setIsSearching(false);
    });
  };

  // Resolve selecting a specific item
  const handleSelectItem = (item: ItemCardData) => {
    setSelectedItem(item);
    setSelectedItemId(item.id);
    setSearchQuery(item.name);
    setIsOffersLoading(true);

    startTransition(async () => {
      const candidates = await getFoodItemCandidates(item.id);
      setMatchingOffers(candidates);
      setIsOffersLoading(false);

      // Reset selection focus
      setActiveMarkerId(null);

      // Auto center on first result if exists
      if (candidates.length > 0) {
        setMapCenter({ lat: candidates[0].lat, lng: candidates[0].lng });
      }
    });
  };

  const handleMarkerSelection = (placeId: string) => {
    setActiveMarkerId(placeId);
    setActiveDetent("medium");

    // Center map on selected pin
    const match = allPlaces.find((p) => p.id === placeId);
    if (match) {
      setMapCenter({ lat: match.location.lat, lng: match.location.lng });
    }
  };

  const clearSearch = () => {
    setSearchQuery("");
    setSelectedItem(null);
    setSelectedItemId(null);
    setActiveMarkerId(null);
    setSearchResults([]);
    setMatchingOffers([]);
  };

  // Phase 1 Price Report submission
  const handlePriceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError("");
    setSubmitSuccess(false);
    setIsOfflineSaved(false);

    if (!formPlaceId || !formVariantId || !formUnitId || !formPrice) {
      setSubmitError("Please fill out all fields.");
      return;
    }

    const priceNum = parseFloat(formPrice);
    if (isNaN(priceNum) || priceNum <= 0) {
      setSubmitError("Please enter a valid price amount.");
      return;
    }

    setIsSubmitting(true);

    const payload = {
      placeId: formPlaceId,
      itemVariantId: formVariantId,
      unitId: formUnitId,
      priceAmount: priceNum,
      availabilityState: formAvailable
    };

    // Phase 4: Handle offline queueing
    if (typeof window !== "undefined" && !navigator.onLine) {
      try {
        const cached = localStorage.getItem("pending_observations");
        const queue = cached ? JSON.parse(cached) : [];
        queue.push(payload);
        localStorage.setItem("pending_observations", JSON.stringify(queue));
        
        setIsOfflineSaved(true);
        setFormPrice("");
        setIsSubmitting(false);

        // Auto close after 2 seconds
        setTimeout(() => {
          setIsReportOpen(false);
          setIsOfflineSaved(false);
        }, 2000);
      } catch (_err) {
        setSubmitError("Failed to store offline entry.");
        setIsSubmitting(false);
      }
      return;
    }

    try {
      const res = await submitObservation(payload);
      if (res.success) {
        setSubmitSuccess(true);
        setFormPrice("");
        setIsSubmitting(false);

        // Refresh places and item candidates to show pin updates instantly
        const updatedPlaces = await getPlaces();
        setAllPlaces(updatedPlaces);
        if (selectedItem) {
          const freshCandidates = await getFoodItemCandidates(selectedItem.id);
          setMatchingOffers(freshCandidates);
        }

        // Auto close after 2 seconds
        setTimeout(() => {
          setIsReportOpen(false);
          setSubmitSuccess(false);
        }, 2000);
      }
    } catch (_err) {
      setSubmitError("Submission failed. Try again.");
      setIsSubmitting(false);
    }
  };

  // Format price in NGN Naira currency
  const formatPrice = (koboAmount: number) => {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
      maximumFractionDigits: 0
    }).format(koboAmount / 100);
  };

  // Retrieve selected offer when filtering by item
  const selectedOffer = useMemo(() => {
    return matchingOffers.find((o) => o.placeId === activeMarkerId);
  }, [matchingOffers, activeMarkerId]);

  // Retrieve selected place when clicking neutral pins
  const selectedPlace = useMemo(() => {
    return allPlaces.find((p) => p.id === activeMarkerId);
  }, [allPlaces, activeMarkerId]);

  // Map markers: Use candidates if item selected, otherwise show all places as neutral pins
  const mapMarkers = useMemo(() => {
    if (selectedItem && matchingOffers.length > 0) {
      return matchingOffers;
    }
    return allPlaces.map((p) => ({
      id: p.id,
      placeId: p.id,
      placeName: p.name,
      lat: p.location.lat,
      lng: p.location.lng,
      address: p.address || "",
    }));
  }, [selectedItem, matchingOffers, allPlaces]);

  // 1. Map Node (Base layer)
  const mapNode = (
    <div className="relative w-full h-full">
      <MapboxCanvas
        candidates={mapMarkers}
        selectedPlaceId={activeMarkerId}
        onMarkerClick={handleMarkerSelection}
        center={mapCenter}
      />

      {/* Floating controls. These sit directly on the map, so they use the
          translucent material rather than a solid surface — the map needs to
          stay legible through them. */}
      <div
        className="absolute left-4 right-4 z-10 flex items-start justify-between pointer-events-none"
        style={{ top: "calc(var(--safe-area-top) + 12px)" }}
      >
        <div className="pointer-events-auto flex items-center gap-2 squircle-full material-thick px-3 py-1.5 shadow-raised">
          <StatusDot kind="confirmed" pulse />
          <span className="text-footnote font-medium text-text-primary">Showing {selectedAreaName}</span>
        </div>

        <button
          onClick={toggleTheme}
          aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          className="pointer-events-auto grid h-9 w-9 place-items-center squircle-full material-thick
                     shadow-raised text-text-primary
                     active:scale-90 transition-transform duration-instant"
        >
          {theme === "dark" ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
        </button>
      </div>
    </div>
  );

  // 2. Sheet Node (Left Sidebar / Mobile Bottom Sheet)
  const sheetNode = (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Brand & Search Header */}
      <div className="px-4 pt-3 pb-2.5 flex flex-col gap-2.5">
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center space-x-2.5">
            <NigeriaLogo className="h-7 w-7" fillColor="fill-text-primary dark:fill-white" />
            <span className="font-extrabold text-base tracking-tight">{TRANSLATIONS[appLang].wetin_dey}</span>
          </div>

          {/* Both actions present a sheet over this one rather than replacing
              its contents, so the search context stays put underneath. */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setIsReportOpen(true)}
              className="grid place-items-center h-8 w-8 rounded-full bg-fillSecondary text-text-primary
                         active:scale-90 transition-transform duration-instant"
              aria-label={TRANSLATIONS[appLang].report_price}
            >
              <Plus className="h-[18px] w-[18px]" strokeWidth={2.5} />
            </button>

            <button
              onClick={() => setIsSettingsOpen(true)}
              className="grid place-items-center h-8 w-8 rounded-full bg-fillSecondary text-text-primary
                         active:scale-90 transition-transform duration-instant"
              aria-label={TRANSLATIONS[appLang].settings}
            >
              <Settings className="h-[18px] w-[18px]" strokeWidth={2.2} />
            </button>
          </div>
        </div>

        {selectedItem && (
          <div className="flex items-center">
            <Button variant="ghost" size="sm" onClick={clearSearch} className="h-7 px-2 -ml-2 text-status-info">
              <ArrowLeft className="h-4 w-4 mr-1" />
              {TRANSLATIONS[appLang].clear_search}
            </Button>
          </div>
        )}

        <SearchField
          value={searchQuery}
          onChange={handleSearchChange}
          onClear={clearSearch}
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setSearchFocused(false)}
          placeholder={TRANSLATIONS[appLang].search_placeholder}
        />
      </div>

      {/* Scrollable Contents */}
      <div className="flex-1 overflow-y-auto px-3 pb-5">
          <div className="space-y-4">
            {/* A. Popular Items Suggestions */}
            {!searchQuery && !selectedItem && (
              <div className="space-y-2.5">
                <div className="flex items-baseline justify-between px-0.5">
                  <h4 className="text-[13px] font-semibold text-text-primary">
                    {TRANSLATIONS[appLang].popular_items} {selectedAreaName}
                  </h4>
                  {popularItems.length > 0 && (
                    <span className="text-[12px] text-text-secondary tabular-nums">
                      {popularItems.reduce((n, i) => n + (i.offerCount ?? 0), 0)} prices
                    </span>
                  )}
                </div>

                {loadError ? (
                  <div className="squircle bg-surface shadow-card p-5 text-center space-y-2">
                    <StatusDot kind="unavailable" />
                    <p className="text-[14px] font-semibold text-text-primary">{loadError}</p>
                    <p className="text-[12px] text-text-secondary">Check your network and pull down to try again.</p>
                  </div>
                ) : isPending && popularItems.length === 0 ? (
                  <CardListSkeleton count={4} />
                ) : popularItems.length === 0 ? (
                  <div className="squircle bg-surface shadow-card p-5 text-center">
                    <p className="text-[14px] font-semibold text-text-primary">No prices yet</p>
                    <p className="text-[12px] text-text-secondary mt-1">Be the first to report one.</p>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 gap-2">
                      {popularItems.map((item) => (
                        <ItemCard key={item.id} item={item} onSelect={handleSelectItem} />
                      ))}
                    </div>
                    <PhotoCredits items={popularItems} />
                  </>
                )}
              </div>
            )}

            {/* B. Searching Loading Indicator */}
            {isSearching && (
              <div className="space-y-2">
                <Skeleton className="h-12 w-full squircle" />
                <Skeleton className="h-12 w-full squircle" />
                <Skeleton className="h-12 w-full squircle" />
              </div>
            )}

            {/* C. Search Results Suggestions */}
            {searchQuery && !selectedItem && !isSearching && (
              <div className="space-y-2">
                {searchResults.length > 0 ? (
                  searchResults.map((item) => (
                    <ItemCard key={item.id} item={item} onSelect={handleSelectItem} />
                  ))
                ) : (
                  <div className="text-center py-10 space-y-3">
                    <div className="inline-flex p-3.5 rounded-full bg-status-caution-bg text-status-caution-fg">
                      <AlertTriangle className="h-7 w-7" />
                    </div>
                    <h3 className="text-sm font-bold">{TRANSLATIONS[appLang].no_results}</h3>
                    <p className="text-[12px] text-text-secondary">Try a local name like &ldquo;ewa&rdquo; or &ldquo;dodo&rdquo;.</p>
                  </div>
                )}
              </div>
            )}

            {/* D. Offers loading state */}
            {isOffersLoading && <CardListSkeleton count={2} />}

            {/* E. List Result View (Rendered inside sheet) */}
            {selectedItem && !isOffersLoading && (
              <div className="space-y-3">
                <div className="pb-3 mb-1 flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-black text-text-primary">{selectedItem.name}</h2>
                    <p className="text-xs text-text-secondary mt-0.5">{matchingOffers.length} {TRANSLATIONS[appLang].locations_found}</p>
                  </div>
                  <span className="text-[9px] font-black tracking-wider uppercase px-2 py-0.5 rounded bg-accent/10 text-accent">
                    Neon DB
                  </span>
                </div>

                {matchingOffers.length > 0 ? (
                  <div className="space-y-2.5">
                    {matchingOffers.map((offer) => {
                      const isSelected = activeMarkerId === offer.placeId;

                      return (
                        <Card
                          key={offer.id}
                          hoverable
                          onClick={() => handleMarkerSelection(offer.placeId)}
                          className={`transition-all duration-standard ${
                            isSelected ? "bg-fillSecondary/80" : ""
                          }`}
                        >
                          <div className="p-4 space-y-3">
                            <div className="flex items-start justify-between">
                              <div>
                                <h3 className="font-bold text-text-primary text-sm">{offer.placeName}</h3>
                                <p className="text-xs text-text-secondary mt-0.5 leading-snug flex items-center">
                                  <MapPin className="h-3.5 w-3.5 text-accent mr-1 shrink-0" />
                                  {formatDistance(getHaversineDistance(mapCenter.lat, mapCenter.lng, offer.lat, offer.lng))} • {offer.address}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-baseline justify-between pt-1">
                              <div>
                                <span className="text-lg font-black text-accent">
                                  {formatPrice(offer.detail.priceMin)}
                                </span>
                                {offer.detail.priceMax && (
                                  <span className="text-lg font-black text-accent">
                                    {" - "}{formatPrice(offer.detail.priceMax)}
                                  </span>
                                )}
                                <span className="text-xs text-text-secondary ml-1">/ {offer.detail.unit}</span>
                              </div>
                            </div>

                            {/* Mobile selection detail buttons embedded in sheet */}
                            {isSelected && (
                              <div className="md:hidden pt-3 mt-1 grid grid-cols-2 gap-2 animate-fade-in">
                                <Button
                                  variant="primary"
                                  size="sm"
                                  className="h-9 text-xs flex items-center justify-center"
                                >
                                  <Navigation className="h-3.5 w-3.5 mr-1" />
                                  {TRANSLATIONS[appLang].directions}
                                </Button>
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  className="h-9 text-xs flex items-center justify-center"
                                >
                                  <Share2 className="h-3.5 w-3.5 mr-1" />
                                  {TRANSLATIONS[appLang].share}
                                </Button>
                              </div>
                            )}
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <MapPin className="h-6 w-6 text-text-tertiary/40 mx-auto" />
                  </div>
                )}
              </div>
            )}
          </div>
      </div>
    </div>
  );

  // 3. Desktop Detail Sidebar Node (Right panel overlay on Desktop)
  // Reusable detail drawer content dynamically mapped to item-selection or market-selection state
  const detailNode = useMemo(() => {
    if (selectedOffer) {
      return (
        <div className="space-y-5 h-full flex flex-col justify-between">
          <div className="space-y-4">
            {/* Detail Panel Header */}
            <div className="flex items-start justify-between">
              <div className="flex-1 pr-4">
                <h2 className="text-base font-black tracking-tight leading-snug text-text-primary">
                  {selectedOffer.placeName}
                </h2>
                <p className="text-xs text-text-secondary mt-1 flex items-center">
                  <MapPin className="h-3.5 w-3.5 text-accent mr-1 shrink-0" />
                  {formatDistance(getHaversineDistance(mapCenter.lat, mapCenter.lng, selectedOffer.lat, selectedOffer.lng))} • {selectedOffer.address}
                </p>
              </div>
              <button
                onClick={() => setActiveMarkerId(null)}
                className="p-1.5 rounded-full bg-fillSecondary text-text-secondary hover:text-text-primary transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Price Tag Info */}
            <div className="p-4 squircle bg-fillSecondary/50 flex flex-col space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-text-tertiary">
                {TRANSLATIONS[appLang].reported_price}
              </span>
              <div className="flex items-baseline">
                <span className="text-xl font-black text-accent">
                  {formatPrice(selectedOffer.detail.priceMin)}
                </span>
                {selectedOffer.detail.priceMax && (
                  <span className="text-xl font-black text-accent">
                    {" - "}{formatPrice(selectedOffer.detail.priceMax)}
                  </span>
                )}
                <span className="text-xs text-text-secondary ml-1">/ {selectedOffer.detail.unit}</span>
              </div>
            </div>

            {/* Info stats */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs py-2">
                <span className="text-text-secondary">{TRANSLATIONS[appLang].freshness}</span>
                <span
                  className={`font-semibold px-2 py-0.5 rounded-full flex items-center ${
                    selectedOffer.detail.confidenceLevel === "confirmed"
                      ? "bg-status-confirmed/10 text-status-confirmed"
                      : selectedOffer.detail.confidenceLevel === "caution"
                      ? "bg-status-caution/10 text-status-caution"
                      : "bg-status-unavailable/10 text-status-unavailable"
                  }`}
                >
                  {selectedOffer.detail.confidenceLevel === "confirmed"
                    ? TRANSLATIONS[appLang].confirmed
                    : selectedOffer.detail.confidenceLevel === "caution"
                    ? TRANSLATIONS[appLang].caution
                    : TRANSLATIONS[appLang].unavailable}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs py-2">
                <span className="text-text-secondary">{TRANSLATIONS[appLang].data_confidence}</span>
                <span className="font-semibold text-text-primary flex items-center">
                  <CheckCircle2 className="h-3.5 w-3.5 text-accent mr-1" />
                  {selectedOffer.detail.confidenceScore}%
                </span>
              </div>
              <div className="flex items-center justify-between text-xs py-2">
                <span className="text-text-secondary">{TRANSLATIONS[appLang].data_source}</span>
                <span className="font-semibold text-text-primary">
                  {selectedOffer.detail.sourceType}
                </span>
              </div>
            </div>
          </div>

          {/* Sticky Bottom Actions */}
          <div className="grid grid-cols-2 gap-3 pt-4 mt-2">
            <Button variant="primary" size="md" className="w-full flex items-center justify-center">
              <Navigation className="h-4 w-4 mr-1.5" />
              {TRANSLATIONS[appLang].directions}
            </Button>
            <Button variant="secondary" size="md" className="w-full flex items-center justify-center">
              <Share2 className="h-4 w-4 mr-1.5" />
              {TRANSLATIONS[appLang].share}
            </Button>
          </div>
        </div>
      );
    }

    if (selectedPlace) {
      return (
        <div className="space-y-5 h-full flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex-1 pr-4">
                <h2 className="text-base font-black tracking-tight leading-snug text-text-primary">
                  {selectedPlace.name}
                </h2>
                <p className="text-xs text-text-secondary mt-1 flex items-center">
                  <MapPin className="h-3.5 w-3.5 text-accent mr-1 shrink-0" />
                  {formatDistance(getHaversineDistance(mapCenter.lat, mapCenter.lng, selectedPlace.location.lat, selectedPlace.location.lng))} • {selectedPlace.address || `${selectedAreaName}, Lagos`}
                </p>
              </div>
              <button
                onClick={() => setActiveMarkerId(null)}
                className="p-1.5 rounded-full bg-fillSecondary text-text-secondary hover:text-text-primary transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* List of food items and prices currently available in this specific market */}
            <div className="space-y-3">
              <h4 className="text-[10px] font-bold uppercase tracking-wider text-text-tertiary">
                Available Prices in Market
              </h4>
              {isPlaceOffersLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-10 w-full squircle" />
                  <Skeleton className="h-10 w-full squircle" />
                </div>
              ) : placeOffers.length > 0 ? (
                <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-1">
                  {placeOffers.map((offer) => (
                    <div 
                      key={offer.id}
                      className="p-3 squircle bg-fillSecondary/40 flex items-center justify-between"
                    >
                      <div>
                        <div className="text-xs font-bold text-text-primary">{offer.itemName}</div>
                        <div className="text-[10px] text-text-secondary mt-0.5">{offer.variantName}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs font-black text-accent">{formatPrice(offer.priceMin)}</div>
                        <div className="text-[9px] text-text-tertiary">/ {offer.unit}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6">
                  <MapPin className="h-5 w-5 text-text-tertiary/40 mx-auto" />
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-4 mt-2">
            <Button variant="primary" size="md" className="w-full flex items-center justify-center">
              <Navigation className="h-4 w-4 mr-1.5" />
              {TRANSLATIONS[appLang].directions}
            </Button>
            <Button variant="secondary" size="md" className="w-full flex items-center justify-center">
              <Share2 className="h-4 w-4 mr-1.5" />
              {TRANSLATIONS[appLang].share}
            </Button>
          </div>
        </div>
      );
    }

    return undefined;
  }, [selectedOffer, selectedPlace, placeOffers, isPlaceOffersLoading, mapCenter.lat, mapCenter.lng, appLang, setActiveMarkerId, selectedAreaName]);

  return (
    <div className="relative w-full h-full min-h-screen overflow-hidden">
      <AdaptiveShell
        mapNode={mapNode}
        sheetNode={sheetNode}
        detailNode={detailNode}
        activeDetent={activeDetent}
        setActiveDetent={setActiveDetent}
      />

      {/* Progressive reveal: each task presents its own surface over the map
          and the results sheet, instead of taking their place. */}
      <SettingsSheet
        open={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        lang={appLang}
        onLangChange={setAppLang}
        theme={theme}
        onToggleTheme={toggleTheme}
        radiusKm={activeRadiusKm}
        onRadiusChange={setActiveRadiusKm}
        t={TRANSLATIONS[appLang]}
      />

      <ReportPriceSheet
        open={isReportOpen}
        onClose={() => setIsReportOpen(false)}
        t={TRANSLATIONS[appLang]}
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
        onSubmit={handlePriceSubmit}
        submitting={isSubmitting}
        error={submitError}
        success={submitSuccess}
        offlineSaved={isOfflineSaved}
      />
    </div>
  );
}
