"use client";

import React, { useEffect, useRef, useState } from "react";
import { MapboxAdapter } from "@/integrations/maps/MapboxAdapter";
import { useTheme } from "@/core/context/ThemeContext";

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
  const initialThemeRef = useRef<"light" | "dark">(theme === "dark" ? "dark" : "light");
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

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
      adapter.initialize(containerRef.current, initialCenterRef.current, 14.5, initialThemeRef.current);
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
  }, []);

  // Update map center when global coordinate changes
  const { lat, lng } = center;
  useEffect(() => {
    adapterRef.current?.setCenter(lat, lng);
  }, [lat, lng]);

  // The map is the base layer of the UI, so it follows the app theme.
  useEffect(() => {
    adapterRef.current?.setTheme(theme === "dark" ? "dark" : "light");
  }, [theme]);

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
      <div ref={containerRef} className="w-full h-full" />
      {failed && (
        // The old code warned "Falling back to static map canvas" and then
        // rendered nothing — a blank rectangle with no explanation.
        <div className="absolute inset-0 grid place-items-center bg-surface-sunken p-6 text-center">
          <p className="text-subhead text-text-secondary">
            Map no fit load. Check your network — the list still dey work.
          </p>
        </div>
      )}
    </div>
  );
}
