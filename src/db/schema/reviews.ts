import { pgTable, uuid, varchar, timestamp, text, integer, doublePrecision, boolean, jsonb, index, uniqueIndex, primaryKey } from "drizzle-orm/pg-core";

/**
 * Reviews table for polymorphic ratings and reviews (ADR-009).
 * 
 * Supports rating and reviewing any entity (place, item, seller, service, etc.)
 * using a decoupled text-based polymorphic reference: `reviewable_type` + `reviewable_id`.
 */
export const reviews = pgTable("reviews", {
  id: uuid("id").defaultRandom().primaryKey(),
  /**
   * The user who wrote this review. Nullable to support anonymous reviews.
   * Matches the user ID from the authentication system.
   */
  userId: uuid("user_id"),
  /**
   * The polymorphic type of the reviewable entity (e.g. 'place', 'item', 'seller', 'service').
   */
  reviewableType: varchar("reviewable_type", { length: 100 }).notNull(),
  /**
   * The UUID of the reviewable entity itself.
   */
  reviewableId: uuid("reviewable_id").notNull(),
  /**
   * Numeric rating score (must be enforced 1 to 5 at application layer).
   */
  rating: integer("rating").notNull(),
  title: varchar("title", { length: 255 }),
  body: text("body"),
  /**
   * Moderation status of the review. Approved reviews are displayed by default.
   */
  moderationStatus: varchar("moderation_status", { length: 50 }).default("approved").notNull(), // 'approved', 'pending', 'flagged', 'hidden'
  /**
   * Extensible JSON metadata for domain-specific review parameters (e.g. sub-scores, photos).
   */
  metadata: jsonb("metadata").default({}).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
}, (t) => [
  /**
   * Index for fetching reviews of a specific entity quickly.
   */
  index("reviews_reviewable_idx").on(t.reviewableType, t.reviewableId),
  /**
   * Index for fetching a user's review history.
   */
  index("reviews_user_id_idx").on(t.userId),
  /**
   * Index for filtering reviews by moderation status.
   */
  index("reviews_moderation_idx").on(t.moderationStatus)
]);

/**
 * Helpfulness votes table for reviews (ADR-009).
 * 
 * Allows users to mark reviews as helpful or not helpful, driving ranking.
 */
export const reviewHelpfulVotes = pgTable("review_helpful_votes", {
  id: uuid("id").defaultRandom().primaryKey(),
  reviewId: uuid("review_id").references(() => reviews.id, { onDelete: "cascade" }).notNull(),
  userId: uuid("user_id"),
  isHelpful: boolean("is_helpful").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull()
}, (t) => [
  /**
   * Unique constraint preventing a user from voting multiple times on the same review.
   */
  uniqueIndex("review_helpful_user_idx").on(t.reviewId, t.userId)
]);

/**
 * Aggregated rating statistics table for entities (ADR-009).
 * 
 * Caches averages and counts to avoid heavy aggregations on list views.
 */
export const reviewAggregates = pgTable("review_aggregates", {
  reviewableType: varchar("reviewable_type", { length: 100 }).notNull(),
  reviewableId: uuid("reviewable_id").notNull(),
  ratingAverage: doublePrecision("rating_average").default(0.0).notNull(),
  ratingCount: integer("rating_count").default(0).notNull(),
  helpfulCount: integer("helpful_count").default(0).notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
}, (t) => [
  primaryKey({ columns: [t.reviewableType, t.reviewableId] }),
  index("review_aggregates_reviewable_idx").on(t.reviewableType, t.reviewableId)
]);
