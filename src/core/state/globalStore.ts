import { create } from "zustand";
import { PRIMARY_LOCATION } from "@/db/lagosSouthWest";

interface LocationCoordinate {
  lat: number;
  lng: number;
}

interface GlobalState {
  // Geolocation & map positioning state
  mapCenter: LocationCoordinate;
  userLocation: LocationCoordinate | null;
  activeRadiusKm: number;
  
  // Active search & context selections
  selectedAreaName: string;
  selectedItemId: string | null;
  
  // Actions
  setMapCenter: (center: LocationCoordinate) => void;
  setUserLocation: (location: LocationCoordinate) => void;
  setActiveRadiusKm: (radius: number) => void;
  setSelectedAreaName: (name: string) => void;
  setSelectedItemId: (itemId: string | null) => void;
}

export const useGlobalStore = create<GlobalState>((set) => ({
  // Pilot opens on D Close, 6th Avenue, Festac. See lagosSouthWest.ts for how
  // the coordinate was derived — 6th Avenue is absent from the map data.
  mapCenter: { lat: PRIMARY_LOCATION.lat, lng: PRIMARY_LOCATION.lng },
  userLocation: null,
  activeRadiusKm: 5,
  selectedAreaName: "Festac",
  selectedItemId: null,

  setMapCenter: (center) => set({ mapCenter: center }),
  setUserLocation: (location) => set({ userLocation: location, mapCenter: location }),
  setActiveRadiusKm: (radius) => set({ activeRadiusKm: radius }),
  setSelectedAreaName: (name) => set({ selectedAreaName: name }),
  setSelectedItemId: (itemId) => set({ selectedItemId: itemId }),
}));
