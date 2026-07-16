"use client";

import React, { useEffect, useRef } from "react";
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
}

interface MapboxCanvasProps {
  candidates: MapMarkerData[];
  selectedPlaceId: string | null;
  onMarkerClick: (placeId: string) => void;
  center: { lat: number; lng: number };
}

export function MapboxCanvas({
  candidates,
  selectedPlaceId,
  onMarkerClick,
  center
}: MapboxCanvasProps) {
  const { theme } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const adapterRef = useRef<MapboxAdapter | null>(null);
  const initialCenterRef = useRef(center);
  const initialThemeRef = useRef<"light" | "dark">(theme === "dark" ? "dark" : "light");

  // Initialize MapboxAdapter once on mount
  useEffect(() => {
    if (!containerRef.current) return;

    const accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || "";
    const adapter = new MapboxAdapter(accessToken);
    adapterRef.current = adapter;

    // Seed with the current theme so a dark session never flashes a light
    // basemap before the theme effect below catches up.
    adapter.initialize(containerRef.current, initialCenterRef.current, 14.5, initialThemeRef.current);

    return () => {
      adapter.destroy();
      adapterRef.current = null;
    };
  }, []); // Safe single init on mount

  // The map is the base layer of the UI, so it follows the app theme.
  useEffect(() => {
    adapterRef.current?.setTheme(theme === "dark" ? "dark" : "light");
  }, [theme]);

  // Update map center when global coordinate changes
  const { lat, lng } = center;
  useEffect(() => {
    if (adapterRef.current) {
      adapterRef.current.setCenter(lat, lng);
    }
  }, [lat, lng]);

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
  }, [candidates, onMarkerClick]);

  // Fly to the selected place marker when a card is clicked
  useEffect(() => {
    const adapter = adapterRef.current;
    if (!adapter || !selectedPlaceId) return;

    const match = candidates.find((c) => c.placeId === selectedPlaceId);
    if (match) {
      adapter.setCenter(match.lat, match.lng);
    }
  }, [selectedPlaceId, candidates]);

  return (
    <div className="absolute inset-0 overflow-hidden">
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
}
