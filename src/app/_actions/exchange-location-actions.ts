"use server";

import {
  searchNearbyExchangeLocations,
  type ExchangeLocation,
} from "@/integrations/maps/MapboxNearbyExchangeSearch";

export type ExchangeLocationDiscoveryResult =
  | { status: "ready"; locations: ExchangeLocation[] }
  | { status: "unavailable"; locations: [] };

export async function getNearbyExchangeLocations(input: {
  lat: number;
  lng: number;
  provenance: "browsing";
}): Promise<ExchangeLocationDiscoveryResult> {
  if (
    input.provenance !== "browsing" ||
    !Number.isFinite(input.lat) ||
    !Number.isFinite(input.lng) ||
    input.lat < -90 ||
    input.lat > 90 ||
    input.lng < -180 ||
    input.lng > 180
  ) {
    return { status: "unavailable", locations: [] };
  }

  try {
    const locations = await searchNearbyExchangeLocations(input);
    return { status: "ready", locations };
  } catch {
    return { status: "unavailable", locations: [] };
  }
}
