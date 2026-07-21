export type ExchangeLocationKind = "bank" | "bdc";

export interface ExchangeLocation {
  id: string;
  providerId: string;
  name: string;
  kind: ExchangeLocationKind;
  description: string;
  lat: number;
  lng: number;
  provenance: "mapbox" | "sample";
  verification: "map_listing" | "sample";
}

interface SearchFeature {
  properties?: {
    mapbox_id?: unknown;
    name?: unknown;
    full_address?: unknown;
    place_formatted?: unknown;
    coordinates?: {
      longitude?: unknown;
      latitude?: unknown;
    };
  };
}

interface SearchResponse {
  features?: unknown;
}

const SEARCH_ROOT = "https://api.mapbox.com/search/searchbox/v1/forward";
const SEARCH_RADIUS_DEGREES = 0.14;

function finiteCoordinate(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function parseFeatures(
  value: unknown,
  kind: ExchangeLocationKind
): ExchangeLocation[] {
  if (typeof value !== "object" || value === null) return [];
  const features = (value as SearchResponse).features;
  if (!Array.isArray(features)) return [];

  const seenProviderIds = new Set<string>();
  return features.flatMap((entry) => {
    if (typeof entry !== "object" || entry === null) return [];
    const properties = (entry as SearchFeature).properties;
    const coordinates = properties?.coordinates;
    if (
      typeof properties?.mapbox_id !== "string" ||
      typeof properties.name !== "string" ||
      !finiteCoordinate(coordinates?.latitude) ||
      !finiteCoordinate(coordinates.longitude) ||
      coordinates.latitude < -90 ||
      coordinates.latitude > 90 ||
      coordinates.longitude < -180 ||
      coordinates.longitude > 180
    ) {
      return [];
    }

    const description =
      typeof properties.full_address === "string"
        ? properties.full_address
        : typeof properties.place_formatted === "string"
          ? properties.place_formatted
          : properties.name;

    if (seenProviderIds.has(properties.mapbox_id)) {
      throw new Error("Nearby place discovery returned duplicate listings.");
    }
    seenProviderIds.add(properties.mapbox_id);

    return [{
      id: `mapbox:${properties.mapbox_id}`,
      providerId: properties.mapbox_id,
      name: properties.name,
      kind,
      description,
      lat: coordinates.latitude,
      lng: coordinates.longitude,
      provenance: "mapbox" as const,
      verification: "map_listing" as const,
    }];
  });
}

async function search(
  query: string,
  kind: ExchangeLocationKind,
  origin: { lat: number; lng: number },
  accessToken: string
): Promise<ExchangeLocation[]> {
  // Discovery receives browsing context, never the session-only device fix.
  // Coarsening is a second boundary: URLs/cache keys do not retain sub-block precision.
  const coarseOrigin = {
    lat: Number(origin.lat.toFixed(3)),
    lng: Number(origin.lng.toFixed(3)),
  };
  const params = new URLSearchParams({
    q: query,
    access_token: accessToken,
    country: "NG",
    language: "en",
    types: "poi",
    limit: "10",
    proximity: `${coarseOrigin.lng},${coarseOrigin.lat}`,
    bbox: [
      coarseOrigin.lng - SEARCH_RADIUS_DEGREES,
      coarseOrigin.lat - SEARCH_RADIUS_DEGREES,
      coarseOrigin.lng + SEARCH_RADIUS_DEGREES,
      coarseOrigin.lat + SEARCH_RADIUS_DEGREES,
    ].join(","),
  });
  const response = await fetch(`${SEARCH_ROOT}?${params.toString()}`, {
    signal: AbortSignal.timeout(8_000),
    next: { revalidate: 3600 },
  });
  if (!response.ok) throw new Error("Nearby place discovery is unavailable.");
  return parseFeatures(await response.json(), kind);
}

export async function searchNearbyExchangeLocations(origin: {
  lat: number;
  lng: number;
}): Promise<ExchangeLocation[]> {
  const accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
  if (!accessToken) throw new Error("Nearby place discovery is not configured.");

  const results = await Promise.allSettled([
    search("bank", "bank", origin, accessToken),
    search("bureau de change", "bdc", origin, accessToken),
  ]);
  if (results.some((result) => result.status === "rejected")) {
    throw new Error("Nearby place discovery is unavailable.");
  }

  const deduplicated = new Map<string, ExchangeLocation>();
  for (const result of results) {
    if (result.status !== "fulfilled") {
      throw new Error("Nearby place discovery is unavailable.");
    }
    for (const location of result.value) {
      const existing = deduplicated.get(location.providerId);
      if (!existing || (existing.kind === "bank" && location.kind === "bdc")) {
        deduplicated.set(location.providerId, location);
      }
    }
  }
  return [...deduplicated.values()];
}
