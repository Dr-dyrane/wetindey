import { create } from "zustand";
import { PRIMARY_LOCATION } from "@/db/lagosSouthWest";

/**
 * What is left of the global store after the location work landed.
 *
 * Three field/setter pairs were removed here, each confirmed dead by grep
 * before deletion:
 *
 *   · `userLocation` / `setUserLocation` — the setter also wrote `mapCenter`,
 *     and the field itself was read by nothing, ever. Superseded wholesale by
 *     `locationStore`, which carries the one fact this pair could not: WHERE THE
 *     POSITION CAME FROM. A simulated drop and a real device fix produced an
 *     identical `{lat, lng}` here, so the chrome could not tell "we found you"
 *     from "we assumed" — and every distance the map prints is measured from it.
 *   · `selectedAreaName` / `setSelectedAreaName` — the field was pinned to the
 *     literal "Festac" at creation and the setter was never called from
 *     anywhere, which is why the location pill was a label rather than a claim.
 *     `useLocationChrome()` owns the label now, and only the label — qualifying
 *     the position is the caller's own job, off `locationStore.provenance`.
 *   · `selectedItemId` / `setSelectedItemId` — write-only. page.tsx set it in
 *     three places; no file ever read it. The item the user picked is local to
 *     the surface asking about it (ItemDetailSheet), not global.
 *
 * What remains is genuinely global: the camera anchor, and the search radius.
 */
interface LocationCoordinate {
  lat: number;
  lng: number;
}

interface GlobalState {
  /**
   * Where the camera is pointed. NOT where the user is — `locationStore.position`
   * is that, and it is the thing queries and distances measure from. This
   * follows it, and also moves on its own when the user taps a result.
   */
  mapCenter: LocationCoordinate;
  activeRadiusKm: number;

  setMapCenter: (center: LocationCoordinate) => void;
  setActiveRadiusKm: (radius: number) => void;
}

export const useGlobalStore = create<GlobalState>((set) => ({
  // Pilot opens on D Close, 6th Avenue, Festac. See lagosSouthWest.ts for how
  // the coordinate was derived — 6th Avenue is absent from the map data.
  mapCenter: { lat: PRIMARY_LOCATION.lat, lng: PRIMARY_LOCATION.lng },
  activeRadiusKm: 5,

  setMapCenter: (center) => set({ mapCenter: center }),
  setActiveRadiusKm: (radius) => set({ activeRadiusKm: radius }),
}));
