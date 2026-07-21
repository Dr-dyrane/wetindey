"use server";

import { db } from "@/db";
import { observations, sources, itemVariants, items, units, places, areas } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { auth } from "@/lib/auth";
import {
  admitFoodContribution,
  type ContributionAdmissionResult,
} from "@/lib/contributions/runtime";
import type { ContributionAdmissionInput } from "@/lib/validation";

export interface MyReport {
  id: string;
  itemName: string;
  variantName: string;
  unitName: string;
  placeName: string;
  areaName: string;
  priceAmount: number | null;
  currency: string;
  availabilityState: string;
  observedAt: string;
}

const MY_REPORTS_LIMIT = 100;

export async function submitObservation(
  data: ContributionAdmissionInput
): Promise<ContributionAdmissionResult> {
  return admitFoodContribution(data);
}

export async function getInitialSubmissionData() {
  const [placesList, itemsList, variantsList, unitsList] = await Promise.all([
    db.select({ id: places.id, name: places.name }).from(places),
    db.select({ id: items.id, name: items.canonicalName }).from(items),
    db.select({ id: itemVariants.id, itemId: itemVariants.itemId, displayName: itemVariants.displayName }).from(itemVariants),
    db.select({ id: units.id, displayName: units.displayName }).from(units)
  ]);

  return {
    places: placesList,
    items: itemsList,
    variants: variantsList,
    units: unitsList
  };
}

export async function getMyReports(): Promise<MyReport[]> {
  const { data: session } = await auth.getSession();
  const userId = session?.user?.id;
  if (!userId) return [];

  const rows = await db
    .select({
      id: observations.id,
      priceAmount: observations.priceAmount,
      currency: observations.currency,
      availabilityState: observations.availabilityState,
      observedAt: observations.observedAt,
      itemName: items.canonicalName,
      variantName: itemVariants.displayName,
      unitName: units.displayName,
      placeName: places.name,
      areaName: areas.name,
    })
    .from(observations)
    .innerJoin(sources, eq(observations.sourceId, sources.id))
    .innerJoin(itemVariants, eq(observations.itemVariantId, itemVariants.id))
    .innerJoin(items, eq(itemVariants.itemId, items.id))
    .innerJoin(units, eq(observations.unitId, units.id))
    .innerJoin(places, eq(observations.placeId, places.id))
    .innerJoin(areas, eq(places.areaId, areas.id))
    .where(eq(sources.userId, userId))
    .orderBy(desc(observations.observedAt))
    .limit(MY_REPORTS_LIMIT);

  return rows.map((r) => ({ ...r, observedAt: r.observedAt.toISOString() }));
}
