# ADR-009: Polymorphic Ratings and Reviews System

**Date:** 2026-07-17  
**Status:** Accepted  
**Owners:** Dr. Dyrane Alexander, Antigravity AI  
**Amends:** nothing.  

## Context

WetinDey aims to evolve from a live food price confirmation service into Nigeria’s trusted local discovery platform (similar to Yelp or Google Maps, but powered by real-time community confirmations). To support this long-term vision, we need to introduce a ratings and reviews system.

A key constraint is that the target of a review could be any entity type—current or future—such as a market place, a specific retail stall, a fuel station, a service provider (barber, tailor, mechanic), a pharmacy, or even individual items/products. We must design a ratings and reviews schema that is generic and polymorphic, allowing us to rate and review any entity type without requiring database migrations or schema alterations in the future.

## Decision

We will implement a polymorphic, decoupled reviews domain in Drizzle ORM consisting of three new tables: `reviews`, `review_helpful_votes`, and `review_aggregates`. 

Instead of traditional table-specific foreign keys (which would require a nullable column for each target table), we will use the **Text-Based Polymorphic Reference** pattern (`reviewable_type` + `reviewable_id`).

### 1. `reviews` Table
Stores individual user reviews.
- `id`: uuid (Primary Key, default random)
- `userId`: uuid (Foreign Key to auth/user table, nullable to support anonymous reviews per ADR-003)
- `reviewableType`: varchar(100) (not null, e.g. `'place'`, `'item'`, `'seller'`, `'service'`)
- `reviewableId`: uuid (not null, matches the target entity's ID)
- `rating`: integer (not null, enforced between 1 and 5)
- `title`: varchar(255) (optional)
- `body`: text (optional)
- `moderationStatus`: varchar(50) (not null, default `'approved'`, values: `'pending'`, `'approved'`, `'flagged'`, `'hidden'`)
- `metadata`: jsonb (not null, default `{}`) for extensible, domain-specific metadata (e.g. photos, specific feature ratings like cleanliness or price-fairness)
- `createdAt`: timestamp (not null, default now)
- `updatedAt`: timestamp (not null, default now)

### 2. `review_helpful_votes` Table
Tracks helpful votes on reviews.
- `id`: uuid (Primary Key, default random)
- `reviewId`: uuid (Foreign Key to `reviews.id`, cascade delete, not null)
- `userId`: uuid (Foreign Key to auth/user table, nullable to support anonymous helpful votes)
- `isHelpful`: boolean (not null, default true)
- `createdAt`: timestamp (not null, default now)
- *Unique Constraint:* `(reviewId, userId)` to prevent duplicate voting from the same user.

### 3. `review_aggregates` Table
Caches pre-computed averages and counts to avoid executing expensive aggregation queries (averages and counts) on list renders.
- `reviewableType`: varchar(100) (not null)
- `reviewableId`: uuid (not null)
- `ratingAverage`: doublePrecision (not null, default 0.0)
- `ratingCount`: integer (not null, default 0)
- `helpfulCount`: integer (not null, default 0)
- `updatedAt`: timestamp (not null, default now)
- *Primary Key:* `(reviewableType, reviewableId)`

### DB Constraints & Indexes
- Index on `(reviewableType, reviewableId)` in both `reviews` and `review_aggregates` to ensure O(1) or O(log N) lookups of reviews for any target.
- Index on `reviews.userId` for user profile lookups.
- Review rating is validated at the application layer to be `1 <= rating <= 5`.

## Alternatives considered

- **Exclusive Foreign Key Columns (Separate nullable IDs):** A `reviews` table containing nullable columns like `place_id`, `item_id`, etc. This preserves native referential integrity constraints in Postgres. However, this was rejected because it fails the core constraint: adding a new entity type (e.g., transport route, generator station) would require running an alter-table schema migration to add a new nullable column.
- **Unified Reviewable Parent Table:** Creating a base `reviewable` table and having every reviewable entity extend it (similar to class inheritance). This preserves referential integrity, but introduces massive join overhead and schema complexity for little benefit in Drizzle.

## Consequences

- **Improves:** Highly extensible. New categories, services, and entity types are instantly reviewable out-of-the-box.
- **Worsens:** Referential integrity cannot be enforced at the PostgreSQL database engine level on `reviewable_id` because it points to dynamic target tables. Application-level validation is required to ensure a review's target entity actually exists.
- **Data consistency:** When an entity is deleted, its reviews and aggregates must be cleaned up manually via database triggers or application logic since cascade foreign keys cannot span multiple tables on the same column.

## Validation and review

This decision is validated by:
1. The reviews schema compiling cleanly in `src/db/schema/reviews.ts`.
2. A database migration generated successfully by `drizzle-kit generate`.
