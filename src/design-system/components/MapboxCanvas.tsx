"use client";

import React, { useEffect, useRef, useState } from "react";
import { MapboxAdapter } from "@/integrations/maps/MapboxAdapter";
import { useTheme } from "@/core/context/ThemeContext";
import { MapLoading, MapFailed } from "./MapLoader";

interface MapMarkerData {
  id: string;
  placeId: string;
  placeName: string;
  lat: number;
  lng: number;
  detail?: {
    confidenceLevel: string;
  };
  address?: string;
}

interface MapboxCanvasProps {
  candidates: MapMarkerData[];
  selectedPlaceId: string | null;
  onMarkerClick: (placeId: string) => void;
  center: { lat: number; lng: number };
}

/**
 * Resolve the Mapbox GL global, waiting for it if it has not arrived yet.
 *
 * Mapbox GL is loaded from a CDN with `defer` (layout.tsx). A deferred script is
 * only guaranteed to run before DOMContentLoaded — it is NOT guaranteed to run
 * before React hydrates and fires effects. On a slow network the effect wins the
 * race, `window.mapboxgl` is undefined, and the previous code logged a warning
 * and returned. There was no retry and no fallback, so the map stayed dead for
 * the rest of the session — the intermittent "map no longer renders" report.
 *
 * Polled rather than hooked to the script's onload: we don't own the tag, and a
 * load listener attached after the script already ran would never fire.
 */
function whenMapboxReady(timeoutMs = 10_000): Promise<unknown | null> {
  const w = window as unknown as { mapboxgl?: unknown };
  if (w.mapboxgl) return Promise.resolve(w.mapboxgl);

  return new Promise((resolve) => {
    const started = Date.now();
    const tick = () => {
      if (w.mapboxgl) return resolve(w.mapboxgl);
      if (Date.now() - started > timeoutMs) return resolve(null);
      window.setTimeout(tick, 60);
    };
    tick();
  });
}

export function MapboxCanvas({
  candidates,
  selectedPlaceId: _selectedPlaceId,
  onMarkerClick,
  center
}: MapboxCanvasProps) {
  const { theme } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const adapterRef = useRef<MapboxAdapter | null>(null);
  const initialCenterRef = useRef(center);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  /** Bumped by 'Try again'; re-runs the init effect. */
  const [attempt, setAttempt] = useState(0);

  // Initialize once the library is actually available.
  useEffect(() => {
    let cancelled = false;

    whenMapboxReady().then((gl) => {
      if (cancelled || !containerRef.current) return;
      if (!gl) {
        setFailed(true);
        return;
      }
      const accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || "";
      const adapter = new MapboxAdapter(accessToken);
      adapterRef.current = adapter;
      // Read the theme at init, not at first render: ThemeContext resolves
      // localStorage in an effect, so a ref captured during render is always
      // "light" and the map would flash the wrong basemap.
      const t = document.documentElement.classList.contains("dark") ? "dark" : "light";
      adapter.initialize(containerRef.current, initialCenterRef.current, 14.5, t);
      setFailed(false);
      // Flips the marker effect once the adapter exists — otherwise markers
      // added before init are silently dropped and never re-added.
      setReady(true);
    });

    return () => {
      cancelled = true;
      adapterRef.current?.destroy();
      adapterRef.current = null;
    };
  }, [attempt]);

  // Update map center when global coordinate changes
  const { lat, lng } = center;
  useEffect(() => {
    adapterRef.current?.setCenter(lat, lng);
  }, [lat, lng, ready]);

  // The map is the base layer of the UI, so it follows the app theme.
  // `ready` is in the deps because the adapter is created asynchronously: at
  // mount there is nothing to call, and without re-running here a dark session
  // would keep the light basemap it was initialised with.
  useEffect(() => {
    adapterRef.current?.setTheme(theme === "dark" ? "dark" : "light");
  }, [theme, ready]);

  // Update pins on the map whenever candidate details change
  useEffect(() => {
    const adapter = adapterRef.current;
    if (!adapter) return;

    adapter.clearMarkers();

    candidates.forEach((candidate) => {
      adapter.addMarker({
        id: candidate.placeId,
        lat: candidate.lat,
        lng: candidate.lng,
        label: candidate.placeName,
        status: candidate.detail
          ? (candidate.detail.confidenceLevel === "confirmed"
              ? "confirmed"
              : candidate.detail.confidenceLevel === "caution"
                ? "caution"
                : "unavailable")
          : "neutral",
        onClick: () => onMarkerClick(candidate.placeId)
      });
    });
  }, [candidates, onMarkerClick, ready]);

  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* The container must stay mounted underneath: Mapbox attaches to this
          node, so unmounting it while loading would give the adapter nothing to
          initialise into. The placeholders sit ON TOP and peel away. */}
      <div ref={containerRef} className="h-full w-full" />
      {!ready && !failed && <MapLoading />}
      {failed && <MapFailed onRetry={() => { setFailed(false); setAttempt((n) => n + 1); }} />}
    </div>
  );
}
