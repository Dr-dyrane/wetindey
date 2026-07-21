"use server";

import { db } from "@/db";
import { reviewAggregates } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";

export interface ReviewData {
  id: string;
  userId: string | null;
  reviewerName: string;
  reviewerAvatarUrl: string | null;
  rating: number;
  title: string | null;
  body: string | null;
  createdAt: string;
}

export interface ReviewAggregateData {
  ratingAverage: number;
  ratingCount: number;
}

export async function getReviewsForEntity(
  reviewableType: string,
  reviewableId: string
): Promise<ReviewData[]> {
  const result = await db.execute<{
    id: string;
    user_id: string | null;
    reviewer_name: string | null;
    reviewer_email: string | null;
    reviewer_avatar_url: string | null;
    rating: number;
    title: string | null;
    body: string | null;
    created_at: string;
  }>(sql`
    SELECT
      r.id,
      r.user_id,
      u.name as reviewer_name,
      u.email as reviewer_email,
      up.avatar_url as reviewer_avatar_url,
      r.rating,
      r.title,
      r.body,
      r.created_at
    FROM reviews r
    LEFT JOIN user_profiles up ON up.user_id = r.user_id
    LEFT JOIN neon_auth.user u ON u.id = r.user_id
    WHERE r.reviewable_type = ${reviewableType}
      AND r.reviewable_id = ${reviewableId}::uuid
      AND r.moderation_status = 'approved'
    ORDER BY r.created_at DESC
  `);

  return result.rows.map((row) => ({
    id: row.id,
    userId: row.user_id,
    reviewerName: row.reviewer_name || row.reviewer_email || "Anonymous",
    reviewerAvatarUrl: row.reviewer_avatar_url,
    rating: Number(row.rating),
    title: row.title,
    body: row.body,
    createdAt: new Date(row.created_at).toISOString(),
  }));
}

export async function getReviewAggregate(
  reviewableType: string,
  reviewableId: string
): Promise<ReviewAggregateData | null> {
  const result = await db
    .select({
      ratingAverage: reviewAggregates.ratingAverage,
      ratingCount: reviewAggregates.ratingCount,
    })
    .from(reviewAggregates)
    .where(
      and(
        eq(reviewAggregates.reviewableType, reviewableType),
        eq(reviewAggregates.reviewableId, reviewableId)
      )
    )
    .limit(1);

  if (result.length === 0) return null;
  return result[0];
}

export async function submitReview(_data: {
  reviewableType: string;
  reviewableId: string;
  rating: number;
  title?: string | null;
  body?: string | null;
}): Promise<void> {
  // ADR-009 defines the future domain, but its write-integrity prerequisites are
  // not live. Keep this boundary ahead of payload parsing, auth, and database work.
  throw new Error("REVIEWS_UNAVAILABLE");
}
