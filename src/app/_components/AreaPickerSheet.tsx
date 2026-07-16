"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Check, LocateFixed, MapPin, TriangleAlert } from "lucide-react";

import { ModalSheet } from "@/design-system/components/ModalSheet";
import { ListGroup } from "@/design-system/components/ListRow";
import { Skeleton } from "@/design-system/components/Skeleton";
import { getAreasWithPlaceCounts, getCoverageForPoint } from "@/app/actions";
import type { AreaSummary } from "@/app/actions";
import { getHaversineDistance, formatDistance } from "@/lib/geospatial";

export interface AreaPickerSheetProps {
  open: boolean;
  onClose: () => void;
  /** Slug of the area currently being shown, so the list can mark it. */
  selectedAreaSlug: string | null;
  /** The user's active search radius. Coverage is judged against this, not
   *  against a constant invented here. */
  radiusKm: number;
  /** Chosen from the list. The parent recentres, relabels the pill and persists. */
  onSelectArea: (area: AreaSummary) => void;
  /** Located successfully AND inside coverage. `area` is the nearest covered
   *  area to the user, or null if the areas table is empty. */
  onUseMyLocation: (coords: { lat: number; lng: number }, area: AreaSummary | null) => void;
}

/**
 * Geolocation outcomes, kept apart on purpose.
 *
 * A denied permission, a device that cannot get a fix, and a fix that timed out
 * are three different problems with three different remedies, and collapsing
 * them into "Couldn't get your location" tells the user nothing they can act
 * on. Each one below names what happened and what to do next.
 */
type LocateState =
  | { kind: "idle" }
  | { kind: "locating" }
  | { kind: "problem"; title: string; body: string; canRetry: boolean }
  | {
      /** Located fine — we simply have nothing near them. Not an error. */
      kind: "outside";
      distanceKm: number | null;
      nearest: AreaSummary | null;
    };

/**
 * Area picker — the control behind the location pill.
 *
 * The pill used to be a label reading "Showing Festac" over a hardcoded
 * coordinate. This is the surface that makes the claim true: the areas are
 * queried, the place counts are real, and "Use my location" calls
 * `navigator.geolocation` rather than pretending.
 *
 * It is a presented sheet, not a dropdown or a popover — HIG: "Avoid displaying
 * popovers in compact views", and choosing the area you are shopping in is a
 * choice related to an action.
 */
