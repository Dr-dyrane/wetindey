import { useEffect } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { PRIMARY_LOCATION } from "@/db/lagosSouthWest";
import type { StatusKind } from "@/design-system/components/StatusBadge";

/**
 * The single owner of "where am I".
 *
 * This supersedes three dead members of `globalStore`:
 *
 *   · `userLocation`        — written by `setUserLocation`, read by nothing.
 *   · `setSelectedAreaName` — never called by anything.
 *   · `selectedAreaName`    — pinned to the literal `"Festac"` at creation, so
 *                             the pill has always been a label, not a claim.
 *
 * The reason those three could never add up to a working position is that they
 * carried a coordinate and a name but not the one fact the UI has to state:
 * WHERE THE POSITION CAME FROM. A simulated drop, a typed coordinate, a device
 * fix and an untouched default all produced the identical `{lat, lng}`, so the
 * chrome had no way to distinguish "we found you" from "we assumed". On a
 * wayfinding surface that difference is the whole message — presenting a
 * simulated position as a real one is a lie, and distances measured from a
 * default the user never chose are worse than no distances at all.
 *
 * So provenance is not metadata here. It is a required field of the position,
 * it survives reloads with the coordinate, and `useLocationChrome()` exists to
 * make it impossible to render the position without it.
 */
export type LocationProvenance =
  /** The user picked a named area off the list to stand in. Not a real fix. */
  | "simulated"
  /** The user typed a coordinate. Also not a real fix. */
  | "manual"
  /** `navigator.geolocation` answered. The only provenance that is the truth. */
  | "device"
  /** Nobody has chosen yet — the pilot's opening coordinate. */
  | "default";

export interface UserPosition {
  lat: number;
  lng: number;
  provenance: LocationProvenance;
  /**
   * Name of the area this position sits in, when we know one. Null is a real
   * and expected state: a manual coordinate in the middle of nowhere has no
   * area, and inventing one to fill the label would be the same lie in a
   * smaller font. `useLocationChrome()` falls back to the coordinate itself.
   */
  areaName: string | null;
  /** Slug of the chosen area, so a list can mark the current row. */
  areaSlug: string | null;
  /** Epoch ms. A device fix from an hour ago is not the same claim as one now. */
  setAt: number;
}

/**
 * Nigeria's bounding box, in degrees.
 *
 * Used to reject typed coordinates, never to clamp them. Clamping a typo into
 * the box would silently move the user somewhere they did not ask to be, which
 * is exactly the class of bug `geographyPoint.fromDriver` used to have when it
 * answered {0,0} and parked the whole country in the Gulf of Guinea. Say no.
 */
export const NIGERIA_BBOX = {
  minLat: 4.2407,
  maxLat: 13.8659,
  minLng: 2.6769,
  maxLng: 14.6776,
} as const;

/** The pilot's opening position: D Close, 6th Avenue, Festac. */
const DEFAULT_POSITION: UserPosition = {
  lat: PRIMARY_LOCATION.lat,
  lng: PRIMARY_LOCATION.lng,
  provenance: "default",
  areaName: "Festac Town",
  areaSlug: "festac",
  setAt: 0,
};

/** 4 dp ≈ 11 m. Enough to name a block, not enough to imply a doorway. */
export function formatCoordinate(lat: number, lng: number): string {
  return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
}

export type CoordinateParse =
  | { ok: true; lat: number; lng: number }
  | { ok: false; field: "lat" | "lng" | "both"; message: string };

/**
 * Parse and bounds-check a typed coordinate.
 *
 * Every rejection names the offending number and the range it missed, because
 * "Invalid coordinate" tells a tester nothing about which of the two fields
 * they fat-fingered or by how much.
 */
export function parseCoordinateInput(latRaw: string, lngRaw: string): CoordinateParse {
  const latText = latRaw.trim();
  const lngText = lngRaw.trim();

  if (!latText && !lngText) {
    return { ok: false, field: "both", message: "Enter a latitude and a longitude. Example: 6.4641, 3.2753." };
  }
  if (!latText) return { ok: false, field: "lat", message: "Latitude is empty." };
  if (!lngText) return { ok: false, field: "lng", message: "Longitude is empty." };

  const lat = Number(latText);
  const lng = Number(lngText);

  if (!Number.isFinite(lat)) {
    return { ok: false, field: "lat", message: `“${latText}” isn’t a number. Use decimal degrees, like 6.4641.` };
  }
  if (!Number.isFinite(lng)) {
    return { ok: false, field: "lng", message: `“${lngText}” isn’t a number. Use decimal degrees, like 3.2753.` };
  }

  const latOut = lat < NIGERIA_BBOX.minLat || lat > NIGERIA_BBOX.maxLat;
  const lngOut = lng < NIGERIA_BBOX.minLng || lng > NIGERIA_BBOX.maxLng;

  // A swapped pair is the commonest typo in Lagos coordinates — lat ~6, lng ~3,
  // both small, both plausible-looking. Naming it saves the tester the guess.
  if ((latOut || lngOut) && !(lng < NIGERIA_BBOX.minLat || lng > NIGERIA_BBOX.maxLat) && !(lat < NIGERIA_BBOX.minLng || lat > NIGERIA_BBOX.maxLng)) {
    return {
      ok: false,
      field: "both",
      message: `${formatCoordinate(lat, lng)} is outside Nigeria, but ${formatCoordinate(lng, lat)} is inside it. Are the two swapped?`,
    };
  }

  if (latOut) {
    return {
      ok: false,
      field: "lat",
      message: `Latitude ${lat} is outside Nigeria. It has to be between ${NIGERIA_BBOX.minLat} and ${NIGERIA_BBOX.maxLat}.`,
    };
  }
  if (lngOut) {
    return {
      ok: false,
      field: "lng",
      message: `Longitude ${lng} is outside Nigeria. It has to be between ${NIGERIA_BBOX.minLng} and ${NIGERIA_BBOX.maxLng}.`,
    };
  }

  return { ok: true, lat, lng };
}

