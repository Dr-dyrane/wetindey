"use client";

import React, { useState, useEffect, useTransition } from "react";
import { useAtom } from "jotai";
import {
  Search,
  MapPin,
  Compass,
  Navigation,
  Share2,
  AlertTriangle,
  CheckCircle2,
  ArrowLeft,
  Sun,
  Moon,
  X,
  Map as MapIcon,
  List as ListIcon
} from "lucide-react";

import { Button } from "@/design-system/components/Button";
import { Input } from "@/design-system/components/Input";
import { Card } from "@/design-system/components/Card";
import { ContextLayout } from "@/design-system/components/ContextLayout";
import { MapboxCanvas } from "@/design-system/components/MapboxCanvas";
import { Skeleton, CardListSkeleton } from "@/design-system/components/Skeleton";

import { useTheme } from "@/core/context/ThemeContext";
import { useGlobalStore } from "@/core/state/globalStore";
import { sheetDetentAtom, activeMarkerIdAtom, searchFocusedAtom } from "@/core/state/uiAtoms";
import { searchFoodItems, getFoodItemCandidates } from "@/app/actions";

interface FoodItem {
  id: string;
  name: string;
  description: string | null;
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

  // React Transitions for concurrent render support (Next.js 15 optimization)
  const [isPending, startTransition] = useTransition();

