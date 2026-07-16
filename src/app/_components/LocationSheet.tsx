"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Check, Crosshair, FlaskConical, LocateFixed, MapPin, TriangleAlert } from "lucide-react";

import { ModalSheet } from "@/design-system/components/ModalSheet";
import { ListGroup } from "@/design-system/components/ListRow";
import { Skeleton } from "@/design-system/components/Skeleton";
import { Input } from "@/design-system/components/Input";
import { Button } from "@/design-system/components/Button";
import { StatusBadge } from "@/design-system/components/StatusBadge";
import { getAreasWithPlaceCounts, getCoverageForPoint } from "@/app/actions";
import type { AreaSummary } from "@/app/actions";
import { getHaversineDistance, formatDistance } from "@/lib/geospatial";
import {
  formatCoordinate,
  parseCoordinateInput,
  useLocationStore,
  NIGERIA_BBOX,
} from "@/core/state/locationStore";

export interface LocationSheetProps {
  open: boolean;
  onClose: () => void;
  /** The user's active search radius. Coverage is judged against this, not
   *  against a constant invented here. */
  radiusKm: number;
  /**
   * Fired after the store has been updated, so the shell can recentre the map.
   * The store is the record of where the user is; this is only the nudge to
   * move the camera.
   */
  onCommit?: (coords: { lat: number; lng: number }) => void;
}

/**
 * Geolocation outcomes, kept apart on purpose.
 *
 * A denied permission, a device that cannot get a fix, a request that timed out
 * and an insecure origin are four different problems with four different
 * remedies, and collapsing them into "Couldn't get your location" tells the
 * user nothing they can act on. Each one below names what happened and what to
 * do next. Inherited wholesale from AreaPickerSheet, which got this right.
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

/** Manual entry outcomes. `checking` covers the coverage round-trip. */
type ManualState =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "rejected"; field: "lat" | "lng" | "both"; message: string }
  | { kind: "failed"; message: string }
  | {
      /** Inside Nigeria, but we hold no prices near it. Their call. */
      kind: "uncovered";
      lat: number;
      lng: number;
      nearest: (AreaSummary & { distanceKm: number }) | null;
    };

/**
 * Location sheet — the control behind the location pill.
 *
 * Supersedes AreaPickerSheet. That sheet offered one real path (`Use my
 * location`) and one list, which is the wrong shape for this product right
 * now: the pilot covers south-west Lagos and nobody testing it is standing in
 * Festac, so a real fix lands outside coverage every single time and the
 * honest-but-useless answer is the only answer the app can give. This sheet
 * makes SIMULATION the primary path and keeps the real fix as a peer.
 *
 * The load-bearing decision here is that a simulated position is never dressed
 * up as a real one. It is introduced as a simulation, each area row states its
 * real place count so a dead area is obvious BEFORE you pick it, and the
 * position that comes out carries `provenance: "simulated"` so the map chrome
 * has to say so too. A simulated position presented as real is a lie on a
 * wayfinding surface — every distance the map prints is measured from it.
 *
 * It is a presented sheet, not a dropdown or a popover — HIG: "Avoid displaying
 * popovers in compact views".
 */
