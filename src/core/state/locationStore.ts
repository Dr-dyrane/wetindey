import { useEffect, useState } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { PRIMARY_LOCATION } from "@/db/lagosSouthWest";

export const DEVICE_LOCATION_FRESH_MS = 5 * 60 * 1000;
export const ROUTE_ORIGIN_FRESH_MS = 60 * 1000;

export type BrowsingLocationProvenance =
  | "simulated"
  | "manual"
  | "device"
  | "default";

export interface BrowsingLocation {
  lat: number;
  lng: number;
  provenance: BrowsingLocationProvenance;
  areaName: string | null;
  areaSlug: string | null;
  setAt: number;
}

export interface DeviceLocation {
  lat: number;
  lng: number;
  accuracyM: number;
  capturedAt: number;
  receivedAt: number;
  provenance: "device";
}

export type DeviceLocationProblemCode =
  | "insecure"
  | "unsupported"
  | "permission-denied"
  | "unavailable"
  | "timeout"
  | "invalid"
  | "stale"
  | "unknown";

export interface DeviceLocationProblem {
  code: DeviceLocationProblemCode;
  title: string;
  message: string;
  canRetry: boolean;
}

export type DeviceLocationResult =
  | { ok: true; location: DeviceLocation }
  | { ok: false; problem: DeviceLocationProblem };

interface PersistedLocationState {
  browsingLocation: BrowsingLocation;
}

const DEFAULT_BROWSING_LOCATION: BrowsingLocation = {
  lat: PRIMARY_LOCATION.lat,
  lng: PRIMARY_LOCATION.lng,
  provenance: "default",
  areaName: "Festac Town",
  areaSlug: "festac",
  setAt: 0,
};

function persistedBrowsingLocation(value: unknown): BrowsingLocation | null {
  if (typeof value !== "object" || value === null) return null;
  const location = value as Record<string, unknown>;
  const provenance = location.provenance;
  if (
    provenance !== "simulated" &&
    provenance !== "manual" &&
    provenance !== "device" &&
    provenance !== "default"
  )
    return null;
  if (
    typeof location.lat !== "number" ||
    !Number.isFinite(location.lat) ||
    location.lat < -90 ||
    location.lat > 90 ||
    typeof location.lng !== "number" ||
    !Number.isFinite(location.lng) ||
    location.lng < -180 ||
    location.lng > 180 ||
    (location.areaName !== null && typeof location.areaName !== "string") ||
    (location.areaSlug !== null && typeof location.areaSlug !== "string") ||
    typeof location.setAt !== "number" ||
    !Number.isFinite(location.setAt)
  )
    return null;

  return {
    lat: location.lat,
    lng: location.lng,
    provenance,
    areaName: location.areaName,
    areaSlug: location.areaSlug,
    setAt: location.setAt,
  };
}

function persistedLocationCandidate(value: unknown): BrowsingLocation | null {
  if (typeof value !== "object" || value === null) return null;
  const state = value as Record<string, unknown>;
  return (
    persistedBrowsingLocation(state.browsingLocation) ??
    persistedBrowsingLocation(state.position)
  );
}

/**
 * Versions before browsing/device separation could persist an outside-coverage
 * physical fix as the browsing origin. New device selection writes an area slug
 * only after coverage succeeds, so a persisted device origin without one is
 * legacy physical evidence and must fall back to the canonical Lagos default.
 */
function canonicalPersistedBrowsingLocation(
  candidate: BrowsingLocation | null
): BrowsingLocation {
  if (
    !candidate ||
    candidate.provenance === "default" ||
    (candidate.provenance === "device" && candidate.areaSlug === null)
  ) {
    return DEFAULT_BROWSING_LOCATION;
  }
  return candidate;
}

/**
 * Versions 1–2 persisted the overloaded field as `position`. A device-derived
 * value survives only as the browsing choice it already represented; it never
 * rehydrates physical evidence into the new session-only `deviceLocation`.
 */
export function migratePersistedLocationState(
  persistedState: unknown,
  _version: number
): PersistedLocationState {
  const candidate = persistedLocationCandidate(persistedState);
  return {
    browsingLocation: canonicalPersistedBrowsingLocation(candidate),
  };
}

