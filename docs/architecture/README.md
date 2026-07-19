# System Architecture

This directory houses technical specifications and service-level architecture documents of record for the WetinDey platform.

## Key Files

* **[SERVICE-ARCHITECTURE.md](SERVICE-ARCHITECTURE.md)**: **The Architecture of Record** detailing what is actually implemented on disk (Next.js server actions, modular monolithic slices, API routes, Mapbox Canvas integration, and derived trust structures).
* **[APP-MAP.md](APP-MAP.md)**: Tombstone file documenting historical structural maps.

## Key Abstractions
* **Derived Trust**: Real-time confidence scores calculated on client browse and observation ingestion, rather than hardcoded ratings.
* **Modular Monolith**: Code-level separation of features under unified Next.js routes.