export function LocationSheet({ open, onClose, radiusKm, onCommit }: LocationSheetProps) {
  const position = useLocationStore((s) => s.position);
  const simulate = useLocationStore((s) => s.simulate);
  const setManualPoint = useLocationStore((s) => s.setManualPoint);
  const setDevicePoint = useLocationStore((s) => s.setDevicePoint);

  const [areas, setAreas] = useState<AreaSummary[] | null>(null);
  const [areasError, setAreasError] = useState<string | null>(null);
  const [locate, setLocate] = useState<LocateState>({ kind: "idle" });
  const [manual, setManual] = useState<ManualState>({ kind: "idle" });
  const [latText, setLatText] = useState("");
  const [lngText, setLngText] = useState("");
  const [deviceCoords, setDeviceCoords] = useState<{ lat: number; lng: number } | null>(null);

  /**
   * Geolocation and coverage callbacks fire long after the sheet may have been
   * dismissed. The generation counter makes every in-flight request ignorable,
   * so a request the user walked away from cannot resurrect a message on a
   * closed sheet or overwrite a newer answer.
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
      console.error("LocationSheet: failed to load areas", err);
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
      // state, so reopening starts clean rather than showing a stale error
      // from a previous attempt.
      generation.current++;
      setLocate({ kind: "idle" });
      setManual({ kind: "idle" });
    };
  }, [open, loadAreas]);

  const commit = useCallback(
    (coords: { lat: number; lng: number }) => {
      onCommit?.(coords);
      onClose();
    },
    [onCommit, onClose]
  );

  // ── 1. Simulate ───────────────────────────────────────────────────────────

  const handleSimulate = useCallback(
    (area: AreaSummary) => {
      simulate({ name: area.name, slug: area.slug, lat: area.lat, lng: area.lng });
      commit({ lat: area.lat, lng: area.lng });
    },
    [simulate, commit]
  );

  // ── 2. Manual ─────────────────────────────────────────────────────────────

  /** Commit a coordinate we have already validated and looked up. */
  const commitManual = useCallback(
    (lat: number, lng: number, area: AreaSummary | null) => {
      setManualPoint({
        lat,
        lng,
        // Null when nothing contains it. The chrome then shows the coordinate
        // itself rather than borrowing a nearby area's name for a point that
        // isn't in it.
        areaName: area?.name ?? null,
        areaSlug: area?.slug ?? null,
      });
      commit({ lat, lng });
    },
    [setManualPoint, commit]
  );

  const handleManualSubmit = useCallback(async () => {
    const parsed = parseCoordinateInput(latText, lngText);
    if (!parsed.ok) {
      // Rejected, never clamped. Dragging a typo into the bbox would move the
      // user somewhere they did not ask to be and never tell them.
      setManual({ kind: "rejected", field: parsed.field, message: parsed.message });
      return;
    }

    const g = ++generation.current;
    setManual({ kind: "checking" });

    try {
      const coverage = await getCoverageForPoint({ lat: parsed.lat, lng: parsed.lng, radiusKm });
      if (g !== generation.current) return;

      if (coverage.placesInRadius > 0) {
        commitManual(parsed.lat, parsed.lng, coverage.nearestArea);
        return;
      }

      setManual({ kind: "uncovered", lat: parsed.lat, lng: parsed.lng, nearest: coverage.nearestArea });
    } catch (err) {
      console.error("LocationSheet: coverage lookup failed for manual point", err);
      if (g !== generation.current) return;
      setManual({
        kind: "failed",
        message: "That coordinate is fine, but we couldn't reach the price data to check it. Check your network and try again.",
      });
    }
  }, [latText, lngText, radiusKm, commitManual]);

  // ── 3. Real location ──────────────────────────────────────────────────────

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
        body: "Your browser only shares location over https. Open WetinDey on the secure address, or simulate a position above.",
        canRetry: false,
      });
      return;
    }

    if (!("geolocation" in navigator)) {
      setLocate({
        kind: "problem",
        title: "This browser can't share location",
        body: "It doesn't support location at all. Simulate a position or type a coordinate instead.",
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
        setDeviceCoords(coords);

        try {
          const coverage = await getCoverageForPoint({ ...coords, radiusKm });
          if (g !== generation.current) return;

          if (coverage.placesInRadius > 0) {
            setDevicePoint({
              ...coords,
              areaName: coverage.nearestArea?.name ?? null,
              areaSlug: coverage.nearestArea?.slug ?? null,
            });
            commit(coords);
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
          console.error("LocationSheet: coverage lookup failed", err);
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
            body: "WetinDey doesn't have permission to see where you are. Allow location for this site in your browser settings, or simulate a position above.",
            canRetry: false,
          });
          return;
        }

        if (err.code === err.POSITION_UNAVAILABLE) {
          setLocate({
            kind: "problem",
            title: "Your device couldn't get a fix",
            body: "Location is allowed, but no position came back — this is common indoors. Try again near a window or outside, or simulate a position above.",
            canRetry: true,
          });
          return;
        }

        if (err.code === err.TIMEOUT) {
          setLocate({
            kind: "problem",
            title: "Finding you took too long",
            body: "The location request timed out before your device answered. Try again, or simulate a position above.",
            canRetry: true,
          });
          return;
        }

        console.error("LocationSheet: unexpected geolocation error", err);
        setLocate({
          kind: "problem",
          title: "Location didn't work",
          body: "Your browser refused the request without saying why. Simulate a position above instead.",
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
  }, [radiusKm, setDevicePoint, commit]);

  const locating = locate.kind === "locating";
  const checking = manual.kind === "checking";

  /** Distances are measured from a real fix if we have one, otherwise from
   *  wherever the user currently stands — including a simulated position. */
  const measureFrom = deviceCoords ?? { lat: position.lat, lng: position.lng };

  return (
    <ModalSheet open={open} onClose={onClose} title="Where are you?" size="page">
      <div className="space-y-6 py-3">
        {/*
          The simulation is announced before it is offered. This block is the
          reason the rest of the sheet is allowed to exist: it tells the user,
          in the first thing they read, that the primary path puts them
          somewhere they are not.
        */}
        <div className="mx-4 squircle bg-status-caution-bg p-4 space-y-1.5">
          <div className="flex items-center gap-2">
            <FlaskConical className="h-4 w-4 shrink-0 text-status-caution-fg" />
            <p className="text-subhead font-semibold text-status-caution-fg">You&rsquo;re placing yourself</p>
          </div>
          <p className="text-footnote text-text-secondary">
            WetinDey is piloting in south-west Lagos, so the usual way to test it is to stand somewhere on purpose.
            Pick an area and the map treats you as if you were there. Distances and &ldquo;nearest&rdquo; are measured
            from that pretend spot, and the map says <span className="font-semibold">Simulated</span> for as long as it lasts.
          </p>
        </div>

        {/* ── 1. Simulate ─────────────────────────────────────────────── */}

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
        ) : areas.length === 0 ? (
          <div className="mx-4 squircle bg-surface shadow-card p-5 text-center">
            <p className="text-subhead font-semibold text-text-primary">No areas are set up yet</p>
            <p className="mt-1 text-footnote text-text-secondary">
              There is nothing to simulate into. Type a coordinate below instead.
            </p>
          </div>
        ) : (
          <ListGroup
            header="Simulate a position"
            footer="The count is the number of places we hold in that area. An area with none will open an empty map — that's the data, not a bug."
          >
            {areas.map((area, i) => {
              const isSelected = area.slug === position.areaSlug;
              const distanceKm = getHaversineDistance(
                measureFrom.lat,
                measureFrom.lng,
                area.lat,
                area.lng
              );

              // The count is stated, never dressed up. An area with nothing in
              // it says so, so switching to it is an informed choice rather
              // than a blank map.
              const detail = [
                area.placeCount === 0
                  ? "No places yet"
                  : `${area.placeCount} place${area.placeCount === 1 ? "" : "s"}`,
                distanceKm >= 0.05 ? formatDistance(distanceKm) : null,
              ]
                .filter(Boolean)
                .join(" · ");

              return (
                <button
                  key={area.id}
                  type="button"
                  /* Focus lands on the first area, not on "Use my real
                     location" — simulation is the primary path here. */
                  data-autofocus={i === 0 ? "" : undefined}
                  onClick={() => handleSimulate(area)}
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
                  {isSelected && position.provenance === "simulated" && (
                    <StatusBadge kind="caution">Simulated</StatusBadge>
                  )}
                  {isSelected && (
                    <Check className="h-5 w-5 shrink-0 text-status-info" strokeWidth={2.5} />
                  )}
                </button>
              );
            })}
          </ListGroup>
        )}

        {/* ── 2. Manual ───────────────────────────────────────────────── */}

        <section className="space-y-1.5">
          <h3 className="px-4 text-footnote text-text-secondary">Or type a coordinate</h3>
          <div className="mx-4 squircle bg-surface p-4 space-y-3">
            <div className="flex gap-3">
              <Input
                type="text"
                inputMode="decimal"
                value={latText}
                onChange={(e) => {
                  setLatText(e.target.value);
                  if (manual.kind !== "idle" && manual.kind !== "checking") setManual({ kind: "idle" });
                }}
                placeholder="Latitude"
                aria-label="Latitude"
                aria-invalid={manual.kind === "rejected" && manual.field !== "lng"}
                disabled={checking}
                /* Tinted through className rather than Input's `error` prop:
                   the prop prints its own message per field, and a swapped
                   pair is ONE fault about BOTH fields, which would then say it
                   twice. The message lives below, once. */
                className={`tabular-nums ${
                  manual.kind === "rejected" && manual.field !== "lng"
                    ? "bg-status-unavailable-bg text-status-unavailable-fg"
                    : ""
                }`}
              />
              <Input
                type="text"
                inputMode="decimal"
                value={lngText}
                onChange={(e) => {
                  setLngText(e.target.value);
                  if (manual.kind !== "idle" && manual.kind !== "checking") setManual({ kind: "idle" });
                }}
                placeholder="Longitude"
                aria-label="Longitude"
                aria-invalid={manual.kind === "rejected" && manual.field !== "lat"}
                disabled={checking}
                className={`tabular-nums ${
                  manual.kind === "rejected" && manual.field !== "lat"
                    ? "bg-status-unavailable-bg text-status-unavailable-fg"
                    : ""
                }`}
              />
            </div>

            {manual.kind === "rejected" && (
              <p role="alert" className="text-footnote text-status-unavailable-fg">
                {manual.message}
              </p>
            )}
            {manual.kind === "failed" && (
              <p role="alert" className="text-footnote text-status-caution-fg">
                {manual.message}
              </p>
            )}

            <Button
              variant="secondary"
              size="md"
              className="w-full"
              onClick={() => void handleManualSubmit()}
              isLoading={checking}
              disabled={checking}
            >
              {checking ? "Checking…" : "Drop me here"}
            </Button>

            <p className="text-caption-1 text-text-secondary">
              Decimal degrees, inside Nigeria — latitude {NIGERIA_BBOX.minLat} to {NIGERIA_BBOX.maxLat}, longitude{" "}
              {NIGERIA_BBOX.minLng} to {NIGERIA_BBOX.maxLng}. Festac is {formatCoordinate(6.4641, 3.2753)}.
            </p>
          </div>
        </section>

        {manual.kind === "uncovered" && (
          <div className="mx-4 squircle bg-status-caution-bg p-4 space-y-1.5">
            <div className="flex items-center gap-2">
              <Crosshair className="h-4 w-4 shrink-0 text-status-caution-fg" />
              <p className="text-subhead font-semibold text-status-caution-fg">
                Nothing within {radiusKm} km of there
              </p>
            </div>
            <p className="text-footnote text-text-secondary">
              {formatCoordinate(manual.lat, manual.lng)} is inside Nigeria, so we&rsquo;ll take it — but we hold no
              prices near it
              {manual.nearest
                ? `. The nearest area we cover is ${manual.nearest.name}, about ${formatDistance(manual.nearest.distanceKm).replace(" away", "")} off`
                : ""}
              . The map will be empty.
            </p>
            <div className="flex flex-wrap gap-4 pt-1">
              <button
                type="button"
                onClick={() => commitManual(manual.lat, manual.lng, manual.nearest)}
                className="min-h-tap text-subhead font-semibold text-status-info active:opacity-60"
              >
                Drop me there anyway
              </button>
              {manual.nearest && (
                <button
                  type="button"
                  onClick={() => handleSimulate(manual.nearest!)}
                  className="min-h-tap text-subhead font-semibold text-status-info active:opacity-60"
                >
                  Simulate {manual.nearest.name} instead
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── 3. Real location ────────────────────────────────────────── */}

        <ListGroup footer="We only use your location to pick the nearest area. It never leaves your device.">
          <button
            type="button"
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
            <span className="min-w-0 flex-1">
              <span className="block truncate text-body text-text-primary">
                {locating ? "Finding you…" : "Use my real location"}
              </span>
              <span className="mt-0.5 block truncate text-footnote text-text-secondary">
                Only works if you&rsquo;re actually in south-west Lagos
              </span>
            </span>
            {position.provenance === "device" && (
              <Check className="h-5 w-5 shrink-0 text-status-info" strokeWidth={2.5} />
            )}
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
                    locate.distanceKm !== null
                      ? `, about ${formatDistance(locate.distanceKm).replace(" away", "")} off`
                      : ""
                  }. WetinDey is piloting in south-west Lagos for now.`
                : `We found you, but we hold no prices within ${radiusKm} km of where you are.`}
            </p>
            {locate.nearest && (
              <button
                type="button"
                onClick={() => handleSimulate(locate.nearest!)}
                className="min-h-tap text-subhead font-semibold text-status-info active:opacity-60"
              >
                Simulate {locate.nearest.name} instead
              </button>
            )}
          </div>
        )}
      </div>
    </ModalSheet>
  );
}