/** 4 dp ≈ 11 m. Used for a browsing label, never device-location logging. */
export function formatCoordinate(lat: number, lng: number): string {
  return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
}

export function isDeviceLocationFresh(
  location: DeviceLocation | null,
  maxAgeMs: number = DEVICE_LOCATION_FRESH_MS,
  now: number = Date.now()
): location is DeviceLocation {
  if (!location || !Number.isFinite(maxAgeMs) || maxAgeMs < 0) return false;
  const age = now - location.capturedAt;
  return age >= 0 && age <= maxAgeMs;
}

export function newestDeviceLocation(
  current: DeviceLocation | null,
  incoming: DeviceLocation
): DeviceLocation {
  return current && incoming.capturedAt < current.capturedAt
    ? current
    : incoming;
}

function problem(
  code: DeviceLocationProblemCode,
  title: string,
  message: string,
  canRetry: boolean
): DeviceLocationResult {
  return { ok: false, problem: { code, title, message, canRetry } };
}

export interface AcquireDeviceLocationOptions {
  enableHighAccuracy?: boolean;
  timeoutMs?: number;
  maximumAgeMs?: number;
}

/**
 * The one browser-geolocation boundary. It retains the browser capture time and
 * accuracy and returns typed, user-visible failures without logging a fix.
 */
export async function acquireDeviceLocation(
  options: AcquireDeviceLocationOptions = {}
): Promise<DeviceLocationResult> {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return problem(
      "unsupported",
      "Location is unavailable",
      "This device cannot share its location. Pick an area instead.",
      false
    );
  }
  if (!window.isSecureContext) {
    return problem(
      "insecure",
      "Location needs a secure connection",
      "Open WetinDey on its secure address, or pick an area instead.",
      false
    );
  }
  if (!navigator.geolocation) {
    return problem(
      "unsupported",
      "This browser cannot share location",
      "Location is not supported here. Pick an area instead.",
      false
    );
  }

  return new Promise<DeviceLocationResult>((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const receivedAt = Date.now();
        const capturedAt =
          Number.isFinite(position.timestamp) && position.timestamp > 0
            ? position.timestamp
            : receivedAt;
        const { latitude, longitude, accuracy } = position.coords;
        if (
          !Number.isFinite(latitude) ||
          latitude < -90 ||
          latitude > 90 ||
          !Number.isFinite(longitude) ||
          longitude < -180 ||
          longitude > 180 ||
          !Number.isFinite(accuracy) ||
          accuracy < 0
        ) {
          resolve(
            problem(
              "invalid",
              "Your device returned an unusable location",
              "The location response was incomplete. Try again, or pick an area.",
              true
            )
          );
          return;
        }

        const location: DeviceLocation = {
          lat: latitude,
          lng: longitude,
          accuracyM: accuracy,
          capturedAt,
          receivedAt,
          provenance: "device",
        };
        if (!isDeviceLocationFresh(location, DEVICE_LOCATION_FRESH_MS, receivedAt)) {
          resolve(
            problem(
              "stale",
              "Your location is out of date",
              "The device returned an old fix. Try again to refresh it, or continue with your browsing area.",
              true
            )
          );
          return;
        }
        resolve({ ok: true, location });
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          resolve(
            problem(
              "permission-denied",
              "Location is blocked",
              "Allow location for WetinDey in your browser settings, or pick an area.",
              false
            )
          );
          return;
        }
        if (error.code === error.POSITION_UNAVAILABLE) {
          resolve(
            problem(
              "unavailable",
              "Your device could not get a fix",
              "Try again near a window, or continue with your browsing area.",
              true
            )
          );
          return;
        }
        if (error.code === error.TIMEOUT) {
          resolve(
            problem(
              "timeout",
              "Finding you took too long",
              "Try again, or continue with your browsing area.",
              true
            )
          );
          return;
        }
        resolve(
          problem(
            "unknown",
            "Location did not work",
            "Try again, or continue with your browsing area.",
            true
          )
        );
      },
      {
        enableHighAccuracy: options.enableHighAccuracy ?? false,
        timeout: options.timeoutMs ?? 10_000,
        maximumAge: options.maximumAgeMs ?? 60_000,
      }
    );
  });
}