  // Component States
  const [searchQuery, setSearchQuery] = useState("");
  const [popularItems, setPopularItems] = useState<FoodItem[]>([]);
  const [searchResults, setSearchResults] = useState<FoodItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<FoodItem | null>(null);
  const [matchingOffers, setMatchingOffers] = useState<Candidate[]>([]);
  const [showLocationPrompt, setShowLocationPrompt] = useState(true);
  const [_locationDenied, setLocationDenied] = useState(false);
  const [isMobileList, setIsMobileList] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isOffersLoading, setIsOffersLoading] = useState(false);

  // Load baseline popular items from the Neon database on mount
  useEffect(() => {
    startTransition(async () => {
      // Fetch staples using wildcard search
      const items = await searchFoodItems(" ");
      setPopularItems(items.slice(0, 5));
    });
  }, []);

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

  // Render Map Section Node
  const mapNode = (
    <div className="relative w-full h-full">
      <MapboxCanvas
        candidates={matchingOffers}
        selectedPlaceId={activeMarkerId}
        onMarkerClick={handleMarkerSelection}
        center={mapCenter}
      />

      {/* Location prompt modal overlay */}
      {showLocationPrompt && (
        <div className="absolute bottom-4 left-4 right-4 md:left-6 md:right-auto md:max-w-sm z-30">
          <Card className="p-4 shadow-xl border-accent/20 bg-surface/95 backdrop-blur">
            <div className="flex items-start space-x-3">
              <div className="p-2 bg-accent/10 rounded-full text-accent">
                <Compass className="h-6 w-6 animate-pulse" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-bold text-text-primary">See what’s available around you</h3>
                <p className="text-sm text-text-secondary mt-1">
                  Allow location once, or choose your area yourself.
                </p>
                <div className="mt-4 flex items-center space-x-2">
                  <Button 
                    variant="primary" 
                    size="sm" 
                    onClick={() => setShowLocationPrompt(false)} 
                    className="flex-1"
                  >
                    Use my location
                  </Button>
                  <Button 
                    variant="secondary" 
                    size="sm" 
                    onClick={() => { setLocationDenied(true); setShowLocationPrompt(false); }} 
                    className="flex-1"
                  >
                    Choose area
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );

  // Render Sliding Context Sheet Node
  const sheetNode = (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      {/* Mobile handle drawer indicator */}
      <div
        className="md:hidden flex justify-center py-2 cursor-pointer"
        onClick={() => {
          if (activeDetent === "peek") setActiveDetent("medium");
          else if (activeDetent === "medium") setActiveDetent("large");
          else setActiveDetent("peek");
        }}
      >
        <div className="w-10 h-1 bg-text-tertiary/40 rounded-full" />
      </div>

      {/* Search Header Area */}
      <div className="px-4 py-3 border-b border-separator flex flex-col space-y-2">
        {selectedItem && (
          <div className="flex items-center space-x-2 pb-1 text-accent font-semibold text-sm">
            <Button variant="ghost" size="sm" onClick={clearSearch} className="h-7 px-2 -ml-2 text-accent">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Clear search
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

        <div className="sm:hidden flex items-center text-xs font-semibold text-text-secondary">
          <MapPin className="h-3.5 w-3.5 text-accent mr-1" />
          Showing around Yaba
        </div>
      </div>

      {/* Content Scrolling Pane */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {/* A. Suggestions State (Search empty) */}
        {!searchQuery && !selectedItem && (
          <div className="space-y-4">
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-text-tertiary mb-2">
                Popular around this area
              </h4>
              <div className="grid grid-cols-1 gap-2">
                {isPending && popularItems.length === 0 ? (
                  <CardListSkeleton count={3} />
                ) : (
                  popularItems.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => handleSelectItem(item)}
                      className="flex items-center space-x-3 w-full p-3 rounded-input bg-background/50 hover:bg-background border border-separator hover:border-accent transition-all duration-micro text-left"
                    >
                      <div className="p-2 rounded-full bg-accent/10 text-accent text-sm">🛍️</div>
                      <div>
                        <div className="font-semibold text-text-primary text-sm">{item.name}</div>
                        <div className="text-xs text-text-tertiary truncate">
                          {item.description || "Fresh staple item available locally"}
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* B. Searching loading state */}
        {isSearching && (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        )}

        {/* C. Search Query matches but no item selected */}
        {searchQuery && !selectedItem && !isSearching && (
          <div className="space-y-2">
            {searchResults.length > 0 ? (
              searchResults.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleSelectItem(item)}
                  className="flex items-center justify-between w-full p-3 rounded-input bg-background/50 hover:bg-background border border-separator hover:border-accent transition-all duration-micro text-left"
                >
                  <div className="font-semibold text-text-primary text-sm">{item.name}</div>
                  <span className="text-xs text-accent">Select</span>
                </button>
              ))
            ) : (
              <div className="text-center py-10 space-y-3">
                <div className="inline-flex p-3 rounded-full bg-status-caution/10 text-status-caution">
                  <AlertTriangle className="h-8 w-8" />
                </div>
                <h3 className="text-base font-bold">We never support this item yet</h3>
                <p className="text-sm text-text-secondary max-w-[280px] mx-auto">
                  Try another name, or tell us the item you want us to add.
                </p>
                <Button variant="secondary" size="sm" className="mt-2">
                  Request Item
                </Button>
              </div>
            )}
          </div>
        )}

        {/* D. Offers loading state */}
        {isOffersLoading && <CardListSkeleton count={2} />}

        {/* E. Results State */}
        {selectedItem && !isOffersLoading && (
          <div className="space-y-3">
            <div className="pb-2 border-b border-separator flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-text-primary">{selectedItem.name}</h2>
                <p className="text-xs text-text-secondary">{matchingOffers.length} locations found</p>
              </div>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-accent/10 text-accent">
                Neon Database
              </span>
            </div>

            {matchingOffers.length > 0 ? (
              <div className="space-y-3">
                {matchingOffers.map((offer) => {
                  const isSelected = activeMarkerId === offer.placeId;

                  return (
                    <Card
                      key={offer.id}
                      hoverable
                      onClick={() => handleMarkerSelection(offer.placeId)}
                      className={`transition-all duration-standard ${
                        isSelected ? "border-accent ring-1 ring-accent" : "border-separator"
                      }`}
                    >
                      <div className="p-4 space-y-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="font-bold text-text-primary text-base">{offer.placeName}</h3>
                            <p className="text-xs text-text-secondary flex items-center mt-0.5">
                              <MapPin className="h-3 w-3 mr-1" />
                              {offer.address}
                            </p>
                          </div>
                          <span
                            className={`text-xs font-semibold px-2 py-0.5 rounded-full flex items-center space-x-1 ${
                              offer.detail.confidenceLevel === "confirmed"
                                ? "bg-status-confirmed/10 text-status-confirmed"
                                : offer.detail.confidenceLevel === "caution"
                                ? "bg-status-caution/10 text-status-caution"
                                : "bg-status-unavailable/10 text-status-unavailable"
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full mr-1 ${
                                offer.detail.confidenceLevel === "confirmed"
                                  ? "bg-status-confirmed"
                                  : offer.detail.confidenceLevel === "caution"
                                  ? "bg-status-caution"
                                  : "bg-status-unavailable"
                              }`}
                            />
                            {offer.detail.confidenceLevel === "confirmed"
                              ? "Confirmed Available"
                              : offer.detail.confidenceLevel === "caution"
                              ? "Likely Available"
                              : "Out of Stock"}
                          </span>
                        </div>

                        <div className="flex items-baseline justify-between pt-1">
                          <div>
                            <span className="text-2xl font-black text-accent">
                              {formatPrice(offer.detail.priceMin)}
                            </span>
                            {offer.detail.priceMax && (
                              <span className="text-2xl font-black text-accent">
                                {" - "}{formatPrice(offer.detail.priceMax)}
                              </span>
                            )}
                            <span className="text-xs text-text-secondary ml-1">/ {offer.detail.unit}</span>
                          </div>
                          <span className="text-xs font-semibold text-text-tertiary">
                            {offer.detail.priceType} Price
                          </span>
                        </div>

                        {/* Source Confidence indicators */}
                        <div className="pt-2 border-t border-separator flex items-center justify-between text-xs text-text-secondary">
                          <span className="flex items-center">
                            <CheckCircle2 className="h-3.5 w-3.5 text-accent mr-1" />
                            Confidence: {offer.detail.confidenceScore}%
                          </span>
                          <span className="px-1.5 py-0.5 bg-background rounded border border-separator text-[10px]">
                            {offer.detail.sourceType}
                          </span>
                        </div>

                        {/* Expanded interactive controls on card selection */}
                        {isSelected && (
                          <div className="pt-3 border-t border-separator grid grid-cols-3 gap-2 animate-fade-in">
                            <Button
                              variant="primary"
                              size="sm"
                              className="h-9 text-xs px-2 flex items-center justify-center"
                            >
                              <Navigation className="h-3.5 w-3.5 mr-1" />
                              Directions
                            </Button>
                            <Button
                              variant="secondary"
                              size="sm"
                              className="h-9 text-xs px-2 flex items-center justify-center"
                            >
                              <Share2 className="h-3.5 w-3.5 mr-1" />
                              Share
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-9 text-xs px-2 border border-dashed border-separator text-status-unavailable hover:bg-status-unavailable/5"
                            >
                              Report Issue
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
                <p className="text-sm text-text-secondary">No current offers found for this item around Yaba.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="relative w-full h-full min-h-screen overflow-hidden">
      {/* 1. Header Toolbar (Unified Top Bar) */}
      <header className="absolute top-0 left-0 right-0 z-30 h-16 px-4 bg-surface/85 backdrop-blur border-b border-separator flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="h-8 w-8 rounded-lg bg-accent flex items-center justify-center text-white font-bold text-lg">
            W
          </div>
          <span className="font-bold text-lg tracking-tight">WetinDey</span>
        </div>

        <div className="flex items-center space-x-2">
          <div className="hidden sm:flex items-center bg-background px-3 py-1.5 rounded-full text-xs font-semibold text-text-secondary border border-separator">
            <MapPin className="h-3.5 w-3.5 text-accent mr-1" />
            Showing around Yaba
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={toggleTheme}
            className="w-9 h-9 p-0 rounded-full"
            aria-label="Toggle theme"
          >
            {theme === "dark" ? <Sun className="h-5 w-5 text-accent" /> : <Moon className="h-5 w-5 text-text-secondary" />}
          </Button>
        </div>
      </header>

      {/* 2. Severe Modular Monolith Context Layout */}
      <ContextLayout
        mapNode={mapNode}
        sheetNode={sheetNode}
        isMobileListActive={isMobileList}
      />

      {/* 3. Mobile Toggle Bar (Toggles between Map & List view) */}
      <footer className="md:hidden absolute bottom-4 left-1/2 -translate-x-1/2 z-30 bg-surface/90 dark:bg-surface-elevated/90 backdrop-blur shadow-xl border border-separator px-4 py-2 rounded-full flex items-center space-x-2">
        <Button
          variant={isMobileList ? "secondary" : "primary"}
          size="sm"
          onClick={() => setIsMobileList(false)}
          className="rounded-full h-9 px-4 text-xs font-bold"
        >
          <MapIcon className="h-3.5 w-3.5 mr-1" />
          Map View
        </Button>
        <Button
          variant={isMobileList ? "primary" : "secondary"}
          size="sm"
          onClick={() => setIsMobileList(true)}
          className="rounded-full h-9 px-4 text-xs font-bold"
        >
          <ListIcon className="h-3.5 w-3.5 mr-1" />
          List View
        </Button>
      </footer>
    </div>
  );
}
