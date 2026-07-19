import { useEffect } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { PRIMARY_LOCATION } from "@/db/lagosSouthWest";

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
 * So provenance is not metadata here. It is a required field of the position and
 * it survives reloads with the coordinate. The caveat it earns is rendered at the
 * point of choice: LocationSheet marks the selected row "Area centre" when the
 * provenance is `manual`, so the qualifier sits next to the area the user is
 * picking rather than travelling with the label everywhere the label goes.
 */
export type LocationProvenance =
  /**
   * Legacy. No setter produces this: `simulate()` was the only writer and its
   * one caller went away with coordinate entry. It stays in the union because
   * the persist key and version did not change when that happened, so a browser
   * that ran the earlier build rehydrates a `simulated` position into this store
   * today. Narrowing the union would not delete those; it would only stop the
   * type describing them.
   */
  | "simulated"
  /**
   * The user picked their area off the administrative tree. Self-declared, and
   * precise only to the area's centre — so it is not a fix, but picking the area
   * you are standing in is an answer, not a pretence. The caveat it earns is
   * about precision ("we measure from the middle of your area"), not honesty.
   */
  | "manual"
  /** `navigator.geolocation` answered. The only provenance that is the truth. */
  | "device"
  /** Nobody has chosen yet — the pilot's opening coordinate. */
  | "default";

/* Not exported: the store exposes position via useLocationStore(), and no
   external file imports UserPosition by name. */
interface UserPosition {
  lat: number;
  lng: number;
  provenance: LocationProvenance;
  /**
   * Name of the area this position sits in, when we know one. Null is a real
   * and expected state: a device fix outside every area we cover has no name to
   * give, and inventing one to fill the label would be the same lie in a smaller
   * font. `useLocationChrome()` falls back to the coordinate itself.
   */
  areaName: string | null;
  /** Slug of the chosen area, so a list can mark the current row. */
  areaSlug: string | null;
  /** Epoch ms. A device fix from an hour ago is not the same claim as one now. */
  setAt: number;
}

interface PersistedLocationState {
  position: UserPosition;
}

const DEFAULT_POSITION: UserPosition = {
  lat: PRIMARY_LOCATION.lat,
  lng: PRIMARY_LOCATION.lng,
  provenance: "default",
  areaName: "Festac Town",
  areaSlug: "festac",
  setAt: 0,
};

function persistedUserPosition(value: unknown): UserPosition | null {
  if (typeof value !== "object" || value === null) return null;
  const position = value as Record<string, unknown>;
  const provenance = position.provenance;
  if (
    provenance !== "simulated" &&
    provenance !== "manual" &&
    provenance !== "device" &&
    provenance !== "default"
  )
    return null;
  if (
    typeof position.lat !== "number" ||
    !Number.isFinite(position.lat) ||
    typeof position.lng !== "number" ||
    !Number.isFinite(position.lng) ||
    (position.areaName !== null && typeof position.areaName !== "string") ||
    (position.areaSlug !== null && typeof position.areaSlug !== "string") ||
    typeof position.setAt !== "number" ||
    !Number.isFinite(position.setAt)
  )
    return null;

  return {
    lat: position.lat,
    lng: position.lng,
    provenance,
    areaName: position.areaName,
    areaSlug: position.areaSlug,
    setAt: position.setAt,
  };
}

/**
 * Move only the untouched synthetic default to the canonical Festac centre.
 * Every chosen, simulated, or device-derived coordinate belongs to the user
 * and survives byte-for-byte in meaning; a release must never turn a real GPS
 * fix into the product's default merely because the persisted version changed.
 */
export function migratePersistedLocationState(
  persistedState: unknown,
  _version: number
): PersistedLocationState {
  if (typeof persistedState !== "object" || persistedState === null)
    return { position: DEFAULT_POSITION };

  const position = persistedUserPosition(
    (persistedState as Record<string, unknown>).position
  );
  if (!position || position.provenance === "default")
    return { position: DEFAULT_POSITION };

  return { position };
}

/** 4 dp ≈ 11 m. Enough to name a block, not enough to imply a doorway. */
export function formatCoordinate(lat: number, lng: number): string {
  return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
}


interface LocationState {
  position: UserPosition;
  /**
   * False until the persisted position has been read back. The chrome renders
   * on the server with the default, so anything that would flash a stale label
   * can wait one frame on this rather than mismatching hydration.
   */
  hydrated: boolean;

  /** Commit a chosen area's centre. `areaName` is null when no area contains it. */
  setManualPoint: (input: { lat: number; lng: number; areaName: string | null; areaSlug: string | null }) => void;
  /** Commit a real `navigator.geolocation` fix. The only honest "you are here". */
  setDevicePoint: (input: { lat: number; lng: number; areaName: string | null; areaSlug: string | null }) => void;
  /** Back to the pilot's opening coordinate, provenance and all. */
  resetToDefault: () => void;
  setHydrated: (v: boolean) => void;
}

/**
 * Zustand calls `migrate` only for a version mismatch. Validate again in
 * `merge`, which runs for every hydration, so a malformed payload that already
 * claims the current version cannot replace the live position with null or an
 * incomplete object. Default provenance is normalized on every path; the other
 * three provenances retain their validated coordinate and metadata.
 */
export function mergePersistedLocationState(
  persistedState: unknown,
  currentState: LocationState
): LocationState {
  const position =
    typeof persistedState === "object" && persistedState !== null
      ? persistedUserPosition(
          (persistedState as Record<string, unknown>).position
        )
      : null;

  return {
    ...currentState,
    position:
      position && position.provenance !== "default"
        ? position
        : DEFAULT_POSITION,
  };
}

export const LOCATION_STORAGE_KEY = "wetindey.location.v1";

export const useLocationStore = create<LocationState>()(
  persist(
    (set) => ({
      position: DEFAULT_POSITION,
      hydrated: false,

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
      // Payload version, independent of the long-lived localStorage key name.
      // Version 2 moves only the synthetic default; migrate preserves every
      // user-chosen, simulated, and device-GPS coordinate.
      version: 2,
      migrate: migratePersistedLocationState,
      merge: mergePersistedLocationState,
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
  /** The area's name, or its coordinate when no area contains it. Never empty. */
  label: string;
}

/**
 * The position's name, resolved for display.
 *
 * This is a label, not a claim: it says which area is on screen, and nothing
 * about whether the position is really yours. Callers that need to qualify the
 * position — to say a distance is measured from an area's centre rather than
 * from the user — must read `provenance` off `useLocationStore` and say so
 * themselves. LocationSheet is where that happens today, on the selected row.
 *
 * Read `useLocationStore((s) => s.position)` directly for the coordinate; a
 * label deriver has no business handing out the whole position.
 */
export function useLocationChrome(): LocationChrome {
  const position = useLocationStore((s) => s.position);
  return {
    label: position.areaName ?? formatCoordinate(position.lat, position.lng),
  };
}
