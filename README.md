# WetinDey

> **Know before you go.**

WetinDey is a map-and-sheet Progressive Web App that helps people find where a specific food item is recently confirmed nearby, understand its current price or price range for a defined unit, and decide where to go with visible freshness and trust signals.

## Version One

Version One contains one complete module: **Food price and availability**.

It does not include delivery, checkout, news, social feeds, or unrelated utility modules.

## Product flow

```text
Context → Intent → Item clarification → Local evidence → Trust evaluation
→ Decision-ready comparison → Action → Outcome feedback → Better data
```

## Stack

- Next.js App Router
- React + TypeScript
- Progressive Web App
- Vercel
- Neon Postgres + PostGIS
- Vercel Blob
- Tailwind CSS
- Runtime schema validation

## Start here

Read the full product constitution before implementation:

- `WETINDEY_PRODUCT_BIBLE_v0.1.md`

## Non-negotiables

- One complete problem before additional modules.
- Map first, never map only.
- Availability plus price, not price alone.
- Every price has a unit and semantic type.
- Every current claim has freshness and provenance.
- Anonymous browsing.
- Progressive disclosure.
- No fake certainty.
- No paid organic ranking.
- Accessibility, offline behavior, dark mode, and failure states are part of the product.
