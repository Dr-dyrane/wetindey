import { useCallback, useEffect, useRef, useState } from "react";
import {
  getPlaceContactPolicy,
  getReviewsForEntity,
  getReviewAggregate,
  type PlaceContactPolicy,
  type ReviewData,
  type ReviewAggregateData,
} from "@/app/_actions/actions";
import { formatNaira } from "@/lib/money";
import {
  ROUTE_ORIGIN_FRESH_MS,
  acquireDeviceLocation,
  isDeviceLocationFresh,
  useLocationStore,
} from "@/core/state/locationStore";
import {
  disclosedRouteOrigin,
  isDisclosedRouteOriginAdmissible,
  type DisclosedRouteOrigin,
} from "@/lib/directions";
import type { StatusKind } from "@/design-system/components/StatusBadge";

export interface GetItOffer {
  offerId?: string;
  itemName: string;
  variantName?: string;
  unit: string;
  priceMin: number;
  priceMax?: number;
  observedAt?: string;
  freshnessKind?: StatusKind;
  freshnessLabel?: string;
}

export interface GetItTarget {
  placeId: string;
  placeName: string;
  lat: number;
  lng: number;
  address?: string | null;
  areaName?: string;
  offer?: GetItOffer | null;
}

export interface GetItSheetProps {
  open: boolean;
  onClose: () => void;
  target: GetItTarget | null;
  onOriginDisclosed?: (origin: DisclosedRouteOrigin) => void;
  onGoThere?: () => void;
}

export type MapsPlatform = "apple" | "android" | "web";

export function assertCoordinate(lat: number, lng: number, placeName: string): void {
  const ok =
    Number.isFinite(lat) && Number.isFinite(lng) &&
    lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
  if (!ok) {
    throw new Error(`GetItSheet: invalid destination coordinate for "${placeName}"`);
  }
}

export function detectMapsPlatform(): MapsPlatform {
  if (typeof navigator === "undefined") return "web";
  const ua = navigator.userAgent;
  if (/Android/i.test(ua)) return "android";
  const iPhone = /iPad|iPhone|iPod/.test(ua);
  const mac = /Macintosh|Mac OS X/.test(ua);
  if (iPhone || mac) return "apple";
  return "web";
}

export function mapsAppName(platform: MapsPlatform): string {
  if (platform === "apple") return "Apple Maps";
  if (platform === "android") return "Maps app";
  return "Google Maps";
}

export function appleMapsUrl(t: GetItTarget, origin?: { lat: number; lng: number } | null): string {
  const p = new URLSearchParams();
  p.set("daddr", `${t.lat},${t.lng}`);
  p.set("q", t.placeName);
  p.set("dirflg", "d");
  if (origin) p.set("saddr", `${origin.lat},${origin.lng}`);
  return `https://maps.apple.com/?${p.toString()}`;
}

export function googleMapsUrl(t: GetItTarget, origin?: { lat: number; lng: number } | null): string {
  const p = new URLSearchParams();
  p.set("api", "1");
  p.set("destination", `${t.lat},${t.lng}`);
  p.set("travelmode", "driving");
  if (origin) p.set("origin", `${origin.lat},${origin.lng}`);
  return `https://www.google.com/maps/dir/?${p.toString()}`;
}

export function geoUri(t: GetItTarget): string {
  return `geo:${t.lat},${t.lng}?q=${t.lat},${t.lng}(${encodeURIComponent(t.placeName)})`;
}

export function sharePinUrl(t: GetItTarget): string {
  return `https://www.google.com/maps/search/?api=1&query=${t.lat},${t.lng}`;
}

export function openExternal(url: string): void {
  const w = window.open(url, "_blank", "noopener,noreferrer");
  if (!w) window.location.href = url;
}

export function openAndroidMaps(
  t: GetItTarget,
  origin: DisclosedRouteOrigin | null
): void {
  let handedOff = false;
  const markHandedOff = () => {
    handedOff = true;
  };
  const onVisibility = () => {
    if (document.visibilityState === "hidden") handedOff = true;
  };

  window.addEventListener("pagehide", markHandedOff);
  window.addEventListener("blur", markHandedOff);
  document.addEventListener("visibilitychange", onVisibility);

  window.location.href = geoUri(t);

  window.setTimeout(() => {
    window.removeEventListener("pagehide", markHandedOff);
    window.removeEventListener("blur", markHandedOff);
    document.removeEventListener("visibilitychange", onVisibility);
    if (!handedOff && document.visibilityState === "visible") {
      window.location.href = googleMapsUrl(
        t,
        origin && isDisclosedRouteOriginAdmissible(origin) ? origin : null
      );
    }
  }, 1200);
}

