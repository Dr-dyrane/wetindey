"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Check, ChevronRight, LocateFixed, Map as MapIcon, MapPin, TriangleAlert } from "lucide-react";

import { ModalSheet } from "@/design-system/components/ModalSheet";
import { NavigationStack } from "@/design-system/components/NavigationStack";
import { ListGroup } from "@/design-system/components/ListRow";
import { Skeleton } from "@/design-system/components/Skeleton";
import { StatusBadge } from "@/design-system/components/StatusBadge";
import { getAreaTree, getCoverageForPoint } from "@/app/actions";
import type { AreaGroup, AreaSummary, AreaTree } from "@/app/actions";
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
 * WEIGHT DISCIPLINE — owner's directive, 2026-07-17. The action links in the
 * cards below are NOT semibold, deliberately.
 *
 * Each card is heading + body + link. The heading and the link were both
 * `text-subhead` at the same weight, differing only in hue — two peaks in a
 * four-line card, which is no peak. Blue already says "tappable"; iOS action
 * links are regular weight for exactly that reason, and only a default action
 * earns the extra weight. The headings keep theirs. This sheet held 7 of the
 * app's semibolds; a weight repeated that often is texture, not hierarchy.
 */

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
 * The LGA is a step ONLY where it has more than one child. Dumping every
 * neighbourhood under every LGA reads as one screen at nine neighbourhoods and
 * as a wall at ninety, so the LGAs are a pushed level (NavigationStack, the
 * same push both size classes already use for place detail) rather than a set
 * of headers.
 *
 * An LGA holding exactly ONE neighbourhood is not a step, and is not drawn as
 * one: the row IS that neighbourhood. A drill onto a single row you cannot
 * deselect is a control that lies about having an outcome — the same rule
 * ItemDetailSheet's NarrowStep applies to its pickers. Four of the six LGAs are
 * that case today, which is the whole difference between this being a saving
 * and a tax.
 *
 * The LGA name joins the collapsed row's detail line only where it differs from
 * the neighbourhood's. Bariga is in Somolu, and that is worth a line; Ojo is in
 * Ojo, and that is a row echoing its own title back.
 *
 * You still cannot stand in "an LGA", so an LGA row never commits a position
 * and never claims a distance: getAreaTree returns no LGA centre, and inventing
 * one to fill the line would be fabricating the one thing this sheet sells.
 *
 * What comes out is `provenance: "manual"` — self-declared, area-centre
 * precision. The old code called this "simulate" and dressed it in a caution
 * banner about pretending. For a shopper standing in Festac, picking Festac is
 * not a pretence; it is the answer. The honest caveat is not "this is fake", it
 * is "we measure from the middle of your area", which is what the "Area centre"
 * badge on the chosen row says.
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

  /** The pushed LGA, by slug. Resolved against the tree at render rather than
   *  held as a group object, so a reloaded tree cannot strand level 1 on rows
   *  that no longer exist. */
  const [lgaSlug, setLgaSlug] = useState<string | null>(null);

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
      setLgaSlug(null);
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
   *  blank map.
   *
   *  `lgaName` is passed only where the row stands in for its whole LGA at
   *  level 0 — inside the pushed level the LGA is already the title, and
   *  repeating it on every row would say nothing. It is dropped again where it
   *  matches the area's own name: three of the four collapsed LGAs are named
   *  after their only neighbourhood (lagosAdmin.ts NEIGHBOURHOOD_LGA — ojo,
   *  surulere, mushin), so keeping it would print "Ojo" under "Ojo". */
  const areaRow = (area: AreaSummary, lgaName?: string) => {
    const isSelected = area.slug === position.areaSlug;
    const distanceKm = getHaversineDistance(measureFrom.lat, measureFrom.lng, area.lat, area.lng);
    const detail = [
      lgaName === area.name ? null : lgaName,
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

  /** One LGA row — the pushed case only; a single-child LGA is drawn by
   *  `areaRow` instead. It carries no distance because no LGA centre exists to
   *  measure from, and it names the area you are standing in so the current
   *  location stays legible without opening the level. */
  const lgaRow = (group: AreaGroup) => {
    const selected = group.areas.find((a) => a.slug === position.areaSlug);
    const places = group.areas.reduce((n, a) => n + a.placeCount, 0);
    const detail = [
      selected?.name,
      `${group.areas.length} areas`,
      places === 0 ? "No places yet" : `${places} place${places === 1 ? "" : "s"}`,
    ]
      .filter(Boolean)
      .join(" · ");

    return (
      <button
        key={group.lgaSlug}
        type="button"
        onClick={() => setLgaSlug(group.lgaSlug)}
        aria-current={selected !== undefined}
        className="flex min-h-tap w-full items-center gap-3 px-4 py-2.5 text-left
                   active:bg-fillTertiary transition-colors duration-instant"
      >
        <span className="grid h-7 w-7 shrink-0 place-items-center squircle bg-fillTertiary">
          <MapIcon className="h-4 w-4 text-text-secondary" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-body text-text-primary">{group.lgaName}</span>
          <span className="mt-0.5 block truncate text-footnote text-text-secondary tabular-nums">
            {detail}
          </span>
        </span>
        {selected && <Check className="h-5 w-5 shrink-0 text-status-info" strokeWidth={2.5} />}
        <ChevronRight className="h-4 w-4 shrink-0 text-text-tertiary" strokeWidth={2.5} />
      </button>
    );
  };

  const openGroup = tree?.groups.find((g) => g.lgaSlug === lgaSlug);

  const listNode = (
    /* Level 0 brings its own scroller: NavigationStack's root is a fixed-size
       `overflow-hidden` host, and only level 1 is given one for free. */
    <div className="h-full overflow-y-auto overscroll-contain space-y-6 py-3">
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
        <div className="mx-4 squircle-card bg-status-caution-bg p-4 space-y-1.5">
          <div className="flex items-center gap-2">
            <TriangleAlert className="h-4 w-4 shrink-0 text-status-caution-fg" />
            <p className="text-subhead font-semibold text-status-caution-fg">{locate.title}</p>
          </div>
          <p className="text-footnote text-text-secondary">{locate.body}</p>
          {locate.canRetry && (
            <button
              type="button"
              onClick={handleUseMyLocation}
              className="min-h-tap text-subhead text-status-info active:opacity-60"
            >
              Try again
            </button>
          )}
        </div>
      )}

      {locate.kind === "outside" && (
        <div className="mx-4 squircle-card bg-status-caution-bg p-4 space-y-1.5">
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
              className="min-h-tap text-subhead text-status-info active:opacity-60"
            >
              Use {locate.nearest.name} instead
            </button>
          )}
        </div>
      )}

      {/* ── 2. The hierarchy ────────────────────────────────────────── */}

      {treeError ? (
        <div className="mx-4 squircle-card bg-surface dark:bg-surface-elevated shadow-card p-5 text-center space-y-2">
          <p className="text-subhead font-semibold text-text-primary">{treeError}</p>
          <button
            type="button"
            onClick={() => void loadTree()}
            className="min-h-tap text-subhead text-status-info active:opacity-60"
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
        <div className="mx-4 squircle-card bg-surface dark:bg-surface-elevated shadow-card p-5 text-center">
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

          <ListGroup>
            {tree.groups.map((group) =>
              group.areas.length > 1
                ? lgaRow(group)
                : areaRow(group.areas[0], group.lgaName)
            )}
          </ListGroup>
        </div>
      )}
    </div>
  );

  return (
    <ModalSheet open={open} onClose={onClose} title="Where are you?" size="page">
      <NavigationStack
        listNode={listNode}
        detailNode={
          openGroup && (
            /* The same ListGroup level 0 uses: one stack of neighbourhood rows,
               one radius, one surface, whichever level drew it.

               `-mx-6` cancels the stack's own `px-6` so ListGroup's `mx-4`
               lands the group at 16px, the inset level 0 has. The stack pads
               level 1 and not level 0, so without this the identical rows step
               24px inward on push. It is tied to NavigationStack's px-6 by
               hand — the two numbers have to move together. */
            <div className="-mx-6">
              <ListGroup>{openGroup.areas.map((area) => areaRow(area))}</ListGroup>
            </div>
          )
        }
        detailLabel={openGroup?.lgaName}
        onDetailBack={() => setLgaSlug(null)}
        /* English on purpose, with the rest of this sheet (page.tsx:126) —
           the one string here that already has the plumbing to be translated
           and is waiting on the sheet's own i18n pass. */
        backLabel="Back"
      />
    </ModalSheet>
  );
}