export interface LocationState {
  browsingLocation: BrowsingLocation;
  /** Physical evidence is deliberately session-only and excluded from persistence. */
  deviceLocation: DeviceLocation | null;
  hydrated: boolean;
  setManualBrowsingLocation: (input: {
    lat: number;
    lng: number;
    areaName: string | null;
    areaSlug: string | null;
  }) => void;
  setDeviceBrowsingLocation: (
    location: DeviceLocation,
    area: { areaName: string | null; areaSlug: string | null }
  ) => void;
  recordDeviceLocation: (location: DeviceLocation) => boolean;
  resetBrowsingToDefault: () => void;
  setHydrated: (value: boolean) => void;
}

export function mergePersistedLocationState(
  persistedState: unknown,
  currentState: LocationState
): LocationState {
  const candidate = persistedLocationCandidate(persistedState);
  return {
    ...currentState,
    browsingLocation: canonicalPersistedBrowsingLocation(candidate),
    // Persistence can never restore a personal fix.
    deviceLocation: null,
  };
}

export const LOCATION_STORAGE_KEY = "wetindey.location.v1";

export const useLocationStore = create<LocationState>()(
  persist(
    (set) => ({
      browsingLocation: DEFAULT_BROWSING_LOCATION,
      deviceLocation: null,
      hydrated: false,

      setManualBrowsingLocation: (input) =>
        set({
          browsingLocation: {
            ...input,
            provenance: "manual",
            setAt: Date.now(),
          },
        }),

      setDeviceBrowsingLocation: (location, area) =>
        set({
          browsingLocation: {
            lat: location.lat,
            lng: location.lng,
            provenance: "device",
            areaName: area.areaName,
            areaSlug: area.areaSlug,
            setAt: Date.now(),
          },
        }),

      recordDeviceLocation: (location) => {
        let accepted = false;
        set((state) => {
          const newest = newestDeviceLocation(state.deviceLocation, location);
          if (newest !== location) return state;
          accepted = true;
          return { deviceLocation: newest };
        });
        return accepted;
      },

      resetBrowsingToDefault: () =>
        set({ browsingLocation: DEFAULT_BROWSING_LOCATION }),
      setHydrated: (value) => set({ hydrated: value }),
    }),
    {
      name: LOCATION_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        browsingLocation: state.browsingLocation,
      }),
      skipHydration: true,
      onRehydrateStorage: () => (state, error) => {
        if (error) console.error("locationStore: rehydrate failed");
        state?.setHydrated(true);
      },
      version: 3,
      migrate: migratePersistedLocationState,
      merge: mergePersistedLocationState,
    }
  )
);

export function useLocationHydration(): boolean {
  const hydrated = useLocationStore((state) => state.hydrated);
  useEffect(() => {
    if (rehydrateStarted) return;
    rehydrateStarted = true;
    void useLocationStore.persist.rehydrate();
  }, []);
  return hydrated;
}

let rehydrateStarted = false;

/**
 * Returns a live fix only while it may truthfully identify the user. The timer
 * forces a render at expiry even if no further geolocation event arrives.
 */
export function useFreshDeviceLocation(
  maxAgeMs: number = DEVICE_LOCATION_FRESH_MS
): DeviceLocation | null {
  const deviceLocation = useLocationStore((state) => state.deviceLocation);
  const [, setClock] = useState(0);

  useEffect(() => {
    if (!deviceLocation) return;
    const remaining = deviceLocation.capturedAt + maxAgeMs - Date.now();
    if (remaining <= 0) {
      setClock((value) => value + 1);
      return;
    }
    const timer = window.setTimeout(
      () => setClock((value) => value + 1),
      remaining + 1
    );
    return () => window.clearTimeout(timer);
  }, [deviceLocation, maxAgeMs]);

  return isDeviceLocationFresh(deviceLocation, maxAgeMs)
    ? deviceLocation
    : null;
}

export interface LocationChrome {
  label: string;
}

export function useLocationChrome(): LocationChrome {
  const browsingLocation = useLocationStore(
    (state) => state.browsingLocation
  );
  return {
    label:
      browsingLocation.areaName ??
      formatCoordinate(browsingLocation.lat, browsingLocation.lng),
  };
}
