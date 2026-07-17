# ADR-008: Multi-Category Expansion and Core Pillars of Daily Uncertainty

**Date:** 2026-07-17  
**Status:** Accepted  
**Owners:** Dr. Dyrane Alexander, Antigravity AI  
**Amends:** WETINDEY_BIBLE.md Section 38 (Future Modules)  

## Context

WetinDey was originally conceived as a map-and-sheet decision interface focused solely on food price and availability (the Food module). However, as the product matures beyond MVP toward a full product rollout, there is a need to answer the broader Nigerian daily question: “Wetin dey today?” 

Expanding the PWA into a generic list of 30+ ad-hoc categories would dilute the core value proposition. Instead, the product must deliberately own **daily recurring uncertainties** that Nigerians face in their neighborhoods—uncertainties where price and availability are context-sensitive, fluctuate frequently, and directly impact daily purchasing decisions.

Furthermore, changing the active category must immediately re-contextualize the interface, dynamically updating the PWA's metadata (document title and meta description) to keep search indexing (SEO) and user expectations aligned.

## Decision

We will expand the WetinDey scope from a single-module Food app to a multi-category decision engine structured around **six core pillars of daily uncertainty**. Every category or subcategory must map to one of these six pillars:

1. **🛒 FOOD**
   - *Scope:* Prices, availability, markets, groceries.
   - *Core uncertainty:* Local food item inflation and spot availability at individual stalls.
   
2. **🏠 HOME**
   - *Scope:* Building materials (cement, paint, tiles, iron rods, plumbing), cooking fuels (charcoal, firewood).
   - *Core uncertainty:* Sudden spikes in material prices and local scarcity.

3. **💊 HEALTH**
   - *Scope:* Medicine and personal care (drug availability, pharmacy prices, cosmetics, hair products).
   - *Core uncertainty:* Drug counterfeiting/stock-outs and hyper-local pharmacy pricing discrepancies.

4. **💱 MONEY**
   - *Scope:* Exchange rates (USD, GBP, EUR, Black market vs. official rates).
   - *Core uncertainty:* Parallel market fluctuations and intraday rate volatility.

5. **🚗 TRANSPORT**
   - *Scope:* Mobility fares (bus fares, ride prices, ferry, train).
   - *Core uncertainty:* Fuel-driven transport fare spikes and route-specific price hikes.

6. **📍 COMMUNITY**
   - *Scope:* Local services (mechanic, tailor, barber, electrician), local reports, questions, and seller updates.
   - *Core uncertainty:* Finding vetted, active local service providers and real-time community status reports (e.g., NEPA/Band power outages, generator fuel queues).

### Implementation Rules

- **Interactive Category UI:** The top row of the search view will transition from displaying a static branding header/logo to an interactive navigation row: the brand logo shifts, accompanied by a user avatar, and displays the *current active category* (default: Food) next to a dedicated Filter icon.
- **Dynamic SEO Metadata:** Clicking the category toggle dynamically alters the viewport's active theme, document title, and meta description (e.g., switching from *"WetinDey — Food Prices"* to *"WetinDey — Fuel & Gas Availability"*).
- **Core Architecture Intact:** No new global navigation models, dashboards, or social feeds are permitted. Every pillar will use the existing map-and-sheet model: Context → Intent → Trust → Decision.

## Alternatives considered

- **Ad-Hoc 30-Category Taxonomy:** Rejected. Listing 30+ separate categories on the same level causes visual fatigue, increases navigation latency, and turns the PWA into a generic business directory (like Yelp or Yellow Pages). Grouping them into six pillars preserves cognitive simplicity.
- **Separate Mobile Apps:** Rejected. Launching different apps for food, fuel, and exchange rates breaks cross-utility network effects. A single PWA that answers "Wetin dey today?" across these six axes is the most coherent product strategy.

## Consequences

- **Improves:** Product positioning moves from a "food app" to a comprehensive "neighborhood uncertainty index".
- **Worsens:** The schema and database queries must support multiple tax-types. `Item` must acquire a polymorphic category column or map to a structured category taxonomy.
- **Harder to reverse:** Once users begin logging fuel, power, or exchange rates, the data schema must retain backward compatibility for these entities.

## Validation and review

This decision should be reviewed when:
1. The first non-food category (e.g., Fuel or Exchange Rates) is implemented in database schema and seed data.
2. Analytics indicate whether multi-category tabs increase engagement or distract users from the core food search.
