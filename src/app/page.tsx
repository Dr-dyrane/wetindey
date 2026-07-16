"use client";

import React, { useState, useEffect, useTransition, useMemo } from "react";
import { useAtom } from "jotai";
import {
  Search,
  MapPin,
  Navigation,
  Share2,
  AlertTriangle,
  CheckCircle2,
  ArrowLeft,
  Sun,
  Moon,
  X
} from "lucide-react";

import { Button } from "@/design-system/components/Button";
import { Input } from "@/design-system/components/Input";
import { Card } from "@/design-system/components/Card";
import { AdaptiveShell } from "@/design-system/components/AdaptiveShell";
import { MapboxCanvas } from "@/design-system/components/MapboxCanvas";
import { Skeleton, CardListSkeleton } from "@/design-system/components/Skeleton";

import { useTheme } from "@/core/context/ThemeContext";
import { useGlobalStore } from "@/core/state/globalStore";
import { sheetDetentAtom, activeMarkerIdAtom, searchFocusedAtom } from "@/core/state/uiAtoms";
import { searchFoodItems, getFoodItemCandidates, getPlaces, getPlaceOffers } from "@/app/actions";

interface FoodItem {
  id: string;
  name: string;
  description: string | null;
}

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

export default function HomePage() {
  const { theme, toggleTheme } = useTheme();
  
  // Zustand Global State (L3)
  const { 
    mapCenter, 
    setMapCenter, 
    setSelectedItemId 
  } = useGlobalStore();

  // Jotai Atomic State (L5)
  const [activeDetent, setActiveDetent] = useAtom(sheetDetentAtom);
  const [activeMarkerId, setActiveMarkerId] = useAtom(activeMarkerIdAtom);
  const [_searchFocused, setSearchFocused] = useAtom(searchFocusedAtom);

  // React Transitions
  const [isPending, startTransition] = useTransition();

  // Component States
  const [searchQuery, setSearchQuery] = useState("");
  const [popularItems, setPopularItems] = useState<FoodItem[]>([]);
  const [searchResults, setSearchResults] = useState<FoodItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<FoodItem | null>(null);
  const [matchingOffers, setMatchingOffers] = useState<Candidate[]>([]);
  const [allPlaces, setAllPlaces] = useState<PlaceData[]>([]);
  const [placeOffers, setPlaceOffers] = useState<PlaceOffer[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isOffersLoading, setIsOffersLoading] = useState(false);
  const [isPlaceOffersLoading, setIsPlaceOffersLoading] = useState(false);

  // Load baseline data (popular items and all places) from database on mount
  useEffect(() => {
    startTransition(async () => {
      const items = await searchFoodItems(" ");
      setPopularItems(items.slice(0, 5));

      const placesList = await getPlaces();
      setAllPlaces(placesList);
    });
  }, []);

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
  const handleSelectItem = (item: FoodItem) => {
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

      {/* Floating System Controls on Map (Theme Toggle) */}
      <div className="absolute top-4 right-4 z-10">
        <Button
          variant="secondary"
          size="sm"
          onClick={toggleTheme}
          className="w-10 h-10 p-0 rounded-full shadow-md bg-surface/90 dark:bg-surface-elevated/90 backdrop-blur"
          aria-label="Toggle theme"
        >
          {theme === "dark" ? <Sun className="h-5 w-5 text-accent" /> : <Moon className="h-5 w-5 text-text-secondary" />}
        </Button>
      </div>
    </div>
  );

  // 2. Sheet Node (Left Sidebar / Mobile Bottom Sheet)
  const sheetNode = (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Brand & Search Header */}
      <div className="px-5 pt-4 pb-3 flex flex-col space-y-3">
        <div className="flex items-center space-x-2.5">
          {/* Logo: Question mark inside a simplified outline of Nigeria map */}
          <div className="h-7 w-7 text-accent relative flex items-center justify-center shrink-0">
            <svg viewBox="0 0 100 100" className="w-full h-full stroke-current fill-transparent" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M 15 75 C 10 50, 18 30, 24 18 C 34 10, 48 16, 56 12 C 68 8, 80 12, 86 18 C 92 34, 88 56, 82 72 C 70 85, 52 82, 48 85 C 40 80, 22 78, 15 75 Z" />
            </svg>
            <span className="absolute font-black text-xs text-text-primary -mt-0.5">?</span>
          </div>
          <span className="font-extrabold text-base tracking-tight">WetinDey</span>
        </div>

        {selectedItem && (
          <div className="flex items-center space-x-2 pb-1 text-accent font-semibold text-xs">
            <Button variant="ghost" size="sm" onClick={clearSearch} className="h-7 px-2 -ml-2 text-accent">
              <ArrowLeft className="h-4.5 w-4.5 mr-1" />
              Clear Search
            </Button>
          </div>
        )}

        <div className="relative">
          <Input
            value={searchQuery}
            onChange={handleSearchChange}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            placeholder="Wetin you dey find?"
            icon={<Search className="h-5 w-5" />}
            className="pr-10"
          />
          {searchQuery && (
            <button
              onClick={clearSearch}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-primary"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>

      {/* Scrollable List Contents */}
      <div className="flex-1 overflow-y-auto px-5 pb-5 space-y-4">
        {/* A. Popular Items Suggestions */}
        {!searchQuery && !selectedItem && (
          <div className="space-y-3">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-text-tertiary">
              Popular items around Yaba
            </h4>
            <div className="grid grid-cols-1 gap-2">
              {isPending && popularItems.length === 0 ? (
                <CardListSkeleton count={3} />
              ) : (
                popularItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleSelectItem(item)}
                    className="flex items-center space-x-3 w-full p-3.5 rounded-[16px] bg-fillSecondary/50 hover:bg-fillSecondary active:scale-[0.98] transition-all duration-micro text-left border-0"
                  >
                    <div className="p-2.5 rounded-full bg-accent/10 text-accent text-base">🛍️</div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-text-primary text-sm">{item.name}</div>
                      <div className="text-xs text-text-secondary truncate mt-0.5">
                        {item.description || "Fresh staple item available locally"}
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        {/* B. Searching Loading Indicator */}
        {isSearching && (
          <div className="space-y-2">
            <Skeleton className="h-12 w-full rounded-[14px]" />
            <Skeleton className="h-12 w-full rounded-[14px]" />
            <Skeleton className="h-12 w-full rounded-[14px]" />
          </div>
        )}

        {/* C. Search Results Suggestions */}
        {searchQuery && !selectedItem && !isSearching && (
          <div className="space-y-2">
            {searchResults.length > 0 ? (
              searchResults.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleSelectItem(item)}
                  className="flex items-center justify-between w-full p-3.5 rounded-[16px] bg-fillSecondary/50 hover:bg-fillSecondary active:scale-[0.98] transition-all duration-micro text-left border-0"
                >
                  <div className="font-semibold text-text-primary text-sm">{item.name}</div>
                  <span className="text-xs text-accent font-bold">Select</span>
                </button>
              ))
            ) : (
              <div className="text-center py-10 space-y-3">
                <div className="inline-flex p-3.5 rounded-full bg-status-caution/10 text-status-caution">
                  <AlertTriangle className="h-7 w-7" />
                </div>
                <h3 className="text-sm font-bold">No items found</h3>
                <p className="text-xs text-text-secondary max-w-[220px] mx-auto leading-normal">
                  Try searching for Rice, Beans, Garri, Yam or Palm Oil.
                </p>
              </div>
            )}
          </div>
        )}

        {/* D. Offers loading state */}
        {isOffersLoading && <CardListSkeleton count={2} />}

        {/* E. List Result View (Rendered inside sheet) */}
        {selectedItem && !isOffersLoading && (
          <div className="space-y-3">
            <div className="pb-2 border-b border-separator flex items-center justify-between">
              <div>
                <h2 className="text-base font-black text-text-primary">{selectedItem.name}</h2>
                <p className="text-xs text-text-secondary mt-0.5">{matchingOffers.length} locations found</p>
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
                            <p className="text-xs text-text-secondary mt-0.5 leading-snug">
                              {offer.address}
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
                          <div className="md:hidden pt-3 border-t border-separator/15 grid grid-cols-2 gap-2 animate-fade-in">
                            <Button
                              variant="primary"
                              size="sm"
                              className="h-9 text-xs flex items-center justify-center"
                            >
                              <Navigation className="h-3.5 w-3.5 mr-1" />
                              Directions
                            </Button>
                            <Button
                              variant="secondary"
                              size="sm"
                              className="h-9 text-xs flex items-center justify-center"
                            >
                              <Share2 className="h-3.5 w-3.5 mr-1" />
                              Share
                            </Button>
                          </div>
                        )}
                      </div>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-10">
                <p className="text-xs text-text-secondary">No locations reported around Yaba.</p>
              </div>
            )}
          </div>
        )}
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
                  {selectedOffer.address}
                </p>
              </div>
              <button
                onClick={() => setActiveMarkerId(null)}
                className="p-1.5 rounded-full bg-fillSecondary text-text-secondary hover:text-text-primary transition-colors border-0"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Price Tag Info */}
            <div className="p-4 rounded-[20px] bg-fillSecondary/50 flex flex-col space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-text-tertiary">
                Reported Price
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
              <div className="flex items-center justify-between text-xs py-1 border-b border-separator/10">
                <span className="text-text-secondary">Freshness Status</span>
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
                    ? "Confirmed Available"
                    : selectedOffer.detail.confidenceLevel === "caution"
                    ? "Likely Available"
                    : "Out of Stock"}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs py-1 border-b border-separator/10">
                <span className="text-text-secondary">Data Confidence</span>
                <span className="font-semibold text-text-primary flex items-center">
                  <CheckCircle2 className="h-3.5 w-3.5 text-accent mr-1" />
                  {selectedOffer.detail.confidenceScore}%
                </span>
              </div>
              <div className="flex items-center justify-between text-xs py-1 border-b border-separator/10">
                <span className="text-text-secondary">Data Source</span>
                <span className="font-semibold text-text-primary">
                  {selectedOffer.detail.sourceType}
                </span>
              </div>
            </div>
          </div>

          {/* Sticky Bottom Actions */}
          <div className="grid grid-cols-2 gap-3 pt-4 border-t border-separator/10">
            <Button variant="primary" size="md" className="w-full flex items-center justify-center">
              <Navigation className="h-4 w-4 mr-1.5" />
              Directions
            </Button>
            <Button variant="secondary" size="md" className="w-full flex items-center justify-center">
              <Share2 className="h-4 w-4 mr-1.5" />
              Share
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
                  {selectedPlace.address || "Yaba, Lagos"}
                </p>
              </div>
              <button
                onClick={() => setActiveMarkerId(null)}
                className="p-1.5 rounded-full bg-fillSecondary text-text-secondary hover:text-text-primary transition-colors border-0"
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
                  <Skeleton className="h-10 w-full rounded-[12px]" />
                  <Skeleton className="h-10 w-full rounded-[12px]" />
                </div>
              ) : placeOffers.length > 0 ? (
                <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-1">
                  {placeOffers.map((offer) => (
                    <div 
                      key={offer.id}
                      className="p-3 rounded-[16px] bg-fillSecondary/40 flex items-center justify-between"
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
                  <p className="text-xs text-text-secondary">No food prices reported for this market yet.</p>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-4 border-t border-separator/10">
            <Button variant="primary" size="md" className="w-full flex items-center justify-center">
              <Navigation className="h-4 w-4 mr-1.5" />
              Directions
            </Button>
            <Button variant="secondary" size="md" className="w-full flex items-center justify-center">
              <Share2 className="h-4 w-4 mr-1.5" />
              Share
            </Button>
          </div>
        </div>
      );
    }

    return undefined;
  }, [selectedOffer, selectedPlace, placeOffers, isPlaceOffersLoading, setActiveMarkerId]);

  return (
    <AdaptiveShell
      mapNode={mapNode}
      sheetNode={sheetNode}
      detailNode={detailNode}
      activeDetent={activeDetent}
      setActiveDetent={setActiveDetent}
    />
  );
}
