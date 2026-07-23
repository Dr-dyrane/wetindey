"use server";

import { db } from "@/db";
import { places, areas } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { parsePlacesNear, parseCoverageForPoint, parseContactPolicyPlaceId } from "@/lib/validation";

export interface AreaSummary {
  id: string;
  slug: string;
  name: string;
  lat: number;
  lng: number;
  placeCount: number;
  coverageStatus: string;
}

export interface AreaGroup {
  lgaSlug: string;
  lgaName: string;
  areas: AreaSummary[];
}

export interface AreaTree {
  countryName: string;
  stateName: string;
  groups: AreaGroup[];
}

export interface PointCoverage {
  nearestArea: (AreaSummary & { distanceKm: number }) | null;
  placesInRadius: number;
  radiusKm: number;
}

export interface PlaceContactPolicy {
  placeId: string;
  contactVisibility: string;
  openingInformation: string | null;
  address: string | null;
}

function toEwkt(lat: number, lng: number): string {
  const ok =
    Number.isFinite(lat) && Number.isFinite(lng) &&
    lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
  if (!ok) {
    throw new Error("Invalid geographic coordinate");
  }
  return `SRID=4326;POINT(${lng} ${lat})`;
}

export async function getPlaces() {
  const allPlaces = await db
    .select({
      id: places.id,
      name: places.name,
      placeType: places.placeType,
      location: places.location,
      address: places.address,
    })
    .from(places);
  return allPlaces;
}

export async function getPlacesNear(input: {
  lat: number;
  lng: number;
  radiusKm: number;
  limit?: number;
}) {
  input = parsePlacesNear(input);
  const point = toEwkt(input.lat, input.lng);
  const radiusM = input.radiusKm * 1000;

  const rows = await db
    .select({
      id: places.id,
      name: places.name,
      placeType: places.placeType,
      areaId: places.areaId,
      location: places.location,
      address: places.address,
      distanceKm: sql<number>`(ST_Distance(${places.location}, ST_GeogFromText(${point})) / 1000.0)`,
    })
    .from(places)
    .where(sql`ST_DWithin(${places.location}, ST_GeogFromText(${point}), ${radiusM}::double precision)`)
    .orderBy(sql`ST_Distance(${places.location}, ST_GeogFromText(${point})) asc`)
    .limit(input.limit ?? 200);

  return rows;
}

export async function getAreaTree(): Promise<AreaTree> {
  const lga = alias(areas, "lga");
  const state = alias(areas, "state");
  const country = alias(areas, "country");

  const rows = await db
    .select({
      id: areas.id,
      slug: areas.slug,
      name: areas.name,
      center: areas.center,
      coverageStatus: areas.coverageStatus,
      placeCount: sql<number>`count(${places.id})::int`,
      lgaSlug: lga.slug,
      lgaName: lga.name,
      stateName: state.name,
      countryName: country.name,
    })
    .from(areas)
    .leftJoin(places, eq(places.areaId, areas.id))
    .innerJoin(lga, eq(areas.parentAreaId, lga.id))
    .innerJoin(state, eq(lga.parentAreaId, state.id))
    .innerJoin(country, eq(state.parentAreaId, country.id))
    .where(eq(areas.type, "neighborhood"))
    .groupBy(areas.id, lga.slug, lga.name, state.name, country.name)
    .orderBy(sql`${lga.name} asc, ${areas.name} asc`);

  const groups: AreaGroup[] = [];
  for (const r of rows) {
    const area: AreaSummary = {
      id: r.id,
      slug: r.slug,
      name: r.name,
      lat: r.center.lat,
      lng: r.center.lng,
      placeCount: r.placeCount,
      coverageStatus: r.coverageStatus,
    };
    const last = groups[groups.length - 1];
    if (last && last.lgaSlug === r.lgaSlug) last.areas.push(area);
    else groups.push({ lgaSlug: r.lgaSlug, lgaName: r.lgaName, areas: [area] });
  }

  return {
    countryName: rows[0]?.countryName ?? "Nigeria",
    stateName: rows[0]?.stateName ?? "Lagos",
    groups,
  };
}

export async function getCoverageForPoint(input: {
  lat: number;
  lng: number;
  radiusKm: number;
  /**
   * ADR-023: the caller names the location concept it is sending ("device" for
   * a physical fix, "browsing" for the public search context). Validated at the
   * parse boundary and deliberately unused beyond it: coverage math is the same
   * either way, but an unnamed coordinate may not cross this boundary.
   */
  provenance: "device" | "browsing";
}): Promise<PointCoverage> {
  input = parseCoverageForPoint(input);
  const point = toEwkt(input.lat, input.lng);
  const radiusM = input.radiusKm * 1000;

  const [nearestRows, countRows] = await Promise.all([
    db
      .select({
        id: areas.id,
        slug: areas.slug,
        name: areas.name,
        center: areas.center,
        coverageStatus: areas.coverageStatus,
        placeCount: sql<number>`count(${places.id})::int`,
        distanceKm: sql<number>`(ST_Distance(${areas.center}, ST_GeogFromText(${point})) / 1000.0)`,
      })
      .from(areas)
      .leftJoin(places, eq(places.areaId, areas.id))
      .where(eq(areas.coverageStatus, "active"))
      .groupBy(areas.id)
      .orderBy(sql`ST_Distance(${areas.center}, ST_GeogFromText(${point})) asc, (${areas.type} = 'neighborhood') desc, ${areas.slug} asc`)
      .limit(1),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(places)
      .where(sql`ST_DWithin(${places.location}, ST_GeogFromText(${point}), ${radiusM}::double precision)`),
  ]);

  const nearest = nearestRows[0];

  return {
    nearestArea: nearest
      ? {
        id: nearest.id,
        slug: nearest.slug,
        name: nearest.name,
        lat: nearest.center.lat,
        lng: nearest.center.lng,
        placeCount: nearest.placeCount,
        coverageStatus: nearest.coverageStatus,
        distanceKm: nearest.distanceKm,
      }
      : null,
    placesInRadius: countRows[0]?.n ?? 0,
    radiusKm: input.radiusKm,
  };
}

export async function getPlaceContactPolicy(placeId: string): Promise<PlaceContactPolicy> {
  placeId = parseContactPolicyPlaceId(placeId);
  const rows = await db
    .select({
      id: places.id,
      contactVisibility: places.contactVisibility,
      openingInformation: places.openingInformation,
      address: places.address,
    })
    .from(places)
    .where(eq(places.id, placeId))
    .limit(1);

  const row = rows[0];
  if (!row) {
    throw new Error(`getPlaceContactPolicy: no place with id ${placeId}`);
  }

  return {
    placeId: row.id,
    contactVisibility: row.contactVisibility,
    openingInformation: row.openingInformation,
    address: row.address,
  };
}