interface LocationState {
  position: UserPosition;
  /**
   * False until the persisted position has been read back. The chrome renders
   * on the server with the default, so anything that would flash a stale label
   * can wait one frame on this rather than mismatching hydration.
   */
  hydrated: boolean;

  /** Drop onto a named area from the list. Simulated, and labelled as such. */
  simulate: (area: { name: string; slug: string; lat: number; lng: number }) => void;
  /** Commit a typed coordinate. `areaName` is null when no area contains it. */
  setManualPoint: (input: { lat: number; lng: number; areaName: string | null; areaSlug: string | null }) => void;
  /** Commit a real `navigator.geolocation` fix. The only honest "you are here". */
  setDevicePoint: (input: { lat: number; lng: number; areaName: string | null; areaSlug: string | null }) => void;
  /** Back to the pilot's opening coordinate, provenance and all. */
  resetToDefault: () => void;
  setHydrated: (v: boolean) => void;
}

export const LOCATION_STORAGE_KEY = "wetindey.location.v1";

export const useLocationStore = create<LocationState>()(
  persist(
    (set) => ({
      position: DEFAULT_POSITION,
      hydrated: false,

      simulate: (area) =>
        set({
          position: {
            lat: area.lat,
            lng: area.lng,
            provenance: "simulated",
            areaName: area.name,
            areaSlug: area.slug,
            setAt: Date.now(),
          },
        }),

      setManualPoint: (input) =>
        set({
          position: {
            lat: input.lat,
            lng: input.lng,
            provenance: "manual",
            areaName: input.areaName,
            areaSlug: input.areaSlug,
            setAt: Date.now(),
          },
        }),

      setDevicePoint: (input) =>
        set({
          position: {
            lat: input.lat,
            lng: input.lng,
            provenance: "device",
            areaName: input.areaName,
            areaSlug: input.areaSlug,
            setAt: Date.now(),
          },
        }),

      resetToDefault: () => set({ position: DEFAULT_POSITION }),
      setHydrated: (v) => set({ hydrated: v }),
    }),
    {
      name: LOCATION_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      // Only the position persists. `hydrated` is a fact about this tab.
      partialize: (s) => ({ position: s.position }),
      /**
       * The server renders the default position; rehydrating during module
       * init would make the first client render disagree with it and React
       * would throw the tree away. `useLocationHydration()` rehydrates in an
       * effect instead, after the first paint has matched.
       */
      skipHydration: true,
      onRehydrateStorage: () => (state, error) => {
        if (error) console.error("locationStore: rehydrate failed", error);
        state?.setHydrated(true);
      },
      version: 1,
    }
  )
);

/**
 * Rehydrate the persisted position exactly once, on the client, after mount.
 * Call this from the shell (page.tsx) — the store is inert without it and will
 * sit on the default forever.
 */
export function useLocationHydration(): boolean {
  const hydrated = useLocationStore((s) => s.hydrated);
  useEffect(() => {
    // Module-scoped guard, so a remount or StrictMode's double-invoke cannot
    // re-read storage and stomp a position the user has already changed in
    // this session.
    if (rehydrateStarted) return;
    rehydrateStarted = true;
    void useLocationStore.persist.rehydrate();
  }, []);
  return hydrated;
}

let rehydrateStarted = false;

export interface LocationChrome {
  /** What the pill says after "Showing ". Never empty. */
  label: string;
  provenance: LocationProvenance;
  /** The one boolean the map chrome must not be able to forget to check. */
  isSimulated: boolean;
  /**
   * A short honest tag to sit beside the label, or null when the position is
   * a real device fix and needs no qualifier. Colour is never the only signal —
   * the tag always carries words.
   */
  tag: { kind: StatusKind; label: string } | null;
  position: UserPosition;
}

const TAGS: Record<LocationProvenance, { kind: StatusKind; label: string } | null> = {
  // Caution, not info: a position you invented is a caveat on every distance
  // the map prints from it.
  simulated: { kind: "caution", label: "Simulated" },
  manual: { kind: "caution", label: "Manual pin" },
  device: null,
  default: { kind: "info", label: "Default area" },
};

/**
 * Everything the "Showing X" chrome needs, and nothing it can render without.
 *
 * The chrome reads this rather than `position` directly, so the qualifier
 * travels with the label by construction and cannot be dropped by a caller who
 * only wanted the name.
 */
export function useLocationChrome(): LocationChrome {
  const position = useLocationStore((s) => s.position);
  return {
    label: position.areaName ?? formatCoordinate(position.lat, position.lng),
    provenance: position.provenance,
    isSimulated: position.provenance === "simulated",
    tag: TAGS[position.provenance],
    position,
  };
}
