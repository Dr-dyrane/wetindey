import { AlertTriangle, MapPin, Navigation, Sun, Moon, X } from "lucide-react";
import {
  MapboxCanvas,
  MapRecenterControl,
  type MapCameraHandle
} from "@/design-system/components/MapboxCanvas";
import type { RouteGeometry } from "@/integrations/maps/MapboxAdapter";
import {
  type Detent,
  type MapRetryCapability
} from "@/design-system/components/BottomSheet";
import type { DeviceLocation } from "@/core/state/locationStore";

// Export standard types for the presentation component
export type { MapCameraHandle, RouteGeometry, Detent, MapRetryCapability, DeviceLocation };

// Export internal component references
export { MapboxCanvas, MapRecenterControl };

// Export icons
export { AlertTriangle, MapPin, Navigation, Sun, Moon, X };

export interface MapPresentationProps {
  mapMarkers: Array<{
    id: string;
    placeId: string;
    placeName: string;
    placeType: string;
    lat: number;
    lng: number;
    address: string;
    detail?: { confidenceLevel: string };
  }>;
  selectedPlaceId: string | null;
  onMarkerClick: (placeId: string) => void;
  cameraCenter: { lat: number; lng: number };
  selfIdentity: { name: string; avatarUrl: string | null } | null;
  route: RouteGeometry | null;
  activeDetent: Detent;
  leadingInset: number;
  isRegular: boolean;
  locationLabel: string;
  theme: "light" | "dark";
  toggleTheme: () => void;
  openLocationSurface: () => void;
  handleRecenter: (deviceLocation: DeviceLocation) => void;
  locateError: string | null;
  setLocateError: (err: string | null) => void;
  dismissLocateError: () => void;
  onRetryCapabilityChange: (cap: MapRetryCapability | null) => void;
}
