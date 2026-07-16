import { create } from "zustand";

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
  // Default coordinates centered on Yaba, Lagos, Nigeria
  mapCenter: { lat: 6.5178, lng: 3.3798 },
  userLocation: null,
  activeRadiusKm: 5,
  selectedAreaName: "Yaba",
  selectedItemId: null,

  setMapCenter: (center) => set({ mapCenter: center }),
  setUserLocation: (location) => set({ userLocation: location, mapCenter: location }),
  setActiveRadiusKm: (radius) => set({ activeRadiusKm: radius }),
  setSelectedAreaName: (name) => set({ selectedAreaName: name }),
  setSelectedItemId: (itemId) => set({ selectedItemId: itemId }),
}));