export function formatPriceRange(offer: GetItOffer): string {
  if (offer.priceMax && offer.priceMax !== offer.priceMin) {
    return `${formatNaira(offer.priceMin)}–${formatNaira(offer.priceMax)}`;
  }
  return formatNaira(offer.priceMin);
}

export function formatFreshness(iso?: string): string | null {
  if (iso === undefined || iso === null) return null;
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) {
    throw new Error(`GetItSheet: unparseable observedAt timestamp: ${JSON.stringify(iso)}`);
  }

  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const minutes = Math.round((then - Date.now()) / 60_000);
  if (Math.abs(minutes) < 60) return rtf.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return rtf.format(hours, "hour");
  return rtf.format(Math.round(hours / 24), "day");
}

export function whereabouts(t: GetItTarget): string | null {
  const address = t.address?.trim();
  if (address) return address;
  return t.areaName?.trim() || null;
}

export function buildShareText(t: GetItTarget): string {
  const parts: string[] = [];

  if (t.offer) {
    const name = t.offer.variantName ? `${t.offer.itemName} (${t.offer.variantName})` : t.offer.itemName;
    parts.push(`${name} — ${formatPriceRange(t.offer)} per ${t.offer.unit} at ${t.placeName}.`);
  } else {
    parts.push(`${t.placeName}.`);
  }

  const where = whereabouts(t);
  if (where) parts.push(`${where}.`);

  const fresh = formatFreshness(t.offer?.observedAt);
  if (fresh) parts.push(`Price confirmed ${fresh}.`);

  parts.push("Shared from WetinDey.");
  return parts.join(" ");
}

export type ContactState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; policy: PlaceContactPolicy };

export function contactCopy(state: ContactState): { detail: string; footer: string | null } {
  if (state.status === "loading") return { detail: "Checking", footer: null };
  if (state.status === "error") {
    return { detail: "Unavailable", footer: "We couldn't read this seller's setting." };
  }
  if (state.policy.contactVisibility === "private") {
    return { detail: "Not shared", footer: null };
  }
  return { detail: "None on file", footer: null };
}

export type ShareResult = { kind: "idle" } | { kind: "copied" } | { kind: "manual"; text: string };
export type OriginState =
  | { kind: "idle" }
  | { kind: "disclosure" }
  | { kind: "locating" }
  | { kind: "ready"; origin: DisclosedRouteOrigin }
  | { kind: "problem"; title: string; message: string; canRetry: boolean };

