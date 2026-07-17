import type { RouteGeometry } from "@/integrations/maps/MapboxAdapter";

/**
 * Where a route starts and where it ends. `{ lat, lng }` because that is the
 * order every other coordinate in this app is written in; the flip to GeoJSON's
 * `[lng, lat]` happens once, at the URL, and never leaves this file.
 */
export interface RoutePoint {
  lat: number;
  lng: number;
}

/** A route with a non-geographic endpoint is not a route request. */
function isRoutePoint(value: RoutePoint): boolean {
  return (
    Number.isFinite(value.lat) &&
    Number.isFinite(value.lng) &&
    value.lat >= -90 &&
    value.lat <= 90 &&
    value.lng >= -180 &&
    value.lng <= 180
  );
}

const DIRECTIONS_API = "https://api.mapbox.com/directions/v5/mapbox";

/**
 * The profiles, in the order we ask for them.
 *
 * `driving-traffic` is the one that reads live conditions — `driving` routes on
 * the road graph alone and will happily send you down a road that has been
 * solid since 6am. It costs a lower rate limit than `driving` (Mapbox rations
 * it harder), which is the price of the answer being about today.
 *
 * `driving` is the fallback, not a straight line: a road that ignores this
 * morning's jam is still a road. If both fail we draw nothing.
 */
const PROFILES = ["driving-traffic", "driving"] as const;

/**
 * The road from origin to destination, or null.
 *
 * Null is a normal outcome, not an error: no network, a rate limit, no token,
 * no route between these two points, an aborted request. Every one of them
 * means the caller draws no line, and that is the honest result — a line the
 * user could not walk is worse than no line at all.
 *
 * `signal` is the caller's, because the caller is the one who knows when the
 * answer stopped being wanted. Aborting stops the profile chain too: a cancelled
 * request never falls back.
 */
export async function fetchRoute(
  origin: RoutePoint,
  destination: RoutePoint,
  signal?: AbortSignal
): Promise<RouteGeometry | null> {
  // Coordinates can cross this boundary from persisted location state as well
  // as from a selected place. Never put NaN into a provider URL, and never let
  // a bad endpoint become a map-rendering failure.
  if (!isRoutePoint(origin) || !isRoutePoint(destination)) return null;

  const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
  // The same token that fetches the tiles under this line. It is public by
  // construction, so this call is client-side and needs no proxy.
  if (!token) return null;

  for (const profile of PROFILES) {
    const geometry = await requestRoute(profile, origin, destination, token, signal);
    if (geometry) return geometry;
    if (signal?.aborted) return null;
  }

  return null;
}

/**
 * One profile, one request.
 *
 * `geometries=geojson` so the coordinates arrive as numbers and nothing has to
 * decode a polyline. `overview=full` because the simplified overview cuts
 * corners off the geometry — literally — and a road drawn through the corner of
 * a building is the same class of lie as one drawn through the lagoon.
 */
async function requestRoute(
  profile: (typeof PROFILES)[number],
  origin: RoutePoint,
  destination: RoutePoint,
  token: string,
  signal?: AbortSignal
): Promise<RouteGeometry | null> {
  const coords = `${origin.lng},${origin.lat};${destination.lng},${destination.lat}`;
  const query = new URLSearchParams({
    geometries: "geojson",
    overview: "full",
    access_token: token
  });

  try {
    const res = await fetch(`${DIRECTIONS_API}/${profile}/${coords}?${query}`, { signal });
    if (!res.ok) return null;
    const body: unknown = await res.json();
    return firstRouteGeometry(body);
  } catch {
    // Offline, DNS, CORS, abort. All of them mean the same thing to the caller.
    return null;
  }
}

function isCoordinatePair(value: unknown): value is [number, number] {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    typeof value[0] === "number" &&
    typeof value[1] === "number" &&
    Number.isFinite(value[0]) &&
    Number.isFinite(value[1]) &&
    value[0] >= -180 &&
    value[0] <= 180 &&
    value[1] >= -90 &&
    value[1] <= 90
  );
}

/**
 * The first route's geometry, if the response actually carries one.
 *
 * Parsed defensively rather than cast: this is the one value in the module that
 * crossed the network, and a 200 with `{"code":"NoRoute","routes":[]}` is a
 * documented answer, not a malformed one.
 */
function firstRouteGeometry(body: unknown): RouteGeometry | null {
  if (typeof body !== "object" || body === null) return null;

  const { routes } = body as { routes?: unknown };
  if (!Array.isArray(routes) || routes.length === 0) return null;

  const first: unknown = routes[0];
  if (typeof first !== "object" || first === null) return null;

  const { geometry } = first as { geometry?: unknown };
  if (typeof geometry !== "object" || geometry === null) return null;

  const { coordinates } = geometry as { coordinates?: unknown };
  if (!Array.isArray(coordinates)) return null;

  const path: RouteGeometry = [];
  for (const point of coordinates) {
    if (!isCoordinatePair(point)) return null;
    path.push(point);
  }

  // One point is not a line.
  return path.length >= 2 ? path : null;
}