export function AreaPickerSheet({
  open,
  onClose,
  selectedAreaSlug,
  radiusKm,
  onSelectArea,
  onUseMyLocation,
}: AreaPickerSheetProps) {
  const [areas, setAreas] = useState<AreaSummary[] | null>(null);
  const [areasError, setAreasError] = useState<string | null>(null);
  const [locate, setLocate] = useState<LocateState>({ kind: "idle" });
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);

  /**
   * Geolocation callbacks fire long after the sheet may have been dismissed.
   * The generation counter makes every in-flight request ignorable, so a
   * request the user walked away from cannot resurrect a message on a closed
   * sheet or overwrite a newer answer.
   */
  const generation = useRef(0);

  const loadAreas = useCallback(async () => {
    const g = ++generation.current;
    setAreasError(null);
    try {
      const rows = await getAreasWithPlaceCounts();
      if (g !== generation.current) return;
      setAreas(rows);
    } catch (err) {
      console.error("AreaPickerSheet: failed to load areas", err);
      if (g !== generation.current) return;
      setAreas(null);
      setAreasError("We no fit load the areas right now.");
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    void loadAreas();
    return () => {
      // Dismissal cancels anything still in flight and resets the transient
      // location state, so reopening starts clean rather than showing a stale
      // error from a previous attempt.
      generation.current++;
      setLocate({ kind: "idle" });
    };
  }, [open, loadAreas]);

  const handleUseMyLocation = useCallback(() => {
    if (typeof window === "undefined") return;

    // Chrome, Safari and Firefox all remove `navigator.geolocation` outside a
    // secure context, so an http:// origin looks identical to a browser that
    // never had the API. Separate the two — one is fixable by the operator,
    // the other is not fixable at all.
    if (!window.isSecureContext) {
      setLocate({
        kind: "problem",
        title: "Location needs a secure connection",
        body: "Your browser only shares location over https. Open WetinDey on the secure address, or pick an area below.",
        canRetry: false,
      });
      return;
    }

    if (!("geolocation" in navigator)) {
      setLocate({
        kind: "problem",
        title: "This browser can't share location",
        body: "It doesn't support location at all. Pick an area from the list below instead.",
        canRetry: false,
      });
      return;
    }

    const g = ++generation.current;
    setLocate({ kind: "locating" });

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        if (g !== generation.current) return;
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserCoords(coords);

        try {
          const coverage = await getCoverageForPoint({ ...coords, radiusKm });
          if (g !== generation.current) return;

          if (coverage.placesInRadius > 0) {
            onUseMyLocation(coords, coverage.nearestArea);
            onClose();
            return;
          }

          // Located, but we hold nothing they can walk to. Say that plainly
          // rather than recentring the map on an empty patch of Lagos and
          // leaving them to work out why there are no pins.
          setLocate({
            kind: "outside",
            distanceKm: coverage.nearestArea?.distanceKm ?? null,
            nearest: coverage.nearestArea,
          });
        } catch (err) {
          console.error("AreaPickerSheet: coverage lookup failed", err);
          if (g !== generation.current) return;
          setLocate({
            kind: "problem",
            title: "We found you, but not our data",
            body: "We got your location but couldn't reach the price data. Check your network and try again.",
            canRetry: true,
          });
        }
      },
      (err) => {
        if (g !== generation.current) return;

        if (err.code === err.PERMISSION_DENIED) {
          setLocate({
            kind: "problem",
            title: "Location is blocked",
            body: "WetinDey doesn't have permission to see where you are. Allow location for this site in your browser settings, or pick an area below.",
            canRetry: false,
          });
          return;
        }

        if (err.code === err.POSITION_UNAVAILABLE) {
          setLocate({
            kind: "problem",
            title: "Your device couldn't get a fix",
            body: "Location is allowed, but no position came back — this is common indoors. Try again near a window or outside, or pick an area below.",
            canRetry: true,
          });
          return;
        }

        if (err.code === err.TIMEOUT) {
          setLocate({
            kind: "problem",
            title: "Finding you took too long",
            body: "The location request timed out before your device answered. Try again, or pick an area below.",
            canRetry: true,
          });
          return;
        }

        console.error("AreaPickerSheet: unexpected geolocation error", err);
        setLocate({
          kind: "problem",
          title: "Location didn't work",
          body: "Your browser refused the request without saying why. Pick an area below instead.",
          canRetry: true,
        });
      },
      {
        // The radius is measured in kilometres, so a coarse network fix is
        // plenty. Asking for high accuracy would spin up GPS and cost seconds
        // and battery to sharpen a number nothing here reads that finely.
        enableHighAccuracy: false,
        timeout: 10_000,
        maximumAge: 60_000,
      }
    );
  }, [onClose, onUseMyLocation, radiusKm]);

  const locating = locate.kind === "locating";

  return (
    <ModalSheet open={open} onClose={onClose} title="Choose area" size="page">
      <div className="space-y-6 py-3">
        <ListGroup footer="We only use your location to pick the nearest area. It never leaves your device.">
          <button
            type="button"
            data-autofocus
            onClick={handleUseMyLocation}
            disabled={locating}
            aria-busy={locating}
            className="flex min-h-tap w-full items-center gap-3 px-4 py-2 text-left
                       disabled:opacity-40 active:bg-fillTertiary transition-colors duration-instant"
          >
            <span className="grid h-7 w-7 shrink-0 place-items-center squircle bg-status-info-bg">
              <LocateFixed
                className={`h-4 w-4 text-status-info-fg ${locating ? "animate-pulse" : ""}`}
              />
            </span>
            <span className="min-w-0 flex-1 truncate text-body text-text-primary">
              {locating ? "Finding you…" : "Use my location"}
            </span>
          </button>
        </ListGroup>

        {locate.kind === "problem" && (
          <div className="mx-4 squircle bg-status-caution-bg p-4 space-y-1.5">
            <div className="flex items-center gap-2">
              <TriangleAlert className="h-4 w-4 shrink-0 text-status-caution-fg" />
              <p className="text-subhead font-semibold text-status-caution-fg">{locate.title}</p>
            </div>
            <p className="text-footnote text-text-secondary">{locate.body}</p>
            {locate.canRetry && (
              <button
                type="button"
                onClick={handleUseMyLocation}
                className="min-h-tap text-subhead font-semibold text-status-info active:opacity-60"
              >
                Try again
              </button>
            )}
          </div>
        )}

        {locate.kind === "outside" && (
          <div className="mx-4 squircle bg-status-caution-bg p-4 space-y-1.5">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 shrink-0 text-status-caution-fg" />
              <p className="text-subhead font-semibold text-status-caution-fg">
                You&rsquo;re outside the areas we cover
              </p>
            </div>
            <p className="text-footnote text-text-secondary">
              {locate.nearest
                ? `We found you, but we hold no prices within ${radiusKm} km of where you are. The nearest place we cover is ${locate.nearest.name}${
                    locate.distanceKm !== null ? `, about ${formatDistance(locate.distanceKm).replace(" away", "")} off` : ""
                  }. WetinDey is piloting in south-west Lagos for now.`
                : `We found you, but we hold no prices within ${radiusKm} km of where you are.`}
            </p>
            {locate.nearest && (
              <button
                type="button"
                onClick={() => {
                  onSelectArea(locate.nearest!);
                  onClose();
                }}
                className="min-h-tap text-subhead font-semibold text-status-info active:opacity-60"
              >
                Show {locate.nearest.name} instead
              </button>
            )}
          </div>
        )}

        {areasError ? (
          <div className="mx-4 squircle bg-surface shadow-card p-5 text-center space-y-2">
            <p className="text-subhead font-semibold text-text-primary">{areasError}</p>
            <button
              type="button"
              onClick={() => void loadAreas()}
              className="min-h-tap text-subhead font-semibold text-status-info active:opacity-60"
            >
              Try again
            </button>
          </div>
        ) : areas === null ? (
          <div className="mx-4 space-y-2">
            <Skeleton className="h-tap w-full squircle" />
            <Skeleton className="h-tap w-full squircle" />
            <Skeleton className="h-tap w-full squircle" />
          </div>
        ) : (
          <ListGroup header="Areas we cover">
            {areas.map((area) => {
              const isSelected = area.slug === selectedAreaSlug;
              const distanceKm = userCoords
                ? getHaversineDistance(userCoords.lat, userCoords.lng, area.lat, area.lng)
                : null;

              // The count is stated, never dressed up. An area with nothing in
              // it says so, so switching to it is an informed choice rather
              // than a blank map.
              const detail = [
                area.placeCount === 0
                  ? "No places yet"
                  : `${area.placeCount} place${area.placeCount === 1 ? "" : "s"}`,
                distanceKm !== null ? formatDistance(distanceKm) : null,
              ]
                .filter(Boolean)
                .join(" · ");

              return (
                <button
                  key={area.id}
                  type="button"
                  onClick={() => {
                    onSelectArea(area);
                    onClose();
                  }}
                  aria-current={isSelected}
                  className="flex min-h-tap w-full items-center gap-3 px-4 py-2.5 text-left
                             active:bg-fillTertiary transition-colors duration-instant"
                >
                  <span className="grid h-7 w-7 shrink-0 place-items-center squircle bg-fillTertiary">
                    <MapPin className="h-4 w-4 text-text-secondary" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-body text-text-primary">{area.name}</span>
                    <span className="mt-0.5 block truncate text-footnote text-text-secondary tabular-nums">
                      {detail}
                    </span>
                  </span>
                  {isSelected && (
                    <Check className="h-5 w-5 shrink-0 text-status-info" strokeWidth={2.5} />
                  )}
                </button>
              );
            })}
          </ListGroup>
        )}
      </div>
    </ModalSheet>
  );
}