export function useGetItSheet(props: GetItSheetProps) {
  const { open, onClose, target, onOriginDisclosed, onGoThere } = props;
  const [platform, setPlatform] = useState<MapsPlatform | null>(null);
  const [canShare, setCanShare] = useState(false);
  const [shareResult, setShareResult] = useState<ShareResult>({ kind: "idle" });
  const [contact, setContact] = useState<ContactState>({ status: "loading" });
  const [reviewsList, setReviewsList] = useState<ReviewData[]>([]);
  const [aggregate, setAggregate] = useState<ReviewAggregateData | null>(null);
  const [loadingReviews, setLoadingReviews] = useState(false);
  const [originState, setOriginState] = useState<OriginState>({ kind: "idle" });
  const [detailsOpen, setDetailsOpen] = useState(false);
  const recordDeviceLocation = useLocationStore((state) => state.recordDeviceLocation);
  const originGeneration = useRef(0);

  const placeId = target?.placeId ?? null;

  useEffect(() => {
    setPlatform(detectMapsPlatform());
    setCanShare(typeof navigator !== "undefined" && typeof navigator.share === "function");
  }, []);

  useEffect(() => {
    if (!open || !placeId) return;
    let cancelled = false;
    setContact({ status: "loading" });
    getPlaceContactPolicy(placeId)
      .then((policy) => {
        if (!cancelled) setContact({ status: "ready", policy });
      })
      .catch(() => {
        if (!cancelled) setContact({ status: "error" });
      });
    return () => {
      cancelled = true;
    };
  }, [open, placeId]);

  useEffect(() => {
    if (!open || !placeId) return;
    let cancelled = false;
    setLoadingReviews(true);
    
    Promise.all([
      getReviewsForEntity("place", placeId),
      getReviewAggregate("place", placeId)
    ])
      .then(([list, agg]) => {
        if (!cancelled) {
          setReviewsList(list);
          setAggregate(agg);
        }
      })
      .catch((err) => {
        console.error("Failed to load reviews:", err);
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingReviews(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [open, placeId]);

  useEffect(() => {
    if (!open) {
      originGeneration.current += 1;
      setShareResult({ kind: "idle" });
      setOriginState({ kind: "idle" });
      setDetailsOpen(false);
    }
  }, [open]);

  useEffect(() => {
    originGeneration.current += 1;
    setOriginState({ kind: "idle" });
    setDetailsOpen(false);
  }, [placeId]);

  useEffect(() => {
    if (shareResult.kind !== "copied") return;
    const t = window.setTimeout(() => setShareResult({ kind: "idle" }), 2000);
    return () => window.clearTimeout(t);
  }, [shareResult]);

  const copyToClipboard = useCallback(async (payload: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(payload);
        setShareResult({ kind: "copied" });
        return;
      } catch {}
    }
    setShareResult({ kind: "manual", text: payload });
  }, []);

  const handoff = useCallback((origin: DisclosedRouteOrigin | null) => {
    if (!target) return;
    assertCoordinate(target.lat, target.lng, target.placeName);
    const admittedOrigin =
      origin && isDisclosedRouteOriginAdmissible(origin) ? origin : null;

    onGoThere?.();

    const p = detectMapsPlatform();
    if (p === "android") {
      openAndroidMaps(target, admittedOrigin);
    } else if (p === "apple") {
      openExternal(appleMapsUrl(target, admittedOrigin));
    } else {
      openExternal(googleMapsUrl(target, admittedOrigin));
    }
    onClose();
  }, [target, onClose, onGoThere]);

  const handleGoThere = useCallback(() => {
    if (!target) return;
    setDetailsOpen(true);
    setOriginState({ kind: "disclosure" });
  }, [target]);

  const handleDestinationOnly = useCallback(() => {
    handoff(null);
  }, [handoff]);

  const handleUseCurrentLocation = useCallback(() => {
    if (originState.kind === "locating") return;
    const generation = ++originGeneration.current;
    setOriginState({ kind: "locating" });
    void acquireDeviceLocation({
      enableHighAccuracy: true,
      timeoutMs: 15_000,
      maximumAgeMs: 0,
    }).then((result) => {
      if (generation !== originGeneration.current) return;
      if (!result.ok) {
        setOriginState({
          kind: "problem",
          title: result.problem.title,
          message: result.problem.message,
          canRetry: result.problem.canRetry,
        });
        return;
      }

      if (!recordDeviceLocation(result.location)) {
        setOriginState({
          kind: "problem",
          title: "A newer location is already active",
          message: "This older response was ignored. Refresh again, or open the market only.",
          canRetry: true,
        });
        return;
      }
      const origin = disclosedRouteOrigin(result.location);
      if (!origin) {
        setOriginState({
          kind: "problem",
          title: "Your location is already out of date",
          message: "Refresh it again, or open directions with the market only.",
          canRetry: true,
        });
        return;
      }
      onOriginDisclosed?.(origin);
      setOriginState({ kind: "ready", origin });
    });
  }, [
    onOriginDisclosed,
    originState.kind,
    recordDeviceLocation,
  ]);

  const handleOpenWithLocation = useCallback(() => {
    if (originState.kind !== "ready") return;
    const now = Date.now();
    if (
      !isDeviceLocationFresh(
        originState.origin,
        ROUTE_ORIGIN_FRESH_MS,
        now
      ) ||
      now - originState.origin.disclosedAt > ROUTE_ORIGIN_FRESH_MS
    ) {
      setOriginState({
        kind: "problem",
        title: "Your route origin expired",
        message: "Refresh your location again, or open the market only.",
        canRetry: true,
      });
      return;
    }
    handoff(originState.origin);
  }, [handoff, originState]);

  const handleShare = useCallback(async () => {
    if (!target) return;
    assertCoordinate(target.lat, target.lng, target.placeName);

    const text = buildShareText(target);
    const url = sharePinUrl(target);
    const title = target.offer ? `${target.offer.itemName} at ${target.placeName}` : target.placeName;

    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share({ title, text, url });
        onClose();
        return;
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
      }
    }

    await copyToClipboard(`${text} ${url}`);
  }, [target, onClose, copyToClipboard]);

  return {
    platform,
    canShare,
    shareResult,
    contact,
    reviewsList,
    aggregate,
    loadingReviews,
    originState,
    detailsOpen,
    setDetailsOpen,
    handleGoThere,
    handleDestinationOnly,
    handleUseCurrentLocation,
    handleOpenWithLocation,
    handleShare,
  };
}
