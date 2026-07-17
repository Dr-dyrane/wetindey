"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Check, LocateFixed, MapPin, TriangleAlert } from "lucide-react";

import { ModalSheet } from "@/design-system/components/ModalSheet";
import { ListGroup } from "@/design-system/components/ListRow";
import { Skeleton } from "@/design-system/components/Skeleton";
import { StatusBadge } from "@/design-system/components/StatusBadge";
import { getAreaTree, getCoverageForPoint } from "@/app/actions";
import type { AreaSummary, AreaTree } from "@/app/actions";
import { getHaversineDistance, formatDistance } from "@/lib/geospatial";
import { useLocationStore } from "@/core/state/locationStore";

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
 * do next.
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
 * Location sheet — the control behind the location pill.
 *
 * THE PICKER IS AN ADMINISTRATIVE HIERARCHY, NOT A COORDINATE.
 *
 * This sheet used to ask for a latitude and a longitude in two text fields, with
 * a bounding-box check and a paragraph explaining decimal degrees. That is an
 * engineer's idea of manual entry — it is how the DATA is stored, offered
 * unchanged to a person as if that were a courtesy. Nobody in Lagos thinks
 * "6.4641, 3.2753". They think Lagos → Amuwo Odofin → Festac, and that is now
 * what the sheet asks for. The position is derived from the choice, at the end,
 * where it belongs.
 *
 * Country and state are STATED, not offered. The pilot has exactly one of each,
 * and a select with a single option is a lie about the freedom you have. They
 * appear as a settled line of context above the choices.
 *
 * The LGA is a HEADER, not a step. You cannot stand in "an LGA" — it contains
 * the place you are actually in. Six headers over nine neighbourhoods is one
 * screen, and it conveys that Festac is in Amuwo Odofin without charging a tap
 * to learn it. A drill-down here would be hierarchy for its own sake.
 *
 * What comes out is `provenance: "manual"` — self-declared, area-centre
 * precision. The old code called this "simulate" and dressed it in a caution
 * banner about pretending. For a shopper standing in Festac, picking Festac is
 * not a pretence; it is the answer. The honest caveat is not "this is fake", it
 * is "we measure from the middle of your area", and the chrome's "Area centre"
 * tag says exactly that.
 *
 * It is a presented sheet, not a dropdown or a popover — HIG: "Avoid displaying
 * popovers in compact views".
 */
