"use client";

import React, { useState, useEffect, useMemo } from "react";
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
import { FoodModule } from "@/modules/food/application/FoodModule";
import { FoodItem, FoodDetail } from "@/modules/food/domain/types";
import { Candidate } from "@/core/module-contract";

// Map Place definitions for Map rendering
const MOCK_PLACES = [
  { id: "p1", name: "Tejuosho Market", distance: "0.4 km away", lat: 35, lng: 40 },
  { id: "p2", name: "Oyinbo Market", distance: "1.2 km away", lat: 65, lng: 30 },
  { id: "p3", name: "Yaba Bus Stop Kiosk", distance: "0.2 km away", lat: 45, lng: 55 },
  { id: "p4", name: "Sabo Market Stall 12", distance: "0.8 km away", lat: 20, lng: 60 },
];

export default function HomePage() {
  // Instantiate the modular class-based controllers
  const foodModule = useMemo(() => new FoodModule(), []);

  const [darkMode, setDarkMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [popularItems, setPopularItems] = useState<FoodItem[]>([]);
  const [searchResults, setSearchResults] = useState<FoodItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<FoodItem | null>(null);
  const [matchingOffers, setMatchingOffers] = useState<Candidate<FoodDetail>[]>([]);
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const [showLocationPrompt, setShowLocationPrompt] = useState(true);
  const [locationDenied, setLocationDenied] = useState(false);
  const [isMobileList, setIsMobileList] = useState(false);
  const [activeDetent, setActiveDetent] = useState<"peek" | "medium" | "large">("medium");

  // Load baseline popular items on mount
  useEffect(() => {
    foodModule.search.resolve("a", "en").then((items) => {
      setPopularItems(items.slice(0, 5));
    });
  }, [foodModule]);

  // Effect to toggle CSS theme class
  useEffect(() => {
    const root = window.document.documentElement;
    if (darkMode) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, [darkMode]);

  // Asynchronously resolve search terms against the FoodModule resolve API
  const handleSearchChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchQuery(val);

    if (val.trim() === "") {
      setSelectedItem(null);
      setSearchResults([]);
      return;
    }

    const matchedItems = await foodModule.search.resolve(val, "en");
    setSearchResults(matchedItems);

    // Auto-select exact or top match for instant user preview
    if (matchedItems.length > 0) {
      setSelectedItem(matchedItems[0]);
    } else {
      setSelectedItem(null);
    }
  };

  const selectSuggestion = (item: FoodItem) => {
    setSelectedItem(item);
    setSearchQuery(item.name);
  };

  const handleLocationDeny = () => {
    setLocationDenied(true);
    setShowLocationPrompt(false);
  };

  const handleLocationGrant = () => {
    setLocationDenied(false);
    setShowLocationPrompt(false);
  };

  // Retrieve matching candidate details when an item is selected
  useEffect(() => {
    if (selectedItem) {
      foodModule.discovery
        .getCandidates({
          item: selectedItem,
          lat: 6.5244, // Yaba coordinates
          lng: 3.3792,
          radiusKm: 5,
        })
        .then((candidates) => {
          setMatchingOffers(candidates);
        });
    } else {
      setMatchingOffers([]);
    }
  }, [selectedItem, foodModule]);

  const handleMarkerClick = (placeId: string) => {
    setSelectedPlaceId(placeId);
    setActiveDetent("medium");
  };

  const clearSearch = () => {
    setSearchQuery("");
    setSelectedItem(null);
    setSelectedPlaceId(null);
    setSearchResults([]);
  };

  return (
    <div className="relative w-full h-full min-h-screen flex flex-col md:flex-row overflow-hidden bg-background text-text-primary">
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
            onClick={() => setDarkMode(!darkMode)}
            className="w-9 h-9 p-0 rounded-full"
            aria-label="Toggle theme"
          >
            {darkMode ? <Sun className="h-5 w-5 text-accent" /> : <Moon className="h-5 w-5 text-text-secondary" />}
          </Button>
        </div>
      </header>

      {/* 2. Interactive SVG Map Canvas */}
      <main
        className={`relative flex-1 h-full w-full pt-16 transition-all duration-standard ${
          isMobileList ? "hidden md:block" : "block"
        }`}
      >
        <div className="absolute inset-0 bg-[#E5E4E0] dark:bg-[#1A1917] overflow-hidden">
          {/* Subtle grid to simulate streets */}
          <svg className="w-full h-full opacity-35 dark:opacity-20" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="1" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
            {/* Mock roads */}
            <path d="M 0,150 Q 300,120 600,200 T 1200,100" fill="none" stroke="currentColor" strokeWidth="16" />
            <path d="M 150,0 Q 250,400 200,800" fill="none" stroke="currentColor" strokeWidth="24" />
            <path d="M 400,0 C 450,300 500,450 600,900" fill="none" stroke="currentColor" strokeWidth="12" />
          </svg>

          {/* User Mock Location */}
          {!locationDenied && (
            <div className="absolute top-[48%] left-[50%] -translate-x-1/2 -translate-y-1/2 flex items-center justify-center">
              <span className="absolute inline-flex h-12 w-12 rounded-full bg-accent/25 animate-ping" />
              <span className="relative inline-flex rounded-full h-4 w-4 bg-accent border-2 border-white dark:border-black shadow-lg" />
            </div>
          )}

          {/* Map markers for matching offers resolved through FoodModule */}
          {selectedItem &&
            matchingOffers.map((offer) => {
              const place = MOCK_PLACES.find((p) => p.id === offer.placeId);
              if (!place) return null;
              const isSelected = selectedPlaceId === place.id;

              return (
                <button
                  key={place.id}
                  onClick={() => handleMarkerClick(place.id)}
                  style={{ top: `${place.lat}%`, left: `${place.lng}%` }}
                  className={`absolute -translate-x-1/2 -translate-y-1/2 p-2 rounded-full transition-all duration-standard flex flex-col items-center ${
                    isSelected ? "scale-110 z-20" : "scale-100 z-10 hover:scale-105"
                  }`}
                >
                  <div
                    className={`h-9 w-9 rounded-full flex items-center justify-center shadow-lg border-2 ${
                      isSelected ? "border-white dark:border-black" : "border-transparent"
                    } ${
                      offer.detail.confidenceLevel === "confirmed"
                        ? "bg-status-confirmed text-white"
                        : offer.detail.confidenceLevel === "caution"
                        ? "bg-status-caution text-white"
                        : "bg-status-unavailable text-white"
                    }`}
                  >
                    <MapPin className="h-5 w-5" />
                  </div>
                  <div className="mt-1 bg-surface/90 dark:bg-surface-elevated/90 backdrop-blur px-2 py-0.5 rounded text-[10px] font-bold shadow border border-separator text-text-primary max-w-[80px] truncate">
                    {place.name}
                  </div>
                </button>
              );
            })}
        </div>

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
                    <Button variant="primary" size="sm" onClick={handleLocationGrant} className="flex-1">
                      Use my location
                    </Button>
                    <Button variant="secondary" size="sm" onClick={handleLocationDeny} className="flex-1">
                      Choose area
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        )}
      </main>

      {/* 3. Sliding Context Sheet (Side panel on desktop, bottom sheet on mobile) */}
      <section
        className={`w-full md:w-[420px] bg-surface/95 dark:bg-surface-elevated/95 backdrop-blur md:border-r border-separator z-20 flex flex-col transition-all duration-sheet shadow-2xl md:shadow-lg ${
          isMobileList ? "flex-1 h-full pt-16" : "h-[45vh] md:h-screen pt-16 md:pt-16"
        } ${activeDetent === "large" ? "h-[85vh]" : activeDetent === "peek" ? "h-[18vh]" : ""}`}
      >
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
          {!searchQuery && (
            <div className="space-y-4">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-text-tertiary mb-2">
                  Popular around this area
                </h4>
                <div className="grid grid-cols-1 gap-2">
                  {popularItems.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => selectSuggestion(item)}
                      className="flex items-center space-x-3 w-full p-3 rounded-input bg-background/50 hover:bg-background border border-transparent hover:border-separator transition-all duration-micro text-left"
                    >
                      <div className="p-2 rounded-full bg-accent/10 text-accent text-sm">🛍️</div>
                      <div>
                        <div className="font-semibold text-text-primary text-sm">{item.name}</div>
                        <div className="text-xs text-text-tertiary truncate">{item.aliases.join(", ")}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* B. Search Query matches but no item selected */}
          {searchQuery && searchResults.length === 0 && (
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

          {/* C. Results State */}
          {selectedItem && (
            <div className="space-y-3">
              <div className="pb-2 border-b border-separator flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-text-primary">{selectedItem.name}</h2>
                  <p className="text-xs text-text-secondary">{matchingOffers.length} locations found</p>
                </div>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-accent/10 text-accent">
                  Food Module
                </span>
              </div>

              {/* Offer Card Listings dynamically powered by modular candidates */}
              {matchingOffers.length > 0 ? (
                <div className="space-y-3">
                  {matchingOffers.map((offer) => {
                    const place = MOCK_PLACES.find((p) => p.id === offer.placeId);
                    if (!place) return null;
                    const isSelected = selectedPlaceId === place.id;

                    return (
                      <Card
                        key={offer.id}
                        hoverable
                        onClick={() => setSelectedPlaceId(place.id)}
                        className={`transition-all duration-standard ${
                          isSelected ? "border-accent ring-1 ring-accent" : "border-separator"
                        }`}
                      >
                        <div className="p-4 space-y-3">
                          <div className="flex items-start justify-between">
                            <div>
                              <h3 className="font-bold text-text-primary text-base">{place.name}</h3>
                              <p className="text-xs text-text-secondary flex items-center mt-0.5">
                                <MapPin className="h-3 w-3 mr-1" />
                                {place.distance}
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
                              {offer.detail.freshnessText}
                            </span>
                          </div>

                          <div className="flex items-baseline justify-between pt-1">
                            <div>
                              <span className="text-2xl font-black text-accent">{offer.detail.price}</span>
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
                                Go
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
                                Report
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
      </section>

      {/* 4. Mobile Toggle Bar (Toggles between Map & List view) */}
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