export function LocationSheet({ open, onClose, radiusKm, onCommit }: LocationSheetProps) {
  const position = useLocationStore((s) => s.position);
  const setManualPoint = useLocationStore((s) => s.setManualPoint);
  const setDevicePoint = useLocationStore((s) => s.setDevicePoint);

  const [tree, setTree] = useState<AreaTree | null>(null);
  const [treeError, setTreeError] = useState<string | null>(null);
  const [locate, setLocate] = useState<LocateState>({ kind: "idle" });
  const [deviceCoords, setDeviceCoords] = useState<{ lat: number; lng: number } | null>(null);

  /**
   * Geolocation and coverage callbacks fire long after the sheet may have been
   * dismissed. The generation counter makes every in-flight request ignorable,
   * so a request the user walked away from cannot resurrect a message on a
   * closed sheet or overwrite a newer answer.
   */
  const generation = useRef(0);

  const loadTree = useCallback(async () => {
    const g = ++generation.current;
    setTreeError(null);
    try {
      const rows = await getAreaTree();
      if (g !== generation.current) return;
      setTree(rows);
    } catch (err) {
      console.error("LocationSheet: failed to load the area tree", err);
      if (g !== generation.current) return;
      setTree(null);
      setTreeError("We no fit load the areas right now.");
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    void loadTree();
    return () => {
      // Dismissal cancels anything still in flight and resets the transient
      // state, so reopening starts clean rather than showing a stale error
      // from a previous attempt.
      //
      // react-hooks/exhaustive-deps warns here because a ref read in cleanup may
      // differ from its render-time value. That difference is the mechanism, not
      // a bug: bumping the LIVE counter at dismissal is what makes every request
      // still in flight compare unequal and drop its result. Copying the value
      // into a variable, as the rule suggests, would increment a stale number and
      // silently disable the cancellation.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      generation.current++;
      setLocate({ kind: "idle" });
    };
  }, [open, loadTree]);

  const commit = useCallback(
    (coords: { lat: number; lng: number }) => {
      onCommit?.(coords);
      onClose();
    },
    [onCommit, onClose]
  );

  // ── 1. Pick your area ─────────────────────────────────────────────────────

  const handlePickArea = useCallback(
    (area: AreaSummary) => {
      // The area's centre IS the derived position. The user named a place; we
      // resolve it to a point, rather than making them do that arithmetic.
      setManualPoint({
        lat: area.lat,
        lng: area.lng,
        areaName: area.name,
        areaSlug: area.slug,
      });
      commit({ lat: area.lat, lng: area.lng });
    },
    [setManualPoint, commit]
  );

  // ── 2. Real location ──────────────────────────────────────────────────────

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
        body: "Your browser only shares location over https. Open WetinDey on the secure address, or pick your area below.",
        canRetry: false,
      });
      return;
    }

    if (!("geolocation" in navigator)) {
      setLocate({
        kind: "problem",
        title: "This browser can't share location",
        body: "It doesn't support location at all. Pick your area below instead.",
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
            body: "WetinDey doesn't have permission to see where you are. Allow location for this site in your browser settings, or pick your area below.",
            canRetry: false,
          });
          return;
        }

        if (err.code === err.POSITION_UNAVAILABLE) {
          setLocate({
            kind: "problem",
            title: "Your device couldn't get a fix",
            body: "Location is allowed, but no position came back — this is common indoors. Try again near a window, or pick your area below.",
            canRetry: true,
          });
          return;
        }

        if (err.code === err.TIMEOUT) {
          setLocate({
            kind: "problem",
            title: "Finding you took too long",
            body: "The request timed out before your device answered. Try again, or pick your area below.",
            canRetry: true,
          });
          return;
        }

        console.error("LocationSheet: unexpected geolocation error", err);
        setLocate({
          kind: "problem",
          title: "Location didn't work",
          body: "Your browser refused the request without saying why. Pick your area below instead.",
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

  /** Distances are measured from a real fix if we have one, otherwise from
   *  wherever the user currently stands. */
  const measureFrom = deviceCoords ?? { lat: position.lat, lng: position.lng };

  /** One neighbourhood row. The count is data, not decoration: an area with
   *  nothing in it says so, so picking it is an informed choice rather than a
   *  blank map. */
  const areaRow = (area: AreaSummary, autofocus: boolean) => {
    const isSelected = area.slug === position.areaSlug;
    const distanceKm = getHaversineDistance(measureFrom.lat, measureFrom.lng, area.lat, area.lng);
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
        data-autofocus={autofocus ? "" : undefined}
        onClick={() => handlePickArea(area)}
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
        {isSelected && position.provenance === "manual" && (
          <StatusBadge kind="caution">Area centre</StatusBadge>
        )}
        {isSelected && <Check className="h-5 w-5 shrink-0 text-status-info" strokeWidth={2.5} />}
      </button>
    );
  };

  return (
    <ModalSheet open={open} onClose={onClose} title="Where are you?" size="page">
      <div className="space-y-6 py-3">
        {/* ── 1. Real location ────────────────────────────────────────── */}

        <ListGroup footer="Your location never leaves your device.">
          <button
            type="button"
            onClick={handleUseMyLocation}
            disabled={locating}
            aria-busy={locating}
            className="flex min-h-tap w-full items-center gap-3 px-4 py-2 text-left
                       disabled:opacity-40 active:bg-fillTertiary transition-colors duration-instant"
          >
            <span className="grid h-7 w-7 shrink-0 place-items-center squircle bg-status-info-bg">
              <LocateFixed className={`h-4 w-4 text-status-info-fg ${locating ? "animate-pulse" : ""}`} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-body text-text-primary">
                {locating ? "Finding you…" : "Use my location"}
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
                We found you, but you&rsquo;re outside our areas
              </p>
            </div>
            <p className="text-footnote text-text-secondary">
              {locate.nearest
                ? `Nothing within ${radiusKm} km of you. The nearest we cover is ${locate.nearest.name}${
                    locate.distanceKm !== null
                      ? `, about ${formatDistance(locate.distanceKm).replace(" away", "")} off`
                      : ""
                  }.`
                : `Nothing within ${radiusKm} km of you.`}
            </p>
            {locate.nearest && (
              <button
                type="button"
                onClick={() => handlePickArea(locate.nearest!)}
                className="min-h-tap text-subhead font-semibold text-status-info active:opacity-60"
              >
                Use {locate.nearest.name} instead
              </button>
            )}
          </div>
        )}

        {/* ── 2. The hierarchy ────────────────────────────────────────── */}

        {treeError ? (
          <div className="mx-4 squircle bg-surface shadow-card p-5 text-center space-y-2">
            <p className="text-subhead font-semibold text-text-primary">{treeError}</p>
            <button
              type="button"
              onClick={() => void loadTree()}
              className="min-h-tap text-subhead font-semibold text-status-info active:opacity-60"
            >
              Try again
            </button>
          </div>
        ) : tree === null ? (
          <div className="mx-4 space-y-2">
            <Skeleton className="h-tap w-full squircle" />
            <Skeleton className="h-tap w-full squircle" />
            <Skeleton className="h-tap w-full squircle" />
          </div>
        ) : tree.groups.length === 0 ? (
          <div className="mx-4 squircle bg-surface shadow-card p-5 text-center">
            <p className="text-subhead font-semibold text-text-primary">No areas are set up yet</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/*
              Country and state, settled. Two words carry both levels of the
              hierarchy the pilot has locked — shown so the user knows where the
              choices below sit, not offered as a decision they don't have.
            */}
            <p className="px-4 text-footnote text-text-secondary">
              {tree.countryName} · {tree.stateName}
            </p>

            {tree.groups.map((group, gi) => (
              <ListGroup key={group.lgaSlug} header={group.lgaName}>
                {group.areas.map((area, ai) => areaRow(area, gi === 0 && ai === 0))}
              </ListGroup>
            ))}
          </div>
        )}
      </div>
    </ModalSheet>
  );
}
