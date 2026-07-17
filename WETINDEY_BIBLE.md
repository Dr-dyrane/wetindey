# WETINDEY PRODUCT & ENGINEERING BIBLE

**Version:** 0.1 — Full First Draft  
**Status:** Pre-validation / developer handoff draft  
**Date:** 16 July 2026  
**Product:** WetinDey  
**Initial module:** Food price and availability  
**Experience system:** Dyrane UI/UX  
**Delivery target:** Next.js Progressive Web App on Vercel  

> **Know before you go.**

---

## Document status

This is the working constitution for WetinDey. It is detailed enough to align product, design, engineering, data operations, trust and safety, and launch work around one coherent product.

It is not a claim that every business assumption has already been proven. Where evidence is incomplete, this document labels the point as a **hypothesis**, **recommendation**, **open decision**, or **validation requirement**.

WetinDey is inspired by the clarity, restraint, continuity, accessibility, and platform discipline represented in Apple’s Human Interface Guidelines. WetinDey is not affiliated with Apple, and the web product must work beautifully across iOS, Android, and desktop browsers rather than imitate an iPhone interface literally.

The name **WetinDey** is the selected working brand. Legal, trademark, company-name, domain, social-handle, and app-store clearance must still be completed before public launch. A preliminary scan has found unrelated prior uses of “Wetin Dey,” so exclusivity must not be assumed.

---

# Table of contents

1. How to use this Bible  
2. Executive summary  
3. Product identity  
4. The problem  
5. Market reality and research position  
6. Product hypothesis  
7. Users and jobs to be done  
8. Version One scope  
9. Product flow  
10. Experience flow and user flows  
11. The Dyrane UI/UX philosophy  
12. Apple HIG adaptation  
13. Map-and-sheet interaction model  
14. Information architecture  
15. Complete screen inventory  
16. State and edge-case inventory  
17. Design system  
18. Component specifications  
19. Content, language, and localization  
20. Food-module information model  
21. Availability model  
22. Price model  
23. Trust, freshness, and confidence  
24. Data acquisition and market operations  
25. Modular product architecture  
26. Technical architecture  
27. Database architecture  
28. API and data contracts  
29. PWA, offline, and performance requirements  
30. Privacy and security  
31. Analytics and success metrics  
32. Testing and quality assurance  
33. Delivery plan  
34. Departments and responsibilities  
35. Administration and operations console  
36. Launch plan  
37. Growth and monetization guardrails  
38. Modular expansion rules  
39. Risk register  
40. Decision log  
41. Developer implementation brief  
42. Suggested repository structure  
43. Coding standards  
44. Definition of done  
45. Acceptance criteria  
46. Initial copy deck  
47. Research backlog  
48. Glossary  
49. Reference standards  
50. Changelog  

---

# 1. How to use this Bible

## 1.1 Purpose

This document exists to prevent WetinDey from becoming:

- a collection of attractive but disconnected screens;
- a feature-stacked “super app” before it earns a single habit;
- a price dashboard that cannot answer whether an item is actually available;
- a crowdsourcing product that presents weak data with fake certainty;
- an engineering framework so abstract that the first useful experience never ships;
- or an Apple imitation that ignores Nigerian realities, Android users, bandwidth, market language, and informal commerce.

Every contributor must read the relevant sections before changing product behavior, data semantics, or shared components.

## 1.2 Requirement language

- **MUST** means required for the release or principle being described.
- **MUST NOT** means prohibited.
- **SHOULD** means expected unless a documented reason supports an exception.
- **MAY** means optional.
- **PROVISIONAL** means a suggested starting point that requires testing.

## 1.3 Precedence

When instructions conflict, the order of precedence is:

1. Safety, law, privacy, and platform requirements.
2. Product non-negotiables in this Bible.
3. Accepted Architecture Decision Records, or ADRs.
4. Approved product and design specifications.
5. Sprint tickets and implementation details.

No ticket may silently override a product principle. A deliberate change requires an ADR or documented product decision.

## 1.4 What belongs here

This Bible contains stable direction: purpose, scope, interaction rules, data meaning, architecture boundaries, quality standards, and decision criteria.

Implementation details that change frequently should live in code, generated API documentation, migration files, test suites, or ADRs and be referenced from here.

---

# 2. Executive summary

## 2.1 Product sentence

**WetinDey helps a person find where a specific food item is currently available nearby, understand what it should reasonably cost in a clearly defined unit, and decide where to go with visible evidence of freshness and trust.**

## 2.2 The first question

The Version One product should answer:

> **“Where can I get this food item around me now, and what price should I expect?”**

The product does not begin by asking people to study a dashboard. It begins by helping them narrow a real intention.

## 2.3 The Version One experience

A returning user should be able to:

1. Open WetinDey.
2. Confirm or choose an area.
3. Search for one food item using common English, Nigerian Pidgin, or a known local name.
4. Choose the relevant variant and unit only when ambiguity exists.
5. See nearby markets or verified vendors where the item was recently confirmed.
6. Compare availability certainty, freshness, distance, and price or price range.
7. Open one result and take an action: navigate, call where supported, share, or report that the information has changed.

The target is a useful answer within **ten seconds** for a returning user under normal network conditions, not ten seconds to load every possible feature.

## 2.4 The hero outcome

The hero moment is not seeing a beautiful map. It is this:

> “I need brown beans. WetinDey shows that it was confirmed this morning at two nearby places, the expected one-kilogram range, and which option is the more reliable report. I know where to go.”

## 2.5 What WetinDey is not

Version One is not:

- an e-commerce checkout;
- a delivery marketplace;
- a general news application;
- a social network;
- a nationwide food-inflation report;
- a restaurant discovery application;
- a recipe application;
- a vendor point-of-sale system;
- an artificial-intelligence chatbot;
- a feed designed to maximize scrolling;
- or a collection of fuel, electricity, medicine, traffic, weather, and food features.

## 2.6 Long-term architecture, short-term discipline

The code should permit additional problem modules later, but the product should launch with one complete module: **Food**.

The rule is:

> **Build a reusable foundation, not a premature platform. Ship one complete experience, not a demonstration of every future possibility.**

---

# 3. Product identity

## 3.1 Name

**WetinDey**

- Written as one word in the product and company-facing materials.
- Spoken naturally as two words: “Wetin dey?”
- The capitalized form is `WetinDey`.
- The lowercase technical identifier is `wetindey`.

## 3.2 Meaning

“Wetin dey?” is a familiar Nigerian Pidgin question that can mean:

- What is happening?
- What is available?
- What is the situation?
- What is going on here?
- What should I know now?

The product turns the question into a trusted, practical answer.

## 3.3 Working tagline

**Know before you go.**

This line is provisional but strategically strong because it describes the product benefit rather than a list of features.

Alternative supporting lines may be used in campaigns:

- “Check am before you move.”
- “Price. Place. Availability.”
- “Find am. Know the price. Move with confidence.”

The core interface should use clear language rather than forcing a slogan into every screen.

## 3.4 Brand promise

WetinDey promises to be:

- useful before impressive;
- clear before clever;
- honest about uncertainty;
- locally understandable without becoming a caricature;
- fast enough for real errands;
- and respectful of people’s location, identity, and data.

## 3.5 Brand personality

WetinDey is:

- calm;
- observant;
- helpful;
- current;
- grounded;
- warm but not noisy;
- premium but not elitist;
- Nigerian without excluding any region.

WetinDey is not:

- comic relief;
- slang overload;
- a loud marketplace banner;
- a government statistics portal;
- or a fake omniscient authority.

## 3.6 Legal clearance requirement

Before public launch, counsel or a qualified trademark professional must review:

- Nigerian trademark availability in relevant classes;
- company and business-name availability;
- domain options;
- social handles;
- app-store names;
- conflicting prior uses;
- and the risk created by the descriptive nature of the phrase.

The product may continue under the working name during validation, but no document should claim registered ownership until registration is confirmed.

---

# 4. The problem

## 4.1 Core problem statement

People buying food in Nigeria can often discover general price information, purchase groceries from individual sellers, or ask people they know. They may still struggle to answer one immediate, local, decision-level question:

> **“Where nearby is this exact food item available now, in the quantity and quality I mean, and what is a reasonable current price there?”**

The difficulty is not merely a lack of numbers. It is a combination of:

- fragmented sources;
- inconsistent item names;
- inconsistent local units;
- differences in quality, brand, grade, and package size;
- weak or missing availability signals;
- prices that change by market, seller, quantity, negotiation, and time;
- stale reports;
- low confidence in anonymous claims;
- and the cost of travelling to discover that an item is unavailable or materially more expensive than expected.

## 4.2 User cost

When this information is weak, a person may:

- travel to the wrong market;
- spend more than planned;
- call several people or vendors;
- delay a meal, business operation, or household purchase;
- substitute an item unnecessarily;
- or lose confidence in digital price information altogether.

## 4.3 Availability is as important as price

A low price is useless when the item is no longer available.

Therefore WetinDey must never reduce the problem to “price comparison.” Every primary result must answer, as honestly as the data allows:

1. **Is the item available?**
2. **Where?**
3. **In what unit, size, brand, quality, or variant?**
4. **At what price or price range?**
5. **When was this confirmed?**
6. **Who or what supports the claim?**
7. **How much confidence should the user place in it?**

## 4.4 Product opportunity statement

The opportunity is to create the most usable and trusted **decision interface** for local food availability and price, not merely another source of food-price data.

## 4.5 The problem must remain falsifiable

The team must be willing to discover that:

- people prefer calling a trusted trader;
- availability changes too quickly to maintain economically;
- users do not make enough cross-market decisions to return;
- the map adds less value than a simple list;
- or supply-side data is too expensive to collect at consumer-product margins.

Those are research outcomes, not failures of ambition. The product must earn the right to scale.

---

# 5. Market reality and research position

## 5.1 What is already known

Nigeria already has food-price datasets and food-commerce products. Current public examples include:

- the National Bureau of Statistics’ recurring Selected Food Price Watch;
- World Bank market-level monthly food-price estimates;
- Bank of Industry’s PriceSense initiative for food-price monitoring in selected states;
- and commerce platforms such as PricePally that sell and deliver groceries.

This means the product thesis must not be:

> “Nobody has food prices.”

A more defensible working thesis is:

> **Existing sources do not necessarily provide a dominant, consumer-first experience that combines recent availability, exact item definition, local context, price meaning, provenance, and a next action in seconds.**

That thesis still requires direct research.

## 5.2 Preliminary competitive categories

### Public and institutional data

Strengths:

- broad authority;
- historical series;
- standardized reporting;
- regional comparison.

Likely limitations for the WetinDey job:

- publication cadence may not represent live availability;
- geographic resolution may be too broad for an errand;
- designed for analysis rather than a ten-second purchase decision.

### E-commerce and grocery platforms

Strengths:

- known inventory within their own catalog;
- checkout and delivery;
- controlled units and product descriptions.

Likely limitations for the WetinDey job:

- limited to their own supply network;
- not a neutral view of surrounding open markets and vendors;
- may optimize for transactions rather than market-wide information.

### Informal channels

Examples include WhatsApp groups, phone calls, market contacts, social posts, and word of mouth.

Strengths:

- local;
- current when the source is active;
- socially trusted.

Limitations:

- fragmented;
- difficult to search;
- not normalized;
- not consistently timestamped;
- hard to compare.

## 5.3 Research standard

No claim enters the final product brief as fact unless it is supported by one or more of:

- direct interviews;
- observed user behavior;
- structured field collection;
- product analytics;
- credible primary datasets;
- verified competitor inspection;
- or repeatable operational evidence.

“Everyone knows” is not evidence.

---

# 6. Product hypothesis

## 6.1 Primary hypothesis

People who regularly buy food will use WetinDey repeatedly when it gives them a trustworthy answer about **availability plus expected price** quickly enough to change where, when, or how they shop.

## 6.2 Value hypothesis

WetinDey creates value when it does at least one of the following:

- prevents a wasted trip;
- prevents a materially poor purchase decision;
- helps a user choose between nearby options;
- helps a user budget before leaving;
- or confirms that the nearby option is good enough, removing the need for further searching.

## 6.3 Supply hypothesis

A sufficiently fresh data supply can be created through a deliberate combination of:

- verified vendors;
- trained market contributors;
- buyer-submitted observations and receipt evidence;
- community confirmations;
- periodic field audits;
- and public datasets used only as clearly labelled benchmarks, not live stock evidence.

## 6.4 Trust hypothesis

Users will trust the product more when it displays understandable trust signals such as:

- “Confirmed by vendor 28 min ago”;
- “Two recent buyer reports”;
- “Price range from four reports today”;
- “Not confirmed today”;
- or “Monthly reference — not live.”

A raw “97% confidence” should not be shown unless the score has been rigorously calibrated and users understand it. Human-readable evidence is preferred.

## 6.5 Riskiest assumptions

The riskiest assumptions are:

1. Availability can remain current at an affordable operational cost.
2. Items and units can be normalized without confusing users.
3. Users will change decisions based on the product.
4. Contributors can be motivated without creating spam or manipulation.
5. Vendors will tolerate price visibility.
6. A map-first interface is faster than a list for the primary use case.
7. The initial geography can reach enough data density to feel useful.

## 6.6 Validation gates before broad launch

The following are recommended pilot gates:

- At least 20 structured buyer interviews across more than one shopping pattern.
- At least 10 supply-side interviews with traders, vendors, market scouts, or food businesses.
- A 14-day manual data dry run covering the proposed launch items and places.
- Prototype task testing with at least 8 representative users.
- At least 70% successful completion of the hero task without facilitator help.
- At least 80% comprehension of availability, unit, and freshness labels.
- Enough daily observations to keep the launch experience useful during the agreed service window.
- Evidence that the answer changes or confirms a real decision, not merely satisfies curiosity.

These numbers are pilot thresholds, not universal scientific truths. They may be adjusted through documented product decisions.

---

# 7. Users and jobs to be done

## 7.1 Primary user

### Household food buyer

A person buying food for themselves, a family, or a shared household.

Typical needs:

- confirm whether an item is available before going;
- estimate what to carry or transfer;
- choose among nearby markets or vendors;
- understand whether a quoted price is within the current local range.

## 7.2 Secondary users

### Small food business operator

Examples include caterers, food vendors, small restaurants, bakers, and meal-prep businesses.

Needs:

- check several inputs;
- reduce sourcing uncertainty;
- observe changes that affect daily margins.

This segment may eventually pay, but Version One must not become a procurement dashboard.

### Student or young professional

Needs:

- find affordable, accessible quantities;
- compare nearby options without spending transport money unnecessarily;
- understand unfamiliar market units.

### Trader or verified vendor

Needs:

- make availability visible;
- correct stale or incorrect information;
- attract relevant buyers without building a full online store.

### Market contributor

A trained or trusted person who records structured observations.

Needs:

- submit information quickly;
- understand item definitions;
- receive clear feedback about accepted, rejected, or conflicting reports.

## 7.3 Jobs to be done

### Primary job

> When I need to buy a specific food item, help me know where nearby it is recently confirmed, what unit and quality the report refers to, and the price I should expect, so I can choose where to go without wasting time or money.

### Supporting jobs

- When a market price changes, help me understand whether the change is local, broad, or based on weak data.
- When I know a report is wrong or stale, let me correct it without completing a long form.
- When the app cannot confirm an answer, tell me clearly rather than presenting an estimate as fact.

## 7.4 User anxieties

The product must anticipate:

- “Is this price still valid?”
- “Is it the same size I mean?”
- “Is this exact brand or quality?”
- “Will I reach there and hear a different price?”
- “Who reported this?”
- “Is the market open?”
- “How far is it really?”
- “Is my location being tracked?”

## 7.5 Accessibility and situational constraints

Design for people who may be:

- outdoors in strong sunlight;
- using one hand;
- on a low-cost Android device;
- on limited or unstable data;
- unfamiliar with technical map controls;
- using larger text;
- using a screen reader;
- color blind;
- or switching between English, Pidgin, and local item names.

---

# 8. Version One scope

## 8.1 Launch principle

**One complete food decision experience.**

Not a “food section” inside a larger app.

## 8.2 Pilot geography

Version One MUST launch in one deliberately bounded geographic area rather than pretending to cover Nigeria.

The launch area should be selected using:

- founder and team access;
- data-collection feasibility;
- concentration of participating markets or vendors;
- buyer density;
- and the ability to correct reports quickly.

A city must not be selected solely for prestige. The final pilot area is an open decision.

## 8.3 Initial item set

The initial item set SHOULD contain approximately 8–12 high-frequency items with units that can be defined and audited.

A provisional field-research shortlist is:

- local rice;
- imported or branded rice where relevant;
- brown beans;
- white garri;
- tomatoes;
- fresh pepper;
- onions;
- eggs;
- palm oil;
- vegetable oil;
- chicken;
- and one locally important staple for the launch area.

The final list must follow field validation. Do not include an item merely because it is nationally recognizable if its quality and unit cannot be compared reliably in the pilot.

## 8.4 Required user capabilities

Version One MUST support:

1. Browsing without creating an account.
2. Location permission requested in context, not at first paint.
3. Manual area selection when location is denied or unavailable.
4. Search by common item name and known synonym.
5. Variant or unit clarification only when needed.
6. Nearby result discovery on a map and accessible list.
7. Availability status with freshness.
8. Exact vendor price or market price range with unit.
9. Source and evidence summary.
10. Result detail.
11. Navigation or directions handoff.
12. Report or confirmation of changed price or availability.
13. Clear offline and stale-data behavior.
14. Privacy, terms, help, and about pages.
15. A basic operations interface for moderation and data management.

## 8.5 Recommended but deferrable capabilities

These may be added after the core flow is stable:

- saving an item or place;
- sharing a deep link;
- install prompt education;
- optional account creation;
- user report history;
- alerts for saved items;
- vendor self-service profile;
- and richer price history.

## 8.6 Explicit non-goals

Version One MUST NOT include:

- payment or checkout;
- delivery logistics;
- shopping carts;
- chat between buyers and vendors;
- public comments;
- follower systems;
- gamified streaks;
- general news;
- unrelated WetinDey modules;
- nationwide coverage claims;
- automated AI recommendations presented without evidence;
- paid organic ranking;
- or exact stock counts unless a verified system supplies them.

---

# 9. Product flow

## 9.1 Definition

A **user flow** describes the screens and actions a person moves through.

A **system flow** describes how software and data services process a request.

A **product flow** describes how the product turns a real-world problem and imperfect signals into a useful decision and then learns from the outcome.

For WetinDey, product flow is the answer to:

> **“How does this product consistently carry a person from uncertainty to a trustworthy food-buying decision?”**

## 9.2 Core WetinDey product flow

```text
Context
  ↓
Intent
  ↓
Item clarification
  ↓
Local data retrieval
  ↓
Freshness and trust evaluation
  ↓
Decision-ready comparison
  ↓
Evidence and detail
  ↓
User action
  ↓
Outcome or correction
  ↓
Data improvement
```

## 9.3 Product-flow stages

### Stage 1 — Establish context

The product understands the relevant area through:

- current approximate location;
- a manually selected area;
- a saved default area;
- or a deep-linked place.

The product must not require precise continuous location tracking.

### Stage 2 — Capture intent

The product asks one clear question:

> **“Wetin you dey find?”**

The user searches or chooses a recent/popular item.

### Stage 3 — Clarify only necessary ambiguity

If the term is ambiguous, the product asks the smallest possible follow-up:

- local or imported rice;
- one kilogram or full bag;
- fresh tomatoes or canned tomatoes;
- crate or dozen eggs.

If there is no ambiguity, this step disappears.

### Stage 4 — Retrieve local candidates

The system retrieves relevant places and observations within the active radius or area.

Candidates with no usable availability or price evidence must not be promoted merely to fill the map.

### Stage 5 — Evaluate trust

The product evaluates:

- source type;
- source history;
- timestamp;
- evidence;
- corroboration;
- item and unit match;
- geographic precision;
- and anomaly risk.

### Stage 6 — Present a decision, not a database dump

The initial sheet should show a small number of useful choices, ranked by a transparent combination of:

1. availability certainty;
2. freshness;
3. item and unit match;
4. distance or travel relevance;
5. and price relevance.

The cheapest result is not automatically first.

### Stage 7 — Reveal evidence progressively

The user may expand a result to see:

- exact source type;
- confirmation time;
- price observations;
- availability confirmations;
- known limitations;
- directions;
- market or vendor details;
- and correction actions.

### Stage 8 — Enable a next action

A result should lead to one primary next action, usually:

- get directions;
- view place details;
- call a verified vendor;
- or report an update.

### Stage 9 — Close the loop

After a reasonable interval, the product may ask a low-friction question such as:

- “You see am there?”
- “Price still correct?”
- “Item finish?”

The user must be able to dismiss this permanently for that session.

### Stage 10 — Improve the data

Confirmed outcomes update:

- observation quality;
- source reputation;
- current availability state;
- and future ranking.

Corrections remain auditable; old observations are not silently rewritten.

## 9.4 Product flow when no reliable answer exists

```text
Intent
  ↓
No sufficiently fresh evidence
  ↓
Explain the gap honestly
  ↓
Show older reference separately, if useful
  ↓
Offer nearby places without claiming stock
  ↓
Invite a report or notify-me action
```

The correct answer may be:

> “We never confirm am for your area today.”

That is better than false certainty.

## 9.5 Product-building flow

The internal build cycle is intentionally short:

```text
Validated problem
  ↓
Defined solution
  ↓
Dyrane experience rules
  ↓
Module contract
  ↓
Implementation
  ↓
Observed use
  ↓
Improvement
```

Research is continuous, but the team should not repeatedly reopen already-settled foundation choices without evidence.

---

# 10. Experience flow and user flows

## 10.1 Experience flow

The desired emotional and cognitive sequence is:

```text
Uncertainty
  ↓
Orientation
  ↓
Narrowing
  ↓
Understanding
  ↓
Confidence
  ↓
Action
  ↓
Closure
```

The interface should make the user feel carried along, not forced to construct the answer themselves.

## 10.2 New-user flow

```text
Open app
  ↓
See useful shell immediately
  ↓
Search or choose an item
  ↓
When location becomes necessary, explain why
  ↓
Allow location OR choose area manually
  ↓
See map and result sheet
  ↓
Open result
  ↓
Take action
```

Rules:

- Do not place a multi-screen onboarding carousel before value.
- Do not ask for notifications, account creation, contacts, or background location.
- Location permission must have an adjacent manual alternative.

## 10.3 Returning-user hero flow

```text
Open
  ↓
Previous area restored
  ↓
Tap search
  ↓
Choose recent item
  ↓
Results appear
  ↓
Tap best-fit result
  ↓
Get directions
```

## 10.4 Search flow

```text
Tap “Wetin you dey find?”
  ↓
Type “beans”
  ↓
See canonical item and synonyms
  ↓
Select “Brown beans”
  ↓
Choose unit only if needed
  ↓
Results update without a full-page break
```

## 10.5 Result comparison flow

```text
Item selected
  ↓
Map markers update
  ↓
Sheet shows 3–5 ranked options
  ↓
User scans availability, freshness, distance, and price
  ↓
User opens one option
```

## 10.6 Result-detail flow

```text
Open result
  ↓
See item match and current status
  ↓
See price or range, unit, and timestamp
  ↓
See why WetinDey trusts or limits the result
  ↓
Directions / call / share / report change
```

## 10.7 Contribution flow

```text
Tap “Report update”
  ↓
Confirm place and item
  ↓
Choose availability
  ↓
Enter price if known
  ↓
Confirm unit and variant
  ↓
Optional evidence photo
  ↓
Review
  ↓
Submit
  ↓
See “Under review” or “Added” state
```

The form must adapt. If a user reports “unavailable,” price fields disappear.

## 10.8 Location-denied flow

```text
Location unavailable
  ↓
Explain: “Choose your area to see nearby results”
  ↓
Search area or move map
  ↓
Continue with identical product flow
```

No shame, warning color, or repeated permission pressure.

## 10.9 Offline flow

```text
Open app offline
  ↓
Show cached shell and last successful area
  ↓
Label results “Last synced…”
  ↓
Allow browsing cached details
  ↓
Queue a report locally if supported
  ↓
Sync only after connectivity returns and user consent remains valid
```

---

# 11. The Dyrane UI/UX philosophy

## 11.1 Core statement

> **Dyrane UI/UX carries the user from context to a better decision through progressive disclosure, honest confidence, and purposeful continuity.**

## 11.2 Principle 1 — Context first

Information becomes useful through context.

For WetinDey, context includes:

- place;
- item;
- unit;
- time;
- source;
- and the user’s immediate intention.

The map is an expression of context, not a decorative background.

## 11.3 Principle 2 — Decision first

Do not stop at displaying data.

Bad:

```text
Brown beans
₦2,400
```

Better:

```text
Brown beans · 1 kg
Confirmed today
₦2,250–₦2,450 nearby
```

Best, when supported:

```text
Brown beans · 1 kg
Available at Oyingbo Market
₦2,300 · confirmed 28 min ago
Within today’s nearby range
```

The product interprets only what the evidence supports.

## 11.4 Principle 3 — Progressive disclosure

At each moment, show only what helps the next decision.

Sequence:

1. What item?
2. Which exact version, only if needed?
3. Where is it available?
4. Which option fits?
5. Why should I trust it?
6. What should I do next?

Do not show charts, contributor history, and methodology before the user asks for detail.

## 11.5 Principle 4 — Confidence over completeness

Five trustworthy results are better than fifty uncertain markers.

The product may display fewer results, a smaller coverage area, or an honest no-answer state to protect trust.

## 11.6 Principle 5 — Honest interfaces

WetinDey MUST NOT:

- label an old report as live;
- call an estimate an observed price;
- call a market-level range a vendor price;
- claim stock when only historical availability exists;
- use fake loading progress;
- or hide paid placement inside organic ranking.

## 11.7 Principle 6 — One primary action

Every state should have one visually dominant next action.

Examples:

- Home: search.
- Result: view details or directions, depending on state.
- Empty result: change area or report availability.
- Report form: submit update.

Secondary actions remain available without competing for attention.

## 11.8 Principle 7 — Continuity over navigation

The interface should transform rather than repeatedly replace the user’s world.

- The map remains in context.
- The sheet expands and contracts.
- Item selection updates the same surface.
- A marker and its result card remain visibly connected.
- Back returns the user to the prior map position and sheet detent.

## 11.9 Principle 8 — Performance is part of design

A beautiful interface that wastes data, drains battery, or blocks on a map SDK is not premium.

WetinDey should feel light, immediate, and resilient.

## 11.10 Principle 9 — Local clarity, not forced slang

Pidgin may create warmth, but task-critical information must remain unmistakable.

Use:

- familiar item names;
- local synonyms;
- concise Pidgin prompts;
- plain English explanations where precision matters.

Avoid writing every sentence in exaggerated Pidgin.

## 11.11 Principle 10 — Accessibility is default quality

Accessibility is not a later compliance pass. Components, motion, colors, content order, map alternatives, and touch sizes must be designed accessibly from the first implementation.

---

# 12. Apple HIG adaptation

## 12.1 What WetinDey takes from Apple

WetinDey adopts these disciplines:

- clear hierarchy;
- familiar interactions;
- restrained surfaces;
- system typography;
- generous touch targets;
- meaningful motion;
- accessibility;
- dark-mode support;
- progressive permissions;
- and consistency across states.

## 12.2 What WetinDey does not copy

WetinDey must not:

- reproduce Apple screens pixel for pixel;
- rely on iOS-only gestures;
- make Android feel secondary;
- use Apple trademarks or proprietary assets improperly;
- assume all users have high-end devices;
- or introduce translucent layers that reduce readability and performance.

## 12.3 Web-first platform interpretation

The PWA should use platform-adaptive behavior:

- system font stack;
- safe-area CSS variables;
- native-feeling form controls where helpful;
- keyboard and pointer support on desktop;
- browser history that behaves predictably;
- install mode enhancements without breaking normal web use;
- and graceful feature detection.

## 12.4 Touch targets

Interactive targets MUST be at least 44 by 44 CSS pixels, with 48 pixels preferred on dense mobile screens where space permits.

Adjacent targets require enough separation to prevent accidental activation.

## 12.5 Permissions

Ask only in context:

- Location when the user requests nearby results.
- Camera when the user chooses to add evidence.
- Notifications only after a specific alert value is understood and requested.

Every permission request needs a non-blocking alternative when technically possible.

## 12.6 Search

The search field should:

- be immediately recognizable;
- include a search icon;
- include a clear action;
- use meaningful placeholder copy;
- support recent searches;
- tolerate spelling variation;
- and maintain focus and keyboard behavior correctly.

## 12.7 Sheets

The bottom sheet is the primary decision surface on mobile.

It should:

- use stable detents;
- preserve map context;
- remain keyboard-safe;
- use a visible grabber only when dragging is supported;
- avoid nested vertical scroll until the large detent;
- and provide equivalent buttons for users who cannot or do not use drag gestures.

## 12.8 Motion and reduced motion

Motion should explain continuity. When the operating system or browser requests reduced motion:

- remove large automatic map flights;
- replace springy sheet movement with short fades or direct state changes;
- avoid repetitive marker pulsing;
- and preserve full usability.

## 12.9 Dark mode

Dark mode MUST be designed, not automatically inverted.

Maps, markers, text, separators, evidence images, inputs, status colors, and shadows must be tested independently.

## 12.10 Icons

The PWA should use a licensed, consistent web icon set or custom icons. SF Symbols may be referenced for design language but must only be used where licensing and platform terms allow.

Icons must have accessible labels when their meaning is not duplicated in visible text.

---

# 13. Map-and-sheet interaction model

## 13.1 Core model

> **The map answers “where.” The sheet answers “what does this mean, and what should I do?”**

## 13.2 Map first, not map only

The map is the primary context surface, but every essential result must also be available in a structured list.

Reasons:

- screen readers need an equivalent result structure;
- some users understand lists faster;
- maps may fail or load slowly;
- low bandwidth should not block the decision;
- and dense marker clusters can obscure comparison.

## 13.3 Home state

The map displays:

- current or selected area;
- a subtle location marker where permission exists;
- no irrelevant food markers before an item is selected;
- and minimal map chrome.

The collapsed sheet displays:

- `Wetin you dey find?` search field;
- current area;
- recent items, if available;
- and a clear manual-area control.

## 13.4 Result state

After an item is selected:

- the map displays only relevant places;
- markers express status, not price alone;
- the sheet opens to a medium detent;
- the top summary names the item, unit, and active radius;
- and the first 3–5 results are visible.

## 13.5 Suggested sheet detents

Provisional mobile detents:

- **Peek:** approximately 18–22% of usable viewport height.
- **Medium:** approximately 50–58%.
- **Large:** approximately 88–94%, respecting safe areas.

Do not hard-code only viewport percentages. Content, keyboard, safe areas, and short devices must be handled.

## 13.6 Desktop and tablet adaptation

On wider screens:

- the sheet becomes a persistent side panel;
- the map remains visible;
- detail may open in the panel rather than a modal;
- keyboard focus order must follow visual order;
- and the URL must preserve selected item and place.

## 13.7 Marker behavior

Markers must:

- reflect availability confidence through shape or icon plus color;
- maintain a minimum hit area larger than the visible marker;
- cluster at lower zoom levels;
- highlight the corresponding result card;
- and never rely on red/green alone.

Suggested states:

- Confirmed available.
- Likely available.
- Low or uncertain availability.
- Reported unavailable.
- Stale or unconfirmed.

## 13.8 Camera behavior

The map may reposition when:

- the user selects an item;
- the user selects a result outside the current view;
- or the user explicitly asks to recenter.

The map MUST NOT repeatedly fight manual panning.

After the user moves the map, show a restrained `Search this area` action rather than automatically changing all results on every pixel of movement.

## 13.9 List toggle

A `Map / List` control should be available once results exist.

The user’s last choice may be remembered locally.

## 13.10 Back behavior

Back should close layers in this order:

1. transient popover or alert;
2. full detail to result list;
3. result list to initial search state;
4. app route history.

Back must not unexpectedly discard a draft report.

---

# 14. Information architecture

## 14.1 Primary domain objects

- **Area:** a named geographic context.
- **Place:** a market, store, stall cluster, or verified vendor location.
- **Market:** a place containing multiple sellers or sections.
- **Vendor:** an identifiable seller that may exist inside or outside a market.
- **Item:** canonical food concept, such as brown beans.
- **Variant:** quality, brand, species, origin, processing, or package distinction.
- **Unit:** canonical quantity used to interpret price.
- **Local unit:** locally used measure mapped to a canonical unit when possible.
- **Offer:** a current derived representation of item, place, price, and availability.
- **Observation:** an immutable report about price or availability at a time.
- **Source:** the person, partner, system, or dataset supporting an observation.
- **Evidence:** receipt, photo, vendor confirmation, field audit, or other support.
- **Trust assessment:** the system’s evaluation of how the observation should be used.
- **Freshness state:** how current the information is for the item category.

## 14.2 Primary hierarchy

```text
Area
  └── Place
       └── Vendor, optional
            └── Offer
                 ├── Item
                 ├── Variant
                 ├── Unit
                 ├── Availability
                 ├── Price
                 ├── Observations
                 └── Evidence
```

## 14.3 User-facing hierarchy

```text
Search item
  ↓
Clarify variant/unit
  ↓
Compare nearby places
  ↓
Inspect one place/offer
  ↓
Act or report change
```

## 14.4 Route architecture

Recommended public routes:

```text
/                         Map-and-sheet home
/item/[itemSlug]          Deep-linked item context
/place/[placeSlug]        Public place detail
/report                   Contribution entry
/report/success           Submission confirmation
/settings                 Preferences and permissions guidance
/help                     Help and data explanation
/about                    Product purpose
/privacy                  Privacy notice
/terms                    Terms of use
/status                   Service and data-status page, optional
```

Recommended protected operations routes:

```text
/ops                      Operations overview
/ops/observations         Moderation queue
/ops/places               Place management
/ops/items                Item and unit management
/ops/sources              Contributor and partner management
/ops/anomalies            Data conflict and anomaly review
/ops/audits               Field audit management
/ops/analytics            Coverage and quality metrics
```

## 14.5 URL state

Map state that matters should be shareable where practical:

```text
/?item=brown-beans&unit=kg&lat=...&lng=...&zoom=...
```

Do not expose precise private location in share URLs without an explicit user action. Prefer area or rounded coordinates.

---

# 15. Complete screen inventory

## 15.1 Public product screens

### A. App entry / home

Purpose: establish context and capture item intent.

Required elements:

- app mark or wordmark;
- selected area;
- search field;
- map;
- location/recenter control;
- recent items or restrained suggestions;
- settings access.

### B. Search overlay or expanded sheet

Purpose: resolve the item quickly.

Required states:

- empty search;
- recent searches;
- popular items in launch area;
- typed results;
- spelling correction;
- no match;
- ambiguous match;
- loading.

### C. Item clarification

Purpose: resolve only material ambiguity.

Examples:

- local versus imported rice;
- 1 kg versus 50 kg bag;
- eggs by crate versus dozen;
- palm oil by litre versus local container.

### D. Results map and list

Purpose: show decision-ready nearby options.

Required elements:

- selected item and unit;
- active area or radius;
- result count;
- map/list control;
- ranked result cards;
- freshness summary;
- `Search this area` action after map movement;
- report gap action when coverage is weak.

### E. Offer or place detail

Purpose: explain the result and support an action.

Required elements:

- place name;
- item, variant, and unit;
- availability status;
- price or range;
- last confirmed time;
- source/evidence summary;
- distance or area;
- directions;
- call if verified;
- share;
- report change;
- limitation note.

### F. Report update

Purpose: collect a structured, low-friction observation.

Required steps:

- item;
- place;
- availability;
- price if applicable;
- unit/variant;
- time observed;
- optional evidence;
- optional note;
- review and submit.

### G. Report success

Purpose: acknowledge contribution and explain what happens next.

Possible states:

- published immediately;
- awaiting corroboration;
- awaiting moderation;
- rejected due to duplicate or invalid data;
- saved offline for later sync.

### H. Settings

Required groups:

- default area;
- map/list preference;
- language preference when supported;
- appearance: system/light/dark;
- reduced-data mode;
- privacy and location explanation;
- clear recent searches;
- account controls when accounts exist.

### I. Help and trust explanation

Purpose: explain:

- what availability labels mean;
- how prices and ranges are calculated;
- why reports can differ;
- how to report an error;
- how personal data is used.

### J. Privacy, terms, and about

These must be complete and readable before public launch.

## 15.2 Operations screens

- Ops dashboard.
- Observation review.
- Conflict comparison.
- Evidence viewer.
- Place editor.
- Item taxonomy editor.
- Unit conversion editor.
- Source profile and reliability history.
- Field-audit assignment.
- Coverage map.
- Freshness dashboard.
- Abuse and security events.
- Audit log.

---

# 16. State and edge-case inventory

Every primary screen must define the following where applicable.

## 16.1 Loading states

- first app shell;
- map library loading;
- search suggestions;
- results retrieval;
- detail retrieval;
- report submission;
- evidence upload;
- offline sync.

Rules:

- Prefer skeletons that resemble final structure.
- Do not use indefinite spinners when a useful cached state exists.
- Do not animate large map placeholders continuously.

## 16.2 Empty states

- no recent searches;
- no item match;
- item unsupported;
- no recent observations in area;
- no places in radius;
- no evidence;
- no saved offline data.

## 16.3 Error states

- network failure;
- map-provider failure;
- database/API failure;
- invalid deep link;
- upload failure;
- location error;
- report rejected;
- rate limited;
- service unavailable.

Every error should include a recovery action when recovery is possible.

## 16.4 Location states

- not requested;
- permission granted;
- approximate location;
- precise location;
- permission denied;
- browser unsupported;
- location timeout;
- manual area selected;
- selected area outside coverage.

## 16.5 Data-quality states

- confirmed recently;
- corroborated;
- single recent report;
- stale;
- conflicting;
- inferred benchmark;
- reported unavailable;
- unknown;
- under moderation.

## 16.6 Connectivity states

- online;
- slow connection;
- offline with cache;
- offline without cache;
- reconnecting;
- queued contribution;
- sync conflict.

## 16.7 Accessibility states

- keyboard-only navigation;
- screen reader;
- 200% text scaling;
- high contrast;
- reduced motion;
- landscape;
- zoomed browser;
- color-blind perception.

---

# 17. Design system

## 17.1 Design-system objective

Create a restrained, accessible, reusable system that makes every future module feel familiar without forcing every problem into identical content.

## 17.2 Naming

Use semantic tokens rather than visual names.

Good:

```text
--color-background
--color-surface
--color-text-primary
--color-status-confirmed
```

Avoid:

```text
--light-gray
--green-button
```

## 17.3 Provisional color system

The following is a starting proposal, not finalized brand artwork.

### Light appearance

```text
Background          #F7F7F5
Surface             #FFFFFF
Surface elevated    #FFFFFF
Text primary        #111113
Text secondary      #626268
Text tertiary       #85858C
Separator           rgba(60, 60, 67, 0.18)
Accent              #087A50
Accent pressed      #066540
Confirmed           #248A3D
Caution             #A96500
Unavailable         #C9342F
Information         #2678D9
Focus ring          #0A84FF
```

### Dark appearance

```text
Background          #0B0B0C
Surface             #1C1C1E
Surface elevated    #252528
Text primary        #F5F5F7
Text secondary      #B1B1B7
Text tertiary       #85858C
Separator           rgba(84, 84, 88, 0.60)
Accent              #35B57B
Confirmed           #45B85B
Caution             #E1A23A
Unavailable         #F06A64
Information         #64A8FF
Focus ring          #64A8FF
```

Rules:

- Color never carries meaning alone.
- All text combinations must meet WCAG AA contrast at minimum.
- Tertiary text must not contain essential information.
- Map colors must be tested separately from UI surfaces.

## 17.4 Typography

Use the system font stack:

```css
font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
  Helvetica, Arial, sans-serif;
```

Do not ship proprietary font files without a valid license.

Provisional type scale:

| Token | Size / line | Weight | Use |
|---|---:|---:|---|
| Display | 32 / 38 | 700 | Rare hero headings |
| Title 1 | 28 / 34 | 700 | Major page title |
| Title 2 | 24 / 30 | 650 | Sheet/detail heading |
| Title 3 | 20 / 26 | 650 | Section heading |
| Body | 17 / 24 | 400 | Primary content |
| Body strong | 17 / 24 | 600 | Emphasis |
| Callout | 16 / 22 | 400 | Supporting content |
| Subheadline | 15 / 20 | 500 | Metadata |
| Footnote | 13 / 18 | 400 | Secondary metadata |
| Caption | 12 / 16 | 500 | Compact labels |

Rules:

- Support browser text zoom without clipping.
- Avoid all-caps labels except very short technical statuses.
- Prices use tabular numerals where available.
- Do not shrink essential copy to fit one line.

## 17.5 Spacing

Use a four-point base scale:

```text
4, 8, 12, 16, 20, 24, 32, 40, 48, 64
```

Primary mobile page padding: 16–20 px.  
Sheet content padding: 20 px preferred.  
Dense metadata gaps: 4–8 px.  
Card-to-card gap: 12 px.  
Section gap: 24–32 px.

## 17.6 Radius

```text
Small control       10 px
Input/button        12–14 px
Card                16 px
Large card/sheet    20–28 px
Pill                999 px
```

Avoid giving every nested element a large radius.

## 17.7 Elevation

Elevation should communicate layering, not luxury decoration.

- Map controls: subtle shadow and opaque surface.
- Sheet: strong separation from map using material, border, or shadow.
- Cards inside sheet: minimal or no shadow; use separators and surfaces.
- Modals: reserved for interruption or confirmation.

## 17.8 Materials and blur

Translucency MAY be used for top controls and sheet chrome when:

- text remains readable;
- device performance remains acceptable;
- reduced-transparency preferences are respected where detectable;
- and content does not become visually noisy.

Provide an opaque fallback.

## 17.9 Motion tokens

Provisional durations:

```text
Instant state       80–120 ms
Micro feedback      140–180 ms
Standard transition 200–260 ms
Sheet transition    280–380 ms
Map camera          300–500 ms, user interruptible
```

Preferred easing:

- decelerate for entering elements;
- accelerate for exiting elements;
- spring behavior for direct manipulation only;
- no bounce for serious error or trust states.

## 17.10 Responsive breakpoints

Content-driven provisional breakpoints:

```text
Compact     < 640 px
Medium      640–1023 px
Wide        ≥ 1024 px
```

Do not design only for named devices.

## 17.11 Safe areas

Installed PWA layouts must respect:

```css
padding-top: env(safe-area-inset-top);
padding-right: env(safe-area-inset-right);
padding-bottom: env(safe-area-inset-bottom);
padding-left: env(safe-area-inset-left);
```

## 17.12 Focus

- Every interactive control must have a visible focus style.
- Focus must not be removed for aesthetic reasons.
- Sheet opening moves focus only when appropriate.
- Closing a layer restores focus to the invoking control.

---

# 18. Component specifications

## 18.1 AppShell

Purpose: shared application frame.

Responsibilities:

- safe areas;
- theme;
- offline banner;
- global error boundary;
- install-mode detection;
- route announcements for assistive technology;
- and sheet/map coordination.

## 18.2 MapCanvas

Props should be provider-neutral.

Responsibilities:

- map rendering;
- marker layers;
- clustering;
- selected marker;
- area boundary where available;
- camera state;
- reduced-motion behavior;
- provider failure fallback.

Must not contain food-domain ranking logic.

## 18.3 ContextSheet

States:

- peek;
- medium;
- large;
- keyboard-adjusted;
- dragging;
- reduced motion;
- desktop panel.

Rules:

- sheet state must be controllable, not gesture-only;
- nested scroll begins only when the sheet is sufficiently expanded;
- headers may remain sticky at large detent;
- body scroll position is preserved when detail closes.

## 18.4 SearchField

Required behavior:

- accessible label;
- search icon;
- clear button;
- recent queries;
- debounce for remote suggestions;
- immediate local synonym matching;
- keyboard submit;
- loading indicator that does not shift layout;
- spelling tolerance;
- voice input only if browser/platform support is reliable and optional.

Placeholder:

> `Wetin you dey find?`

## 18.5 AreaSelector

Displays:

- current area name;
- location state;
- manual search;
- coverage notice;
- recenter action.

It must not reveal precise coordinates as normal UI.

## 18.6 ItemResult

Displays:

- canonical name;
- local synonym where helpful;
- variant;
- unit;
- optional thumbnail only when it improves recognition.

## 18.7 ResultCard

Required hierarchy:

1. Place name.
2. Availability state.
3. Price or range and unit.
4. Freshness/source summary.
5. Distance or area.
6. Primary action.

Do not display more than two badges above the fold.

## 18.8 PriceDisplay

Variants:

- exact observed vendor price;
- current market range;
- typical nearby range;
- older benchmark;
- price unavailable.

It MUST always display:

- currency;
- unit;
- and semantic type.

Examples:

```text
₦2,300 / kg
Vendor price · 28 min ago
```

```text
₦2,250–₦2,450 / kg
Range from 4 reports today
```

## 18.9 AvailabilityBadge

Recommended user-facing labels:

- `Confirmed available`
- `Likely available`
- `Low stock reported`
- `Reported unavailable`
- `Not confirmed today`

Each includes an icon or shape plus text.

## 18.10 FreshnessLabel

Examples:

- `Updated 18 min ago`
- `Confirmed this morning`
- `Last confirmed yesterday`
- `Monthly reference — not live`

The accessible name may include the exact timestamp.

## 18.11 TrustSummary

Purpose: explain why the result is shown.

Examples:

- `Verified vendor update`
- `2 buyer reports today`
- `Field agent + receipt`
- `Single community report`
- `Older public benchmark`

Expandable detail may show methodology.

## 18.12 MapMarker

Visual dimensions may be compact, but hit target must be at least 44 px.

Marker state must distinguish:

- normal;
- selected;
- clustered;
- stale;
- unavailable;
- loading.

## 18.13 PrimaryButton

Rules:

- one primary button per decision state;
- minimum 44 px height, 48–52 preferred;
- clear verb;
- disabled state only when the reason is visible;
- loading state preserves width;
- destructive style only for destructive actions.

## 18.14 ReportForm

The form must be schema-driven so future modules can reuse the flow.

Fields appear based on prior answers.

Required UX:

- autosave draft locally;
- inline validation;
- unit explanation;
- evidence preview;
- clear privacy note;
- review before final submit when material ambiguity exists.

## 18.15 OfflineBanner

Copy examples:

- `You’re offline. Showing data saved at 8:42 AM.`
- `Report saved. We’ll send it when you reconnect.`

Never imply current availability while offline.

## 18.16 EmptyDecisionState

Structure:

1. What is missing.
2. Why it matters.
3. The safest available alternative.
4. One action.

Example:

> **We never confirm brown beans around Yaba today.**  
> You can widen the area or report a place where you saw it.

## 18.17 Toasts and alerts

Toasts are for non-critical confirmation. Alerts are reserved for information that requires immediate attention or a decision.

Do not use a modal alert for ordinary validation errors.

---

# 19. Content, language, and localization

## 19.1 Voice

WetinDey speaks like a capable Nigerian guide:

- direct;
- respectful;
- concise;
- warm;
- and transparent.

## 19.2 Language strategy

The first interface may use a controlled blend of English and Nigerian Pidgin.

Recommended pattern:

- Pidgin for welcoming prompts and memorable actions.
- Plain English for legal, privacy, error recovery, unit, price, and trust explanations.
- Local-language item aliases in search.

## 19.3 Pidgin rules

- Prefer widely understood phrases.
- Avoid region-specific slang in essential controls unless research supports it.
- Do not mimic accents.
- Do not use Pidgin to soften serious privacy, safety, or financial information.

## 19.4 Search aliases

Each item may contain:

- canonical English name;
- Pidgin name;
- Hausa aliases;
- Igbo aliases;
- Yoruba aliases;
- regional market names;
- common misspellings;
- brand terms where relevant.

Aliases map to one canonical item or prompt a clarification.

## 19.5 Currency

Display Nigerian naira using `₦` and locale-aware separators.

Examples:

- `₦950`
- `₦2,450`
- `₦82,000`

Avoid unnecessary decimals.

## 19.6 Relative time

Use human-readable relative time with exact time available to assistive technology or detail views.

Example visible text:

> `Updated 28 min ago`

Accessible/detail text:

> `Updated 10:32 AM on 16 July 2026`

## 19.7 Prohibited claims

Do not say:

- `Best price` without sufficiently complete comparable coverage.
- `Cheapest` when not all relevant sellers are represented.
- `Available now` from an old or inferred report.
- `Verified` without a defined verification process.
- `Live` for periodic updates.
- `Guaranteed` unless WetinDey contractually guarantees the outcome.

## 19.8 Tone examples

Good:

> `Confirmed 35 min ago by a verified vendor.`

Good:

> `This price is from yesterday. Check before you move.`

Bad:

> `100% accurate! Rush now!`

---

# 20. Food-module information model

## 20.1 Canonical item

A canonical item is the stable food concept used for search and aggregation.

Example:

```text
Item: Rice
```

## 20.2 Variant

A variant captures a meaningful comparison distinction.

Examples:

```text
Rice → local, imported, parboiled, long-grain, branded
Beans → brown, white, black-eyed
Tomato → fresh plum, cherry, canned
Chicken → live, whole dressed, frozen, per kilogram
```

Do not create a variant for every seller description. Variants should exist only when the distinction changes user intent or price comparability.

## 20.3 Unit

Each observation must reference a unit.

Canonical units may include:

- kilogram;
- gram;
- litre;
- millilitre;
- piece;
- dozen;
- crate with defined count;
- bag with defined weight;
- carton with defined contents.

## 20.4 Local unit

Informal units such as paint bucket, mudu, basket, heap, or measure may be supported only when:

- the local definition is documented;
- the place or region is known;
- variation is communicated;
- and a canonical conversion is not falsely precise.

Example:

```text
1 paint bucket · seller measure
Approximate equivalent unavailable
```

This is better than inventing a kilogram conversion.

## 20.5 Quality attributes

Potential attributes:

- origin;
- grade;
- freshness;
- size;
- processing;
- brand;
- packaging;
- organic claim where verifiable;
- frozen/chilled/fresh;
- broken grain percentage where relevant.

Only attributes users understand and contributors can report reliably belong in Version One.

## 20.6 Market-level versus vendor-level information

A market-level result means:

> Recent observations suggest the item is available within this market.

A vendor-level result means:

> This identified vendor recently confirmed or was observed selling the item.

The UI must not present the market-level claim as a guaranteed vendor stock item.

## 20.7 Example canonical record

```json
{
  "item": "brown-beans",
  "displayName": "Brown beans",
  "variant": "standard-open-market",
  "unit": {
    "type": "mass",
    "value": 1,
    "symbol": "kg"
  },
  "place": "example-market",
  "availability": "confirmed_available",
  "price": {
    "currency": "NGN",
    "amount": 2300,
    "kind": "observed_vendor_price"
  },
  "observedAt": "2026-07-16T09:32:00Z",
  "sourceType": "trained_field_contributor"
}
```

---

# 21. Availability model

## 21.1 Availability is time-bound evidence

Availability is not a permanent property. It is a claim about an item, place, and time.

## 21.2 Internal availability states

Recommended internal enum:

```text
confirmed_available
likely_available
low_stock_reported
confirmed_unavailable
unknown
stale
conflicting
```

## 21.3 User-facing meaning

### Confirmed available

Recent, sufficiently trusted evidence supports availability.

### Likely available

Evidence is recent enough to be useful but weaker, indirect, or not independently corroborated.

### Low stock reported

A trusted source reported limited quantity. This state should expire quickly.

### Reported unavailable

Recent evidence supports unavailability. It does not mean every vendor in a large market is out.

### Not confirmed

The product has no sufficiently fresh, specific evidence.

## 21.4 Freshness windows

Freshness depends on category and source.

Provisional starting rules:

| Category | Fresh | Aging | Stale |
|---|---:|---:|---:|
| Highly perishable produce | ≤ 6 h | 6–18 h | > 18 h |
| Daily open-market staples | ≤ 24 h | 24–72 h | > 72 h |
| Packaged shelf-stable goods | ≤ 72 h | 3–7 d | > 7 d |
| Vendor-declared scheduled stock | Defined by vendor expiry | — | After expiry |

These windows must be calibrated through operations. They are not universal truths.

## 21.5 Availability aggregation

When several observations exist:

- more recent observations have greater influence;
- exact item and unit matches beat broad category reports;
- trusted direct sources beat inferred signals;
- conflicting evidence should surface a conflict state rather than be averaged into certainty;
- market-level availability may require more than one vendor or field observation depending on market size.

## 21.6 Availability expiration

Every availability claim must have an expiry or reevaluation time.

No observation remains “available” forever.

---

# 22. Price model

## 22.1 Price types

Internal price kind:

```text
observed_vendor_price
vendor_declared_price
market_observation
market_range
nearby_typical_range
public_monthly_reference
inferred_estimate
```

User-facing language must distinguish these types.

## 22.2 Exact price

Display an exact price when:

- the place/vendor is specific;
- item, variant, and unit are specific;
- observation time is known;
- and evidence meets the display threshold.

## 22.3 Price range

Use a range when:

- multiple valid observations differ;
- a market contains multiple sellers;
- negotiation is normal;
- or quality variation remains within the selected variant.

A range should state sample size or basis when space permits.

## 22.4 Reference price

Public or modeled data may provide useful context but must be labelled, for example:

> `Monthly state reference — not a live market price`

Reference data must not create an availability claim.

## 22.5 Outlier treatment

Potential outliers should be:

- retained as immutable observations;
- excluded from the current range only by a documented rule;
- flagged for review where material;
- and restored automatically if corroborated later.

## 22.6 Price comparison language

Allowed when supported:

- `Lower than today’s nearby range`
- `Within the current nearby range`
- `Higher than other recent reports`

Avoid moralizing terms like `rip-off`.

## 22.7 Price history

Version One may show a simple short history only when enough comparable observations exist.

Do not draw a smooth chart across inconsistent items, units, or quality grades.

---

# 23. Trust, freshness, and confidence

## 23.1 Trust is a product feature

The core moat is not the map. It is the ability to explain why a local claim deserves attention.

## 23.2 Source types

Recommended source types:

1. Verified vendor direct update.
2. Trained field contributor.
3. Verified buyer receipt or photo.
4. Community report with contributor history.
5. Partner dataset.
6. Public institutional benchmark.
7. Modelled or inferred estimate.

## 23.3 Internal confidence model

An initial internal score may combine:

- source reliability;
- freshness;
- corroboration;
- evidence strength;
- item/unit match;
- geographic precision;
- anomaly risk;
- and conflict status.

Example provisional weighting:

```text
Source reliability       30%
Freshness                25%
Corroboration            20%
Evidence                 10%
Item/unit precision      10%
Anomaly/conflict          5%
```

This formula is a starting hypothesis. It must be calibrated against real outcomes.

## 23.4 User-facing trust levels

Prefer labels over percentages:

- **Strong confirmation**
- **Confirmed**
- **Limited confirmation**
- **Conflicting reports**
- **Stale**
- **Reference only**

## 23.5 Explainability

A user should be able to answer:

- Who or what reported this?
- How recent is it?
- How many supporting observations exist?
- Is this exact or estimated?
- What would make it change?

## 23.6 Contributor reputation

Contributor reputation may be based on:

- accepted reports;
- agreement with later verified outcomes;
- evidence quality;
- category/place expertise;
- conflict rate;
- suspicious submission patterns;
- and audit results.

Reputation must not be visible as a social popularity score in Version One.

## 23.7 Abuse controls

Controls include:

- rate limits;
- duplicate detection;
- device/session risk signals;
- geospatial plausibility;
- price anomaly checks;
- evidence hashing;
- contributor cooldowns;
- vendor conflict review;
- and human moderation.

## 23.8 Corrections

Every result must provide a way to report:

- item unavailable;
- price changed;
- wrong unit;
- wrong place;
- closed vendor;
- misleading evidence;
- duplicate place;
- or safety concern.

## 23.9 Auditability

Observations are append-only. Corrections create new records or moderation decisions. The current derived state may change, but history must remain available to authorized operations staff.

---

# 24. Data acquisition and market operations

## 24.1 Data is an operations problem before it is a machine-learning problem

The first useful dataset will likely require deliberate human collection.

## 24.2 Recommended pilot supply mix

### Verified vendors

Benefits:

- direct availability;
- clear place and unit;
- potential contact action.

Risks:

- promotional bias;
- stale self-reports;
- pressure to rank paying vendors.

Controls:

- expiry;
- buyer confirmations;
- audits;
- and clear source labels.

### Trained market contributors

Benefits:

- structured coverage;
- ability to inspect multiple sellers;
- standardized process.

Risks:

- operational cost;
- inconsistent diligence;
- collusion.

Controls:

- training;
- rotating audits;
- evidence samples;
- and performance review.

### Community reports

Benefits:

- scale;
- local reach;
- correction speed.

Risks:

- spam;
- misunderstanding;
- manipulation;
- uneven coverage.

Controls:

- low default weight;
- corroboration;
- simple item definitions;
- rate limits;
- and reputation.

### Public data

Benefits:

- historical context;
- broad benchmarks;
- useful baseline.

Risks:

- lower cadence;
- different methodology;
- not availability data.

Controls:

- separate labels;
- no mixing into live claims without explanation.

## 24.3 Field collection protocol

Each observation should capture:

- contributor/source;
- item;
- variant;
- unit;
- price;
- availability;
- place/vendor;
- observation time;
- optional quantity note;
- optional evidence;
- and collection method.

## 24.4 Collection windows

For a pilot, define expected update windows by item category and place.

Example:

- perishables: morning and afternoon collection where demand supports it;
- staples: daily or every market day;
- packaged goods: every 2–3 days unless changed.

The actual cadence must follow field evidence and budget.

## 24.5 Standardization kit

Contributors should receive:

- item photo guide;
- variant definitions;
- unit guide;
- local-unit guide;
- prohibited assumptions;
- evidence examples;
- conflict procedure;
- and safety guidance.

## 24.6 Incentives

Do not pay purely per submission. That rewards volume over truth.

Potential structure:

- base assignment compensation;
- quality bonus for verified accuracy;
- coverage bonus for difficult gaps;
- penalties or removal for fabrication;
- no public gamified leaderboard.

## 24.7 Data service levels

The pilot should define:

- target coverage per item;
- target fresh-observation percentage;
- maximum moderation delay;
- correction response time;
- and tolerated conflict rate.

## 24.8 Safety

Contributors must not be instructed to:

- secretly photograph people;
- provoke vendor disputes;
- reveal personal vendor information without consent;
- trespass;
- or remain in unsafe areas to complete coverage.

---

# 25. Modular product architecture

## 25.1 Principle

> **Every new capability may introduce new domain data, but it should not introduce a new interaction paradigm without overwhelming evidence.**

## 25.2 Shared core

The shared WetinDey core contains:

- context and location;
- map and list presentation;
- search;
- sheet behavior;
- trust and freshness UI;
- reporting workflow;
- media evidence;
- analytics;
- settings;
- offline shell;
- and module registration.

## 25.3 Food module

The Food module owns:

- food taxonomy;
- food variants;
- food units and local measures;
- food availability rules;
- food freshness windows;
- food report schema;
- food ranking policy extensions;
- and food copy.

## 25.4 Module contract

Provisional TypeScript contract:

```ts
export interface WetinDeyModule<TItem, TObservation, TDetail> {
  id: string;
  displayName: string;
  version: string;

  search: {
    resolve(query: string, locale: string): Promise<TItem[]>;
    getClarifications(item: TItem): Clarification[];
  };

  discovery: {
    getCandidates(input: DiscoveryInput<TItem>): Promise<Candidate<TDetail>[]>;
    rank(candidates: Candidate<TDetail>[], context: RankingContext): Candidate<TDetail>[];
  };

  reporting: {
    schema: unknown;
    normalize(input: unknown): TObservation;
    validate(input: TObservation): ValidationResult;
  };

  trust: {
    freshnessPolicy: FreshnessPolicy;
    assess(observations: TObservation[]): TrustAssessment;
  };

  presentation: {
    formatSummary(detail: TDetail, locale: string): DecisionSummary;
  };
}
```

## 25.5 Avoid over-abstraction

Do not build a generic plugin engine before Food works.

Recommended approach:

- organize Food as a vertical module;
- define interfaces where real boundaries already exist;
- extract shared behavior after a second use case proves the abstraction;
- keep domain terms explicit.

## 25.6 Provider adapters

External dependencies should sit behind adapters:

- map provider;
- geocoding;
- media storage;
- analytics;
- notification provider;
- authentication;
- and public datasets.

This protects the product from vendor lock-in without creating unnecessary internal frameworks.

---

# 26. Technical architecture

## 26.1 Approved foundation

- Next.js App Router.
- React.
- TypeScript with strict mode.
- Progressive Web App.
- Vercel hosting and deployment.
- Neon Postgres.
- PostGIS for geospatial queries.
- Vercel Blob for profile avatars; evidence and catalog media storage remain open decisions.
- Tailwind CSS for token-driven styling.
- Radix-based primitives through shadcn/ui where they meet the specification.
- Zod or equivalent runtime schema validation.
- Drizzle ORM or another typed Postgres layer selected through an ADR.

## 26.2 Architecture style

Use a modular monolith for Version One.

Reasons:

- one team;
- one product;
- one database;
- fast refactoring;
- strong transactions;
- and lower operational complexity.

Do not split into microservices prematurely.

## 26.3 Rendering strategy

- Server Components for stable server-rendered content and initial shells.
- Client Components only where browser state, map interaction, sheet gestures, or immediate interactivity require them.
- Route Handlers for public APIs, integrations, upload tokens, cron entry points, and future external consumers.
- Server Actions for same-product form mutations where appropriate.

## 26.4 Read path

```text
Browser
  ↓
Next.js route/server component
  ↓
Application service
  ↓
Repository/query layer
  ↓
Neon Postgres + PostGIS
  ↓
Derived decision response
```

## 26.5 Write path

```text
Report form
  ↓
Runtime schema validation
  ↓
Authorization/rate limit
  ↓
Evidence upload authorization
  ↓
Immutable observation insert
  ↓
Trust assessment / moderation state
  ↓
Derived offer refresh
  ↓
Cache revalidation
  ↓
User confirmation
```

## 26.6 Background work

Use background or scheduled processing for:

- expiring availability;
- recalculating derived offers;
- anomaly detection;
- reminder generation;
- public-dataset ingestion;
- evidence processing;
- and stale coverage alerts.

Vercel Cron may handle scheduled tasks. Durable queues may be used when retryable event processing becomes necessary, but beta infrastructure should not become a hard dependency without an ADR and fallback.

## 26.7 Map provider

The map provider remains an open decision.

Selection criteria:

- Nigeria map quality;
- geocoding quality;
- cost at expected traffic;
- vector performance;
- offline and cache terms;
- accessibility;
- clustering support;
- and provider lock-in.

The application must use a provider adapter so business logic does not import provider-specific objects.

## 26.8 Search

Start with Postgres-backed search:

- canonical names;
- aliases;
- trigram similarity;
- normalized tokens;
- and launch-area popularity.

A separate search platform is unnecessary until measured limits justify it.

## 26.9 Authentication

Browsing MUST remain anonymous.

Authentication is required only when a feature truly needs identity, such as:

- trusted contributor privileges;
- saved alerts across devices;
- vendor management;
- or operations access.

The auth provider is an open decision. User identity data must remain minimal and portable.

## 26.10 Media boundaries

Profile avatars currently use Vercel Blob. That identity-media implementation does not
select storage, permissions, or lifecycle rules for other media domains.

Observation evidence media remains an open decision. It requires private/public
classification, EXIF removal, content hashing, size limits, moderation, retention,
deletion, and offline-upload rules.

Catalog reference imagery remains a separate open decision. It requires curator
authorization, attribution, licensing, replacement, and duplicate-merging rules.

The two domains may share low-level storage plumbing only after separate approval. An
evidence photo must never become an item reference image automatically.

Uploads must:

- use signed/authorized flows;
- enforce MIME and size limits;
- strip or ignore EXIF location where not required;
- scan or validate media where feasible;
- and store a content hash.

---

# 27. Database architecture

## 27.1 Database principles

- Postgres is the source of truth.
- Observations are immutable.
- Derived current offers may be rebuilt.
- Geographic data uses PostGIS.
- Times are stored in UTC.
- IDs use UUIDv7 or another sortable unique identifier selected consistently. **Deviation, recorded 16 July 2026 — the code does not do this and will not.** Every primary key is `uuid().defaultRandom()` (`src/db/schema/index.ts`, all nine tables), which is Postgres `gen_random_uuid()` — UUIDv4, random and not sortable. This principle was never honoured. It is recorded as a deviation rather than repaired: changing the key type would rewrite every foreign key in the schema and every row in the database to buy an ordering property nothing queries. The principle is the bug, not the schema.
- Money is stored as integer minor units where applicable; for naira-only whole-price data, store integer naira plus explicit currency and precision policy.
- Every moderation action is audited.

## 27.2 Core tables

**Amended 16 July 2026 to the nine tables that exist.** This section previously specified
fifteen. Six of them were never built, and one of those — `vendors` — is obsoleted and
struck. The schema of record is `src/db/schema/index.ts`; where it and this section
disagree, the schema is right. Read it before you extend anything here.

The nine: `areas`, `places`, `items`, `item_aliases`, `item_variants`, `units`, `sources`,
`observations`, `offers_current`. Field lists below are the real columns.

### `areas`

- id
- slug
- name
- type
- parent_area_id
- center geography point
- coverage_status
- created_at
- updated_at

`boundary geometry` was specified and never built. Coverage is a point plus a radius, not
a polygon.

### `places`

- id
- slug
- name
- place_type
- area_id
- location geography point
- address
- opening_information
- verification_status
- contact_visibility
- contact_channel_kind, optional — 'phone', 'whatsapp', 'sms'
- contact_channel_value, optional — E.164 for phone/whatsapp
- created_at
- updated_at

The contact-channel pair exists in the schema and is read by nothing and written by
nothing. See the *Vendor/contact model* line in 40.2 — the columns are no longer the
blocker; consent capture is.

### `vendors` — **struck 16 July 2026, see [ADR-001](docs/adr/001-fulfilment-is-out-of-scope.md)**

This table does not exist and must not be built. It was the seam for a vendor-level
fulfilment model that ADR-001 removed from the product entirely. The catalogue is market
stalls; a stall is a `place`. Contact is `places.contact_visibility` plus the channel
pair above, not a vendor identity. Any `vendor_id` you find elsewhere in this document is
a ghost of this table — the schema has none.

### `items`

- id
- slug
- canonical_name
- description
- image_url, optional
- image_attribution, optional
- image_license, optional
- image_source_url, optional
- active
- created_at
- updated_at

`category_id` and `default_freshness_policy_id` were specified and never built. There is
no category table and no per-item freshness policy — freshness is flat and global
(24h/72h, [ADR-006](docs/adr/006-freshness-windows.md)). The four image columns were not
specified and shipped: most photos are CC BY / CC BY-SA, so the credit is stored beside
the URL it belongs to.

### `item_aliases`

- id
- item_id
- alias
- locale
- normalized_alias
- weight

`region_id` was specified and never built.

### `item_variants`

- id
- item_id
- slug
- display_name
- attributes jsonb
- active

### `units`

- id
- code
- display_name
- dimension
- canonical_quantity
- notes

`canonical_unit_id`, `conversion_precision` and `region_id` were specified and never
built. Nothing converts between units. See the unit-policy line in 40.2 — still open.

### `sources`

- id
- source_type — 'Contributor', 'Public data', 'Vendor'
- user_id, optional — the account behind this source, when there is one
- status
- reliability_score_internal
- created_at
- updated_at

`partner_id` and `vendor_id` were specified and never built.

`user_id` ships ahead of its writer, and this is the condition
[ADR-003](docs/adr/003-identity-for-contribution-trust.md) is waiting on: the column
exists, nothing writes it, and `src/app/actions.ts` has no session awareness. Until a
write path resolves a session to a per-user row, every row carries NULL and this table
answers exactly as it did when it held three category rows — which is what makes
`distinct_source_count` a count of *categories* rendered as "N different people"
(`src/lib/trust.ts:405`). Do not read ADR-003 as shipped attribution. Sign-in shipped;
attribution did not.

### `observations`

- id
- item_variant_id
- unit_id
- place_id
- availability_state
- price_amount, optional — stored in minor units
- currency
- observed_at
- submitted_at
- source_id
- collection_method
- moderation_status
- notes
- did_buy, optional — true / false / NULL, where NULL means never asked
- raw_payload jsonb

`vendor_id` is struck with the `vendors` table. `supersedes_observation_id` was specified
and never built — observations are immutable and a correction is simply a newer row.

### `offers_current`

Derived table, materialized on write:

- id
- item_variant_id
- unit_id
- place_id
- availability_state
- price_kind
- price_min
- price_max
- currency
- freshness_state
- trust_level
- last_observed_at
- expires_at
- supporting_observation_count
- updated_at

`vendor_id` is struck with the `vendors` table. `(item_variant_id, unit_id, place_id)` is
the natural key and is enforced UNIQUE — the table's name is a promise of one current
offer per triple, and the code reads it that way with `.limit(1)` throughout.

### Tables specified here and deliberately not built

**Amended 16 July 2026.** These five carried full field lists for months while no
migration ever created them. An agent reading a field list as fact writes code against a
table that does not exist. They are kept only as a record of the intent, and each one
names why it is not built:

| Table | Why it does not exist |
|---|---|
| `evidence` | Media is deferred entirely. `@vercel/blob` is not a dependency and nothing imports it — see the Blob line in 40.2, demoted from Accepted the same day. When photos land, this table lands with them, and it drags EXIF stripping, content hashing and size caps with it. |
| `trust_assessments` | It would cache a pure function. `assessTrust` (`src/lib/trust.ts`) derives trust from observations on read; persisting the result buys nothing and creates an invalidation problem that does not currently exist. |
| `moderation_decisions` | Build it when a moderator exists. `moderation_status` is a column on `observations` and no human has ever set it. |
| `audit_log` | Same gate. There is no operations console and no actor to attribute an action to. |
| `search_events` | Analytics is `@vercel/analytics`. Instrument the few events that answer a question before building a table to hold nineteen. |

## 27.3 Geographic indexes

Use GiST indexes for geography/geometry fields.

Example query intent:

- find places within radius;
- order by distance;
- intersect area boundary;
- cluster coverage by area;
- detect implausible contributor distance where permission and policy allow.

## 27.4 Observation indexes

**Amended 16 July 2026 to what `src/db/schema/index.ts` declares.** The list below was a
wish list; none of these six existed. What ships:

- `observations`: `(item_variant_id, unit_id, place_id)` — the recompute every write
  performs, on the only table that grows without bound;
- `offers_current`: `(item_variant_id, unit_id, place_id)` UNIQUE (the natural key),
  `place_id`, `unit_id`, and `(item_variant_id, last_observed_at desc)`;
- `sources`: `user_id`, shipped with the column ahead of its writer;
- `item_aliases`: `item_id`. Deliberately no index for the leading-wildcard `ilike` —
  that needs GIN + `pg_trgm`, and `pg_trgm` is not installed on this database;
- `item_variants`: `item_id`.

`content_hash for evidence duplicate detection` is struck — there is no `evidence` table.

## 27.5 Data retention

- Public product data may be retained for historical and audit purposes.
- Precise personal location should not be retained unless necessary and consented.
- Evidence containing personal data requires a retention policy.
- Deleted user accounts should be anonymized where observations must remain for integrity, subject to legal review.

## 27.6 Database access

The browser must never receive a direct privileged database credential.

All public writes go through validated server boundaries.

Operations access requires role-based authorization and audit logging.

---

# 28. Future external API — NOT BUILT. Server Actions are the actual contract

> **Retitled 16 July 2026. Read this before the chapter.**
>
> **None of the ten `/api/v1` endpoints below exists.** Verified against the tree:
> `src/app/api/` contains exactly one route handler —
> `src/app/api/auth/[...path]/route.ts`, the Neon Auth proxy — and it is not one of
> the ten. There is no `/api/v1` anything.
>
> **Every piece of product data flows through Server Actions in `src/app/actions.ts`,
> and that is correct.** Seventeen exported actions are the read and write contract:
> `searchFoodItems`, `getPopularItems`, `getFoodItemCandidates`, `getPlaces`,
> `getPlaceOffers`, `submitObservation`, `getInitialSubmissionData`, `getVisitContext`,
> `submitVisitConfirmation`, `getItemNarrowingOptions`, `getOffersNarrowed`,
> `getAreaTree`, `getPlacesNear`, `getCoverageForPoint`, `getPlaceContactPolicy`,
> `getOfferTrustBatch`, `getOfferTrust`. There is one consumer — this app — and a
> function call typed end-to-end is a better contract for it than a hand-versioned
> HTTP surface with no second client to serve.
>
> **This chapter is kept as a design for an API that has no consumer yet.** It becomes
> real the day a partner or a second client exists, and not before. Until then: do not
> build these, do not test against them, and do not cite this chapter as a description
> of the system. `src/app/actions.ts` is the contract.

## 28.1 API versioning — future

Public or partner APIs use `/api/v1`.

Internal Server Actions may evolve with the application, but shared schemas should remain versioned.

## 28.2 Suggested endpoints — none of these exist

```text
GET  /api/v1/items/search
GET  /api/v1/items/:itemId/results
GET  /api/v1/places/:placeId
GET  /api/v1/offers/:offerId
POST /api/v1/observations
POST /api/v1/observations/:id/confirm
POST /api/v1/observations/:id/dispute
POST /api/v1/uploads/authorize
GET  /api/v1/areas/search
GET  /api/v1/health
```

## 28.3 Discovery request

```ts
export interface DiscoveryRequest {
  itemId: string;
  variantId?: string;
  unitId?: string;
  context: {
    areaId?: string;
    latitude?: number;
    longitude?: number;
    radiusMeters?: number;
  };
  sort?: "recommended" | "distance" | "price" | "freshness";
}
```

## 28.4 Decision result

```ts
export interface DecisionResult {
  id: string;
  item: {
    id: string;
    name: string;
    variant?: string;
    unit: string;
  };
  place: {
    id: string;
    name: string;
    latitude: number;
    longitude: number;
    distanceMeters?: number;
  };
  availability: {
    state:
      | "confirmed_available"
      | "likely_available"
      | "low_stock_reported"
      | "confirmed_unavailable"
      | "unknown"
      | "stale"
      | "conflicting";
    label: string;
    observedAt?: string;
    expiresAt?: string;
  };
  price: {
    kind:
      | "observed_vendor_price"
      | "market_range"
      | "nearby_typical_range"
      | "public_monthly_reference"
      | "unavailable";
    currency: "NGN";
    min?: number;
    max?: number;
    unitLabel: string;
  };
  trust: {
    level: "strong" | "confirmed" | "limited" | "conflicting" | "stale" | "reference";
    summary: string;
    supportingObservations: number;
  };
  actions: {
    directions: boolean;
    call: boolean;
    share: boolean;
    reportChange: boolean;
  };
}
```

## 28.5 Error format

```ts
export interface ApiError {
  code: string;
  message: string;
  recovery?: {
    label: string;
    action: string;
  };
  requestId: string;
}
```

Do not expose stack traces, SQL, tokens, or internal source reputation.

## 28.6 Idempotency

Observation submission should support an idempotency key to prevent duplicate writes during retries or offline synchronization.

## 28.7 Schema validation

All external input is validated at runtime. TypeScript types alone are not validation.

---

# 29. PWA, offline, and performance requirements

## 29.1 PWA requirements

WetinDey must include:

- a valid web app manifest;
- installable icons and maskable icons;
- standalone display behavior where supported;
- theme and background colors;
- service worker strategy;
- offline shell;
- secure HTTPS delivery;
- and install-mode testing.

## 29.2 Service worker strategy

Cache:

- app shell;
- design-system assets;
- last successful item results;
- recent place details;
- item taxonomy required for search;
- and static legal/help content.

Do not cache:

- private evidence without a secure policy;
- sensitive operations responses;
- or “current” availability indefinitely.

## 29.3 Offline truthfulness

Offline data MUST display the last sync time prominently.

A cached result must not retain a green “available now” presentation without a stale treatment.

## 29.4 Contribution queue

A report may be stored locally using IndexedDB when offline.

Requirements:

- clear queued state;
- user control to delete before sync;
- idempotency key;
- attachment-size limits;
- and conflict handling after reconnect.

## 29.5 Performance budgets

Target p75 field performance on supported mobile browsers:

- Largest Contentful Paint: ≤ 2.5 s.
- Interaction to Next Paint: ≤ 200 ms.
- Cumulative Layout Shift: ≤ 0.1.

Additional internal targets:

- useful app shell visible before map completion;
- initial route JavaScript minimized, with map code lazy-loaded where possible;
- no blocking custom web font;
- search response perceived within 300 ms for local aliases and 1 s for remote results;
- sheet interactions at 60 fps on representative mid-range Android hardware;
- and evidence images resized before or during upload.

## 29.6 Reduced-data mode

A reduced-data preference SHOULD:

- delay map load until requested or use a simpler basemap;
- default to list view;
- avoid loading evidence thumbnails automatically;
- reduce animation;
- and preserve core search and decision functionality.

## 29.7 Map failure fallback

If the map fails:

- the list remains usable;
- area selection remains usable;
- directions may hand off to an external map link;
- and the product explains the temporary limitation without blocking results.

---

# 30. Privacy and security

## 30.1 Privacy position

WetinDey should require less personal data than users expect.

The product does not need a name, phone number, continuous location history, contacts, or identity document to show public food information.

## 30.2 Location policy

- Request location only when needed.
- Use current location transiently for nearby search.
- Store a broad default area rather than precise coordinates when possible.
- Round or aggregate location in analytics.
- Never sell precise location.
- Never expose contributor home or movement patterns.
- Do not request background location in Version One.

## 30.3 Nigerian data protection

Before public launch, the privacy program must be reviewed for compliance with the Nigeria Data Protection Act 2023 and current Nigeria Data Protection Commission guidance, including privacy notices, lawful processing basis, data-subject rights, processor contracts, security, retention, and privacy-by-design obligations.

This Bible is not legal advice.

## 30.4 Evidence privacy

Before upload, inform the contributor:

- what the image is used for;
- whether it may become public;
- what personal details should be avoided;
- and how long it may be retained.

Default evidence visibility should be private to moderation unless explicitly approved for public display.

## 30.5 Security controls

Required baseline:

- HTTPS;
- secure headers and Content Security Policy;
- CSRF protection for mutations;
- strict origin checks;
- input validation;
- output encoding;
- rate limiting;
- upload authorization;
- MIME and size enforcement;
- database least privilege;
- encrypted secrets;
- role-based ops access;
- audit logging;
- dependency scanning;
- and incident response contacts.

## 30.6 Threat model

Key threats:

- fake price campaigns;
- vendor sabotage;
- spam reports;
- automated scraping;
- account takeover;
- evidence containing malware or personal data;
- location inference;
- ops abuse;
- SQL injection;
- XSS through vendor or place names;
- insecure deep links;
- and denial-of-service attacks.

## 30.7 Rate limits

Apply separate policies to:

- anonymous search;
- report submission;
- upload authorization;
- login;
- confirmation/dispute actions;
- and operations endpoints.

A rate limit must return a clear recovery message and request ID.

## 30.8 Secrets

Secrets must never be committed to git, exposed to browser bundles, pasted into tickets, or logged.

Use Vercel environment management and scoped credentials.

## 30.9 Incident response

Document:

- severity levels;
- on-call owner;
- containment steps;
- user communication criteria;
- evidence preservation;
- regulatory notification assessment;
- and post-incident review.

---

# 31. Analytics and success metrics

## 31.1 North-star metric

**Verified Decision Sessions**

A session counts when a user:

1. selects a specific item and unit;
2. receives at least one sufficiently trusted local result;
3. and performs a meaningful decision action such as directions, call, share, save, or confirmation.

This is better than raw page views.

## 31.2 Product metrics

### Activation

- Percentage of new users who complete an item search.
- Percentage who receive a result.
- Time to first useful answer.

### Decision value

- Directions/call/share rate after viewing a result.
- Self-reported decision usefulness.
- Confirmed avoided trip or changed destination, sampled rather than constantly asked.

### Retention

- 7-day and 30-day return rate by user type.
- Repeat item searches.
- Repeat area use.

### Data quality

- Fresh coverage percentage.
- Median observation age.
- Availability confirmation rate.
- Correction rate.
- Conflict rate.
- Observation acceptance rate.
- Verified outcome agreement.

### Supply health

- Active verified vendors.
- Active trained contributors.
- Place coverage.
- Item coverage.
- Cost per fresh, usable observation.

### Performance

- Core Web Vitals.
- Map load failure rate.
- Search latency.
- report-submission failure rate.
- offline recovery success.

## 31.3 Event taxonomy

Examples:

```text
app_opened
area_selected
location_permission_prompted
location_permission_result
search_started
search_result_selected
item_clarified
results_loaded
result_opened
directions_started
vendor_call_started
result_shared
report_started
report_submitted
report_queued_offline
report_disputed
map_list_toggled
search_area_requested
install_prompt_shown
pwa_installed
error_shown
```

## 31.4 Event properties

Use privacy-minimized properties:

- module;
- item category;
- broad area;
- result count;
- freshness band;
- trust level;
- connection class;
- display mode;
- and device class.

Do not send raw precise location, phone number, evidence content, or free-text notes to analytics.

## 31.5 Experimentation

Do not A/B test trust wording, privacy consent, or data uncertainty in a way that makes one group less informed.

Experiments may test:

- map versus list default;
- result-card hierarchy;
- search suggestions;
- clarification timing;
- and install-prompt timing.

---

# 32. Testing and quality assurance

## 32.0 What V1 actually ships — **amended 16 July 2026**

**There are no tests. Not one.** Stated plainly because every other word in this chapter
reads like a description of a test suite, and there is no test suite.

Verified against the repo:

- **No test runner.** `package.json` has no `test` script and no Vitest, Jest, Playwright
  or Cypress in `dependencies` or `devDependencies`.
- **No test config.** No `vitest.config.*`, no `jest.config.*`, no `playwright.config.*`.
- **No test files.** Zero `*.test.ts`, `*.test.tsx`, `*.spec.ts` anywhere outside
  `node_modules`.
- **`src/test/` contains a single `.gitkeep`.** The folder was created and never used.

What V1 actually ships as quality tooling, all of it static or manual:

| Tool | Script | What it can and cannot catch |
|---|---|---|
| TypeScript | `npm run typecheck` (`tsc --noEmit`) | Types. Not behaviour. |
| ESLint | `npm run lint` | Lint rules. Not behaviour. |
| Knip | `npm run knip` | Unused files and exports — the one check aimed at this repo's actual disease, dead code nothing calls. |
| Prettier | `npm run format` | Formatting. |
| Token audit | `npm run audit:tokens` | Design-token drift. |
| Manual | — | Everything else, including every scenario in 32.2. |

The gap this leaves is not academic. `src/lib/trust.ts` is pure, total, and the single
most consequential function in the product — it decides what every badge in the app
claims — and nothing exercises it. The EWKB decode bug in `src/db/schema/index.ts` (every
coordinate silently becoming (0,0), markers stacked in the Gulf of Guinea) survived the
life of the project and would have died to one unit test.

**Read 32.1–32.6 as a target, not a description.** They specify nine test layers, twelve
end-to-end scenarios and a device matrix, none of which exist. Do not cite this chapter as
evidence that anything is verified. If you add the first test, amend this section.

## 32.1 Test layers — target, none built

- Unit tests for normalization, ranking factors, freshness, and price logic.
- Integration tests for database and service boundaries.
- Contract tests for API schemas. (Note: there is no API — see Section 28. The contract to
  test is `src/app/actions.ts`.)
- End-to-end tests for hero flows.
- Visual regression for core states.
- Accessibility tests.
- Performance tests.
- Security tests.
- Data-quality tests.
- Manual usability tests. **The only layer currently practised.**

## 32.2 Critical end-to-end scenarios — target; today these are walked by hand or not at all

1. New user, manual area, successful search.
2. Returning user, location available, successful search.
3. Ambiguous item clarification.
4. No recent availability.
5. Conflicting reports.
6. Map provider failure with list fallback.
7. Offline cached result.
8. Offline report queue and later sync.
9. Invalid evidence upload.
10. Report correction.
11. Large text and keyboard-only use.
12. Back navigation preserving map and sheet state.

## 32.3 Device matrix

Minimum manual coverage:

- recent iPhone Safari;
- older supported iPhone Safari;
- mid-range Android Chrome;
- low-memory Android Chrome;
- desktop Chrome;
- desktop Safari;
- Firefox;
- installed PWA mode on iOS and Android where supported.

## 32.4 Accessibility checks

- semantic headings;
- landmarks;
- search labels;
- map alternative;
- result-card button names;
- focus order;
- focus restoration;
- live-region announcements for result changes;
- reduced motion;
- contrast;
- 200% zoom;
- screen-reader form errors;
- keyboard sheet controls.

## 32.5 Data tests — target, none automated

Automated checks should detect:

- impossible negative prices;
- unit mismatch;
- duplicate observation IDs;
- observation time in the future beyond tolerance;
- coordinates outside coverage;
- expired “current” offers;
- unsupported currency;
- and invalid source states.

## 32.6 Release blockers

Release is blocked by:

- misleading availability state;
- exposed secret;
- inaccessible primary flow;
- inability to recover from location denial;
- evidence upload privacy failure;
- crash in supported browsers;
- broken back behavior;
- or missing privacy and terms documents.

---

# 33. Delivery plan

## 33.1 Phase 0 — Evidence and data dry run

Outputs:

- buyer interviews;
- supply-side interviews;
- competitor teardown;
- launch-area recommendation;
- initial item and unit definitions;
- 14-day manual data sample;
- trust-label comprehension test;
- and first product decision record.

## 33.2 Phase 1 — Product foundation

Outputs:

- repository;
- CI/CD;
- design tokens;
- app shell;
- PWA manifest;
- map-provider adapter;
- ContextSheet;
- mock item search;
- mock result cards;
- accessibility baseline;
- and preview deployment.

## 33.3 Phase 2 — Core Food decision flow

Outputs:

- item taxonomy;
- search and aliases;
- area selection;
- geospatial result query;
- map/list results;
- result detail;
- trust and freshness presentation;
- and directions handoff.

## 33.4 Phase 3 — Reporting and trust operations

Outputs:

- observation submission;
- evidence upload;
- moderation states;
- derived current offers;
- confidence assessment;
- ops review queue;
- correction flow;
- and audit log.

## 33.5 Phase 4 — Resilience and quality

Outputs:

- offline shell;
- cached result state;
- reduced-data mode;
- performance optimization;
- security review;
- accessibility review;
- device testing;
- privacy review;
- and launch checklist.

## 33.6 Phase 5 — Controlled pilot

Outputs:

- bounded public or invitation beta;
- trained data contributors;
- support channel;
- daily data-quality review;
- metrics dashboard;
- user interviews;
- and documented go/no-go decision.

---

# 34. Departments and responsibilities

A large company would separate these into departments. An early team may combine roles, but the responsibilities still exist.

## 34.1 Product leadership

Owns:

- problem definition;
- scope;
- priorities;
- success metrics;
- roadmap;
- and final product decisions.

## 34.2 Product research

Owns:

- user interviews;
- field observation;
- competitor research;
- usability testing;
- and evidence quality.

## 34.3 UX and interaction design

Owns:

- product flow;
- experience flow;
- user flows;
- progressive disclosure;
- sheet behavior;
- map/list relationships;
- permissions;
- and error recovery.

## 34.4 UI and design systems

Owns:

- visual hierarchy;
- tokens;
- components;
- responsive behavior;
- dark mode;
- motion;
- and design QA.

## 34.5 Content design and localization

Owns:

- interface copy;
- Pidgin strategy;
- item aliases;
- error language;
- trust explanation;
- and multilingual readiness.

## 34.6 Frontend/PWA engineering

Owns:

- Next.js interface;
- map and sheet;
- client state;
- accessibility implementation;
- PWA behavior;
- offline behavior;
- and browser performance.

## 34.7 Backend and platform engineering

Owns:

- APIs;
- application services;
- authentication;
- uploads;
- scheduled work;
- security boundaries;
- and integrations.

## 34.8 Data engineering

Owns:

- schema;
- ingestion;
- derived offers;
- data quality;
- geospatial queries;
- and historical data.

## 34.9 Market data operations

Owns:

- contributor recruitment;
- collection schedules;
- item/unit training;
- vendor relationships;
- field audits;
- and coverage service levels.

## 34.10 Trust and safety

Owns:

- moderation;
- abuse prevention;
- contributor reputation;
- disputes;
- evidence handling;
- and escalation.

## 34.11 Quality assurance

Owns:

- test plans;
- regression;
- device matrix;
- release sign-off;
- and defect triage.

## 34.12 Accessibility

Accessibility may be a shared competency, but one named owner must coordinate audits and prevent it from becoming everybody’s unowned responsibility.

## 34.13 Privacy, legal, and security

Owns:

- name clearance;
- terms;
- privacy notice;
- NDPA/NDPC review;
- processor agreements;
- incident response;
- and security review.

## 34.14 Brand and growth

Owns:

- launch narrative;
- acquisition;
- community communication;
- app-install education;
- and trust-preserving campaigns.

## 34.15 Partnerships and commercial

Owns:

- vendor and market partnerships;
- institutional data partnerships;
- enterprise/API opportunities;
- and monetization after product trust exists.

## 34.16 Early-team recommendation

Minimum accountable roles:

1. Founder/Product owner.
2. Product designer with research responsibility.
3. Full-stack engineer with strong frontend/PWA capability.
4. Data/operations lead for the launch market.
5. Part-time QA/accessibility and privacy/security review.

The data/operations lead is not optional. The product cannot be solved by interface engineering alone.

---

# 35. Administration and operations console

## 35.1 Purpose

The consumer experience can remain simple only if operations tooling handles complexity behind the scenes.

## 35.2 Required capabilities

### Moderation queue

- filter by risk;
- inspect observation and evidence;
- compare conflicting reports;
- accept, limit, reject, or request clarification;
- record reason.

### Item and unit management

- create/edit item;
- manage aliases;
- manage variants;
- define valid units;
- mark unsupported conversions;
- set freshness policy.

### Place management

- merge duplicates;
- correct coordinates;
- set place type;
- manage verified vendor relationships;
- mark closure or temporary inactivity.

### Source management

- source type;
- status;
- reliability history;
- audit results;
- suspicious patterns;
- and permission level.

### Coverage dashboard

- fresh observations by area/item;
- stale gaps;
- place coverage;
- contributor workload;
- and user searches with no answer.

### Anomaly queue

- unusual price change;
- impossible unit;
- repeated identical evidence;
- coordinated reports;
- and location mismatch.

### Audit log

Every privileged change must include:

- actor;
- time;
- entity;
- before/after;
- and reason.

## 35.3 Operations UX

The ops console may be denser than the consumer product but must remain:

- keyboard efficient;
- auditable;
- accessible;
- and resistant to accidental destructive action.

---

# 36. Launch plan

## 36.1 Launch condition

Do not launch an empty map and ask the public to populate it.

The pilot must begin with enough baseline data that a user can complete the hero task for the supported items and area.

## 36.2 Controlled pilot

Recommended launch shape:

- one bounded area;
- a clearly published item list;
- a defined data-update window;
- a small group of trained contributors/vendors;
- and invitation or waitlist access if coverage cannot support open demand.

## 36.3 Messaging

Say exactly what the product can do.

Good:

> `See recently confirmed food availability and prices across participating places in [launch area].`

Bad:

> `Live prices for every market in Nigeria.`

## 36.4 Launch checklist

- [ ] Legal name review complete.
- [ ] Privacy notice approved.
- [ ] Terms approved.
- [ ] Supported area and items published.
- [ ] Baseline data fresh.
- [ ] Vendor/contributor consent recorded.
- [ ] Hero flows pass QA.
- [ ] Location-denied flow passes QA.
- [ ] Offline/stale behavior passes QA.
- [ ] Accessibility review complete.
- [ ] Security review complete.
- [ ] Support contact active.
- [ ] Incident owner assigned.
- [ ] Analytics verified.
- [ ] Rollback plan tested.
- [ ] Public status language reviewed.

## 36.5 Support

Support must accept:

- data correction;
- place correction;
- privacy request;
- account request;
- safety concern;
- and technical issue.

Every report receives a reference ID.

## 36.6 Install education

Do not immediately block the experience with “Install app.”

Offer installation after value, for example after a successful second session or when the user saves an item.

---

# 37. Growth and monetization guardrails

## 37.1 Growth principle

Growth must increase data density and useful decisions, not just downloads.

## 37.2 Early growth loops

- Share a specific item/place result.
- Invite a trusted vendor to confirm stock.
- Report a missing place.
- Ask a buyer to confirm an outcome.
- Publish area coverage transparently.

## 37.3 Potential monetization

Later possibilities:

- verified vendor subscription tools;
- merchant availability management;
- clearly labelled sponsored placement;
- business intelligence dashboards;
- aggregated market-data API;
- procurement tools;
- transaction or referral revenue;
- and institutional data services.

## 37.4 Trust firewall

Payment MUST NOT:

- convert an unverified listing into a verified one;
- hide negative or stale availability;
- alter organic “recommended” ranking without clear sponsorship;
- or buy access to precise user location.

Partner rewards, discounts, loyalty perks, or promotional benefits may be considered only
under a separate accepted ADR. They consume an explicit eligibility result; they never
create identity verification, reputation, claim confidence, moderation approval, earned
status, or organic rank. WetinDey does not become a wallet, payout, checkout, order, or
fulfilment system through rewards.

## 37.5 No ads in the hero flow initially

Version One should not place advertising between item search and decision result.

Trust and task speed are more valuable than early impression revenue.

---

# 38. Modular expansion rules

## 38.1 Expansion gate

A new module may enter discovery only when:

- Food’s hero flow works;
- the shared core is stable;
- the new problem is validated;
- reliable data supply exists;
- and the module can use the existing context → intent → trust → decision model.

It must also define a typed subject, primary live signal, observation semantics,
freshness/conflict policy, contribution path, and outcome. A category string, changed
metadata, or price-shaped seed value does not implement a module.

## 38.2 Module acceptance questions

1. Is the problem frequent enough?
2. Does current information failure cause a meaningful cost?
3. Is the answer place- or context-sensitive?
4. Can the data be sourced and verified?
5. Can WetinDey help a user decide in seconds?
6. Can the module fit the map-and-sheet model without confusing Food?
7. Does it deserve its own layer rather than a separate product?

## 38.3 Interaction rule

New modules may add:

- new item/data types;
- new marker semantics;
- new report fields;
- new trust policies;
- and new actions.

They SHOULD NOT add:

- a new global navigation model;
- an unrelated dashboard;
- a social feed;
- or an entirely different component language.

## 38.4 Candidate future modules

Examples only, not roadmap commitments:

- medicine availability;
- fuel availability and price;
- electricity status;
- local disruption alerts;
- market services.

No candidate is approved by appearing in this list.

---

# 39. Risk register

| Risk | Severity | Early signal | Mitigation |
|---|---|---|---|
| Availability becomes stale too quickly | Critical | High correction rate; wasted trips | Narrow items/area; faster expiry; vendor/agent updates |
| Price and unit mismatch | Critical | User confusion; conflicting reports | Canonical unit system; clarification; contributor training |
| Fake or manipulated reports | Critical | Coordinated anomalies | Reputation, evidence, rate limits, audits, moderation |
| Insufficient data density | Critical | Empty results | Baseline operations before launch; bounded geography |
| Map is too heavy | High | Slow LCP, crashes | Lazy load; list fallback; reduced-data mode |
| Users prefer trusted calls | High | Search without action/return | Vendor call action; research; sharpen use case |
| Vendor resistance to transparency | High | Refusal or false updates | Consent, ranges, value proposition, neutral rankings |
| Name conflict | High | Legal objection or store rejection | Formal clearance; backup naming plan |
| Public data misrepresented as live | High | Trust complaints | Separate price kinds and labels |
| PWA limitations on iOS/Android | Medium | install/push inconsistency | Progressive enhancement; web works without install |
| Map-provider cost or poor geocoding | High | rising unit cost; bad place search | Provider adapter; cost alerts; manual place data |
| Privacy breach through evidence/location | Critical | personal data exposure | private storage, minimization, EXIF controls, review |
| Team overbuilds platform | High | abstractions without users | modular monolith; Food-first release gate |
| Monetization corrupts ranking | Critical | paid listings appear “best” | trust firewall and sponsor labels |
| Coverage becomes Lagos-only indefinitely | Medium | no operational expansion path | document repeatable market ops; expand only with density |

## 39.1 Kill or pivot criteria

The team should consider pivoting the mechanism or problem when:

- fresh availability cannot be maintained at sustainable cost;
- verified decision sessions remain low despite sufficient awareness;
- users consistently value only static price history, not availability;
- supply-side participation is structurally unavailable;
- or reports create more false confidence than useful decisions.

---

# 40. Decision log

## 40.1 Decisions currently accepted

| Decision | Status | Reason |
|---|---|---|
| Working name is WetinDey | Accepted, pending legal clearance | Natural Nigerian phrase and strong product fit |
| First module is Food | Accepted as current hypothesis | Price plus availability is a meaningful local decision problem |
| V1 solves one module only | Accepted | Quality and trust over feature count |
| Map-and-sheet is the primary model | Accepted for prototype | Context continuity and local comparison |
| Map must have list equivalent | Accepted | Accessibility, performance, and user preference |
| Dyrane UI/UX governs experience | Accepted | Progressive disclosure and decision support |
| Apple HIG is a design reference | Accepted | Clarity, consistency, accessibility, platform discipline |
| Next.js PWA on Vercel | Accepted | Fast cross-platform launch and existing stack preference |
| Neon Postgres + PostGIS | Accepted | Typed relational and geospatial foundation |
| Drizzle is the ORM | Accepted — see [ADR-004](docs/adr/004-drizzle-is-the-orm.md) | Shipped and load-bearing. `drizzle-orm ^0.45.2` + `drizzle-kit ^0.31.10` own the whole data layer; `pg` is the driver beneath them, not an alternative. Listed open for months, which invited an agent to re-decide it and rewrite `src/app/actions.ts` |
| Mapbox is the map provider; there is no geocoder | Accepted — see [ADR-005](docs/adr/005-mapbox-is-the-map-provider.md) | Shipped. Mapbox GL JS v3.1.2, CDN-loaded in `layout.tsx:88-89` — deliberately not a package dependency — keyed by the public `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN`. Every screen sits on it |
| Neon Auth (email OTP) is the authentication provider | Accepted — see [ADR-003](docs/adr/003-identity-for-contribution-trust.md) | Shipped `26350ba`. `@neondatabase/auth 0.4.2-beta`, proxied at `src/app/api/auth/[...path]/route.ts` so the session cookie is first-party. Reading stays anonymous forever; auth is recognition, never a gate |
| Freshness windows are 24h stale / 72h expired | Accepted — see [ADR-006](docs/adr/006-freshness-windows.md) | The numbers are in force: `FRESHNESS_POLICY = { staleHours: 24, expirationHours: 72 }` (`src/lib/trust.ts:65-68`). **Ratified, not yet true.** `src/lib/trust.ts` is named the single authoritative expression of the policy, but it is not yet the only one: a competing model lives in `ItemDetailSheet.tsx:135` (`offerSignal`) and `:181` (`confidenceFor`), and `page.tsx:626` imports it back out of a sheet to colour map pins. 72h is also hardcoded at `actions.ts:357` and `:624` and duplicated in `seed.ts:31-32`. Phase 1 makes the policy sole. Until then, do not read this row as "freshness works" |
| Modular monolith | Accepted | Reuse without premature microservices |
| Anonymous browse, optional recognition | **Amended 16 Jul 2026 — see [ADR-003](docs/adr/003-identity-for-contribution-trust.md)** | Reading is anonymous permanently — no sign-in to open the app, search, or read a price. Writing may be attributed: signing in is how a contributor earns a reputation that weights their reports. Contributing anonymously stays possible and simply weighs less. Auth is recognition, never a gate |
| No checkout/delivery in V1 | Accepted | Protect core decision experience |
| Fulfilment is out of scope entirely; buyer and seller arrange it themselves via Contact seller | Accepted — see [ADR-001](docs/adr/001-fulfilment-is-out-of-scope.md) | A WetinDey price is a dated observation, not a quotable commitment; and the catalogue is market stalls, which no courier platform can represent |
| `docs/architecture/SERVICE-ARCHITECTURE.md` is the architecture of record; correctness work precedes boundary work | Accepted — see [ADR-002](docs/adr/002-service-architecture-of-record.md) | The modular architecture in Section 25/26 and `AGENTS.md` was never implemented. Documentation that describes a system that does not exist has already produced two generations of dead code |
| Multi-Category Expansion and Core Pillars | Accepted — see [ADR-008](docs/adr/008-category-filtering-and-pillars.md); proposed amendment ADR-010 | Expands product scope beyond Food to 6 pillars. The existing selector is partial: a category value does not supply a typed subject, signal, contribution, filter, marker, trust, or outcome model |
| Polymorphic Ratings and Reviews System | Accepted — see [ADR-009](docs/adr/009-polymorphic-ratings-and-reviews.md); proposed amendment ADR-011 | Introduces review schema, not a live review capability. Reviews remain subjective and do not become current-state evidence or usable rating filters merely because tables exist |
| Observation provenance is explicit and fail-closed | Accepted — see [ADR-012](docs/adr/012-observation-provenance-boundary.md) | Immutable observations distinguish synthetic, observed, partner, reference, and inferred origin. Historical and forgotten writers fail closed to synthetic; live contribution writers declare observed. This classification does not itself authorize partner ingest, media, trust weighting, or public labels |

> **Section 25 and Section 26 describe a TARGET, not the current system.** Verified 16 July 2026:
> `WetinDeyModule` has zero live implementations, `src/modules/food/` is orphaned, and
> `src/db/queries/` is empty. The application is `src/app/page.tsx` plus `src/app/actions.ts`.
> Read [ADR-002](docs/adr/002-service-architecture-of-record.md) and the architecture of
> record before citing those sections as fact.

## 40.2 Open decisions

- [ADR-010](docs/adr/010-typed-live-local-information-platform.md): detailed ontology for
  the owner-directed correction that WetinDey is a live local information platform rather
  than a universal price app. The proposal separates pillars, selectable capabilities,
  signal types, claims, observations, and current-state projections.
- [ADR-011](docs/adr/011-earned-trust-graph-and-reputation.md): detailed Trust Graph and
  earned-reputation boundaries. The owner-directed principles are that trust is earned,
  verification and status cannot be purchased, and confidence remains claim-specific.
- Pilot city and exact coverage boundary.
- Initial 8–12 items.
- Canonical and local unit policy.
- Evidence and catalog media policy. **Still open.** Vercel Blob is now wired for profile avatars, but identity media does not decide report evidence or item reference imagery. There is still no evidence-media table or report attachment path. Observation evidence requires private/public classification, EXIF removal, content hashing, size caps, moderation, retention, deletion, and offline behavior. Catalog imagery separately requires curation, attribution, licensing, duplicate handling, and operator authorization. Decide and build them in separate lanes.
- Vendor/contact model. **Promoted to blocking by [ADR-001](docs/adr/001-fulfilment-is-out-of-scope.md).** Handing fulfilment to the buyer and seller makes Contact seller the terminal step of the core journey, and it currently resolves for no place at all: `contact_visibility` defaults to `private`, and the `contact_channel_kind` / `contact_channel_value` columns are read by nothing and written by nothing. Trader consent capture (Section 24) is the unbuilt precondition.
- Contributor compensation.
- Public-versus-private evidence policy.
- Final visual identity and accent color.
- Trademark and domain strategy.

## 40.3 ADR template

```md
# ADR-XXX: Decision title

Date:
Status: Proposed | Accepted | Superseded | Rejected
Owners:

## Context
What problem or constraint requires a decision?

## Decision
What are we doing?

## Alternatives considered
What else was evaluated?

## Consequences
What improves, worsens, or becomes irreversible?

## Validation or review date
When should this be reconsidered?
```

---

# 41. Developer implementation brief

## 41.1 Build objective

Deliver a polished, production-capable PWA prototype and pilot product for one question:

> **Where is this selected food item recently confirmed around the user, and what price should they expect for the selected unit?**

## 41.2 Build order

### Step 1 — Repository and quality foundation

- Next.js App Router.
- TypeScript strict.
- linting and formatting.
- unit and E2E test setup.
- preview deployments.
- environment validation.
- error tracking.
- accessibility linting.

### Step 2 — Design-system primitives

- tokens;
- typography;
- buttons;
- inputs;
- status badges;
- cards;
- skeletons;
- banners;
- focus states;
- light/dark themes.

### Step 3 — PWA shell

- manifest;
- icons;
- standalone-safe layout;
- service worker;
- offline shell;
- update notification;
- safe areas.

### Step 4 — Map and sheet prototype with mock data

- provider adapter;
- map canvas;
- markers;
- list equivalent;
- sheet detents;
- desktop side panel;
- preserved state;
- reduced motion.

### Step 5 — Food search

- canonical items;
- aliases;
- clarification;
- recent searches;
- URL state.

### Step 6 — Database and geospatial discovery

- migrations;
- PostGIS;
- seed data;
- repository layer;
- radius/area query;
- derived result response.

### Step 7 — Trust presentation

- availability state;
- freshness;
- price kinds;
- source summary;
- no-data/conflict states.

### Step 8 — Detail and actions

- place/offer detail;
- directions handoff;
- share;
- call where consented;
- report change.

### Step 9 — Observation reporting

- schema-driven form;
- optional evidence;
- server validation;
- idempotency;
- moderation status;
- offline queue.

### Step 10 — Operations console

- moderation queue;
- item/unit management;
- place management;
- source management;
- audit log;
- coverage view.

### Step 11 — Hardening

- rate limits;
- security headers;
- privacy review;
- accessibility review;
- performance budget;
- supported-device test;
- rollback test.

## 41.3 Implementation rule

The developer must not invent domain meaning in UI code.

Availability, price kinds, freshness, and trust are domain types defined in the module and application layers.

## 41.4 No premature feature work

Do not add:

- notifications;
- accounts;
- saved lists;
- AI chat;
- delivery;
- payments;
- or future modules

until the core acceptance criteria pass, unless a documented product decision changes scope.

---

# 42. Suggested repository structure

```text
wetindey/
├── README.md
├── WETINDEY_BIBLE.md
├── package.json
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── vercel.json
├── public/
│   ├── icons/
│   ├── manifest-assets/
│   └── offline/
├── src/
│   ├── app/
│   │   ├── (public)/
│   │   │   ├── page.tsx
│   │   │   ├── item/[itemSlug]/page.tsx
│   │   │   ├── place/[placeSlug]/page.tsx
│   │   │   ├── report/page.tsx
│   │   │   ├── settings/page.tsx
│   │   │   ├── help/page.tsx
│   │   │   ├── about/page.tsx
│   │   │   ├── privacy/page.tsx
│   │   │   └── terms/page.tsx
│   │   ├── ops/
│   │   │   ├── observations/
│   │   │   ├── items/
│   │   │   ├── places/
│   │   │   ├── sources/
│   │   │   └── analytics/
│   │   ├── api/v1/
│   │   ├── layout.tsx
│   │   ├── error.tsx
│   │   ├── not-found.tsx
│   │   └── manifest.ts
│   ├── core/
│   │   ├── context/
│   │   ├── discovery/
│   │   ├── map/
│   │   ├── reporting/
│   │   ├── trust/
│   │   ├── media/
│   │   ├── offline/
│   │   └── analytics/
│   ├── modules/
│   │   └── food/
│   │       ├── domain/
│   │       ├── application/
│   │       ├── infrastructure/
│   │       ├── presentation/
│   │       ├── schemas/
│   │       ├── copy/
│   │       └── tests/
│   ├── design-system/
│   │   ├── tokens/
│   │   ├── components/
│   │   ├── motion/
│   │   └── accessibility/
│   ├── db/
│   │   ├── schema/
│   │   ├── migrations/
│   │   ├── queries/
│   │   └── seed/
│   ├── integrations/
│   │   ├── maps/
│   │   ├── blob/
│   │   ├── analytics/
│   │   └── public-data/
│   ├── lib/
│   ├── config/
│   └── test/
├── docs/
│   ├── adr/
│   ├── research/
│   ├── operations/
│   ├── privacy/
│   └── runbooks/
└── .github/
    ├── workflows/
    ├── pull_request_template.md
    └── ISSUE_TEMPLATE/
```

## 42.1 Folder rule

Prefer domain ownership over giant generic folders.

Do not create `utils.ts` dumping grounds. Utilities must have a clear purpose and owner.

---

# 43. Coding standards

## 43.1 TypeScript

- `strict: true`.
- No unbounded `any`.
- Narrow `unknown` at boundaries.
- Domain enums use explicit string unions or enums.
- Money and units use dedicated types.
- Dates cross boundaries as ISO strings and become typed objects internally.

## 43.2 Components

- Keep presentational primitives domain-neutral.
- Keep Food logic in the Food module.
- Use server components by default.
- Add client components at the smallest interactive boundary.
- Avoid global state for server-derived data.
- Do not place network calls inside low-level UI components.

## 43.3 Validation

- Validate environment variables at startup/build.
- Validate every external request.
- Validate database-derived JSON before trusting it where schemas can drift.
- Return structured error codes.

## 43.4 Database

- All schema changes use migrations.
- No manual production edits without a runbook and audit.
- Observation records are immutable.
- Derived tables may be rebuilt.
- Queries must be explainable and indexed before high traffic.

## 43.5 Security

- No secrets in client bundles.
- Sanitize/escape user-visible text.
- Authorize every ops action server-side.
- Rate limit abuse-prone endpoints.
- Log security events without logging sensitive payloads.

## 43.6 Accessibility

- Semantic HTML before ARIA.
- Accessible names required.
- Do not make a `div` behave like a button when a button exists.
- Keyboard and screen-reader tests are required for shared components.

## 43.7 Testing

Every bug fix should add a regression test where practical.

Critical domain logic requires unit tests before merge.

Hero flows require E2E coverage.

## 43.8 Logging

Use structured logs with:

- request ID;
- operation;
- severity;
- duration;
- and non-sensitive identifiers.

Never log:

- passwords;
- auth tokens;
- precise location tied to identity;
- evidence image content;
- or full free-text notes by default.

## 43.9 Git and pull requests

Each PR should be:

- small enough to review;
- linked to a decision or ticket;
- accompanied by screenshots/video for UX changes;
- accompanied by tests;
- and explicit about migration, privacy, accessibility, and performance impact.

## 43.10 Dependency policy

Add a dependency only when:

- the problem is real;
- the package is maintained;
- bundle impact is understood;
- licensing is acceptable;
- and the team cannot implement a safer simpler alternative reasonably.

---

# 44. Definition of done

A feature is done only when:

- product behavior matches the approved flow;
- loading, empty, error, offline, stale, and denied states exist;
- mobile and desktop behavior is complete;
- light and dark appearance is complete;
- keyboard and screen-reader behavior is complete;
- analytics events are implemented and verified;
- data semantics are correct;
- security and privacy implications are reviewed;
- tests pass;
- documentation is updated;
- and the deployed preview is approved.

“Works on my phone” is not done.

---

# 45. Acceptance criteria

## 45.1 Home and context

- User sees the app shell before map completion.
- User can search without an account.
- User can continue after denying location.
- Selected area is visible.
- Location is not repeatedly requested after denial.
- Map failure does not block search or list results.

## 45.2 Search

- Search resolves supported canonical names and aliases.
- Typographical variation is tolerated within defined limits.
- Ambiguous queries trigger one concise clarification.
- Search can be completed with keyboard and screen reader.
- Unsupported items produce a helpful no-match state.

## 45.3 Results

- Every result identifies item, unit, place, availability, freshness, and price type.
- Results do not claim live availability from public monthly data.
- Selected card and marker remain synchronized.
- List view provides all essential map information.
- Ranking does not default to cheapest-only.

## 45.4 Detail

- User can understand why the result is trusted or limited.
- Exact and range prices are visually distinct.
- User can get directions.
- User can report a change.
- Back restores prior result list, map position, and scroll state.

## 45.5 Reporting

- Form adapts to availability answer.
- Unit is required for price.
- Future observation times are rejected beyond tolerance.
- Evidence is optional unless a contributor role requires it.
- Duplicate submission retry does not create duplicate observations.
- Offline submission is clearly queued.
- User sees moderation/publication state.

## 45.6 Trust

- Stale data is visually and semantically distinct.
- Conflicting reports are not averaged into false confidence.
- Public reference data is labelled.
- Source summary is available.
- Correction creates an auditable new event.

## 45.7 Performance

- Core Web Vitals meet target on representative field traffic or documented blockers exist before launch.
- Map code does not block the first useful shell.
- Reduced-data mode works.
- No custom font blocks rendering.

## 45.8 Accessibility

- Core flows pass automated checks and manual keyboard/screen-reader testing.
- Touch targets meet size requirements.
- Color is not the sole status indicator.
- Reduced motion is respected.
- Text can scale to 200% without loss of function.

## 45.9 Privacy and security

- Location use is explained.
- Anonymous browsing works.
- Evidence defaults to private moderation access.
- Ops routes require authorization.
- Rate limiting is active.
- secrets and private data do not appear in client bundles or logs.

---

# 46. Initial copy deck

These are first-draft strings for prototype testing.

## 46.1 Home

**Search placeholder**  
`Wetin you dey find?`

**Area label**  
`Showing around Yaba`

**Location prompt title**  
`See what’s available around you`

**Location prompt body**  
`Allow location once, or choose your area yourself.`

**Primary action**  
`Use my location`

**Secondary action**  
`Choose area`

## 46.2 Search

**Recent heading**  
`Recent`

**Suggestions heading**  
`Popular around this area`

**No match title**  
`We never support this item yet`

**No match body**  
`Try another name, or tell us the item you want us to add.`

## 46.3 Clarification

**Title**  
`Which one you mean?`

**Unit helper**  
`Prices only compare well when the quantity is the same.`

## 46.4 Results

**Summary**  
`Brown beans · 1 kg`

**Fresh coverage**  
`4 places confirmed today`

**No fresh coverage title**  
`We never confirm am around here today`

**No fresh coverage body**  
`Widen the area, or report a place where you saw it.`

**Map moved action**  
`Search this area`

## 46.5 Availability

- `Confirmed available`
- `Likely available`
- `Low stock reported`
- `Reported unavailable`
- `Not confirmed today`
- `Conflicting reports`

## 46.6 Trust

- `Verified vendor update`
- `Confirmed by 2 buyers today`
- `Field report with photo`
- `Single community report`
- `Yesterday’s report`
- `Monthly reference — not live`

## 46.7 Detail

**Price range explanation**  
`Different sellers reported prices within this range today.`

**Limitation**  
`Stock and price can change before you arrive.`

**Primary action**  
`Get directions`

**Secondary action**  
`Report update`

## 46.8 Report

**Entry title**  
`Help confirm wetin dey`

**Availability question**  
`You see this item there?`

Options:

- `Yes, available`
- `Small quantity`
- `No, e finish`
- `I’m not sure`

**Price question**  
`How much for this unit?`

**Evidence helper**  
`Add a receipt or product photo if you can. Avoid people’s faces and private details.`

**Submit**  
`Send update`

## 46.9 Success

**Published**  
`Update added. Thank you.`

**Moderation**  
`We received it. We’ll check it before it changes the public result.`

**Offline**  
`Saved on this device. We’ll send it when you reconnect.`

## 46.10 Errors

**Network**  
`Connection no stable. Try again, or view the last saved result.`

**Map unavailable**  
`Map no load, but your results still dey below.`

**Location timeout**  
`We couldn’t get your location. Choose your area instead.`

**Rate limit**  
`Too many updates came from this device. Try again later.`

---

# 47. Research backlog

## 47.1 Problem interviews

Questions for buyers:

- Tell us about the last time you went to buy an item and it was unavailable.
- How did you decide which market or seller to try?
- What information did you seek before leaving?
- Which items are most uncertain?
- Which units do you actually use?
- When is a price difference worth travelling for?
- Who do you trust for current information?
- Would you submit a price or availability update? Under what conditions?

Avoid asking only, “Would you use this app?”

## 47.2 Supply interviews

Questions for vendors/traders:

- How often do prices change?
- Which items run out unpredictably?
- Which units are stable enough to report?
- What would make price visibility useful or harmful?
- Who currently records prices?
- Would the vendor confirm availability digitally?
- What proof can be captured without slowing business?

## 47.3 Field data study

For each candidate item:

- collect across multiple sellers;
- record unit definitions;
- record intra-day changes;
- record availability changes;
- compare contributor agreement;
- assess evidence burden;
- and measure time per observation.

## 47.4 Prototype tests

Test:

- map-first versus list-first comprehension;
- search wording;
- unit clarification;
- trust labels;
- exact versus range price;
- stale state;
- no-answer state;
- and report flow.

## 47.5 Competitor teardown

Inspect current:

- institutional food-price products;
- grocery commerce apps;
- local market-price communities;
- global grocery comparison apps;
- map-based availability products in other categories.

Record:

- exact user job;
- geography;
- data source;
- cadence;
- unit model;
- availability model;
- trust display;
- and monetization.

## 47.6 Research evidence grades

- **A:** observed behavior, direct data, or primary source.
- **B:** repeated interview evidence or credible secondary source.
- **C:** single interview or directional signal.
- **D:** internal intuition.

Product claims should identify their current grade until validated.

---

# 48. Glossary

**Availability** — Time-bound evidence that a defined item can be obtained at a place.  
**Category capability** — Proposed term for a complete selectable vertical that owns its
typed signals, queries, filters, contribution, map, presentation, trust, and outcomes.  
**Canonical item** — Stable internal food identity used to unify aliases.  
**Claim** — Proposed term for one typed proposition about a subject in local context.  
**Confidence** — Internal assessment of how strongly evidence supports a claim.  
**Context** — Place, time, item, unit, and intention relevant to a decision.  
**Decision result** — A user-facing synthesis of place, availability, price, freshness, and trust.  
**Derived offer** — Current product representation calculated from immutable observations.  
**Dyrane UI/UX** — The product philosophy of context, progressive disclosure, decision support, continuity, honesty, and premium simplicity.  
**Evidence** — Artifact supporting an observation, such as receipt, photo, audit, or vendor confirmation.  
**Freshness** — Whether information remains recent enough for its category and source.  
**Local unit** — Informal or regional measure used in commerce.  
**Module** — A problem domain using the shared WetinDey core.  
**Observation** — Immutable report about an item, place, time, availability, or price.  
**Pillar** — Proposed term for a product-portfolio grouping; it is not itself a database
signal type or proof that a vertical is implemented.  
**Place** — Market, store, seller location, or other purchasable destination.  
**Product flow** — How WetinDey turns context and signals into a decision, action, and learning loop.  
**Source** — Person, partner, vendor, dataset, or system behind an observation.  
**Reputation** — Proposed term for scoped, versioned history derived from independently
validated outcomes, including sample size and uncertainty.  
**Signal type** — Proposed typed family of nearby state, such as price, stock, exchange
rate, power status, route status, service availability, or event status.  
**Trust level** — User-facing explanation of evidence strength.  
**Unit** — Defined quantity to which a price applies.  
**User flow** — Screens and actions a user takes to complete a task.  
**Variant** — Meaningful item distinction affecting intent or comparability.  

---

# 49. Reference standards

The team should consult the current official versions of:

- Apple Human Interface Guidelines.
- Apple accessibility, dark mode, search-field, materials, icon, and motion guidance.
- Next.js App Router documentation.
- Next.js Progressive Web App guide.
- Next.js Server Actions and Route Handlers documentation.
- Vercel Blob documentation.
- Vercel Cron, Queues, WAF, Analytics, and Speed Insights documentation.
- Neon Postgres and PostGIS documentation.
- MDN Progressive Web App, web app manifest, service worker, offline, notification, and accessibility documentation.
- W3C Web Content Accessibility Guidelines and accessibility fundamentals.
- Nigeria Data Protection Commission guidance and the Nigeria Data Protection Act 2023.
- National Bureau of Statistics Selected Food Price Watch methodology and releases.
- World Bank Nigeria market-level food-price dataset documentation.

Documentation changes. Engineering decisions that depend on current platform behavior must be checked against official documentation at implementation time.

---

# 50. Changelog

## Version 0.1 — 16 July 2026

- Established WetinDey as the working product name.
- Defined Food price and availability as the initial problem module.
- Distinguished product flow, experience flow, user flow, and system flow.
- Defined map-and-sheet as the prototype interaction model with a full list alternative.
- Established Dyrane UI/UX principles.
- Established Apple HIG as a reference rather than a literal clone.
- Confirmed Next.js PWA, Vercel hosting, and Neon Postgres/PostGIS as the technical foundation; evidence and catalog media storage remain open.
- Defined trust, availability, price, data operations, modular architecture, privacy, security, testing, delivery, and launch requirements.
- Added open decisions and validation gates to prevent unresearched claims.

---

# Final product mandate

WetinDey exists to help a person understand the current state of nearby reality before
they leave. Version One proves that mission through one honest Food vertical: a person can
open a calm, fast interface, state the food item they need, see where it was recently
confirmed, understand the expected price for the exact unit, judge the evidence, and take
the next action without confusion. Future categories earn their place by representing
their own primary live signal honestly rather than forcing everything through price.

The map is not the product.  
The sheet is not the product.  
The price is not the product.  
The framework is not the product.

> **The product is a trustworthy decision made with less uncertainty.**

Everything else exists to serve that outcome.

---

# Appendix A — Current reference links used for this draft

These links were checked during preparation on 16 July 2026. Platform documentation and regulations may change; implementation work should re-check the current version.

## Product and interface standards

- Apple Human Interface Guidelines: https://developer.apple.com/design/human-interface-guidelines/
- Apple accessibility guidance: https://developer.apple.com/design/human-interface-guidelines/accessibility
- Apple search-field guidance: https://developer.apple.com/design/human-interface-guidelines/search-fields
- Apple dark-mode guidance: https://developer.apple.com/design/human-interface-guidelines/dark-mode
- W3C accessibility introduction: https://www.w3.org/WAI/fundamentals/accessibility-intro/

## PWA and application stack

- Next.js PWA guide: https://nextjs.org/docs/app/guides/progressive-web-apps
- Next.js App Router: https://nextjs.org/docs/app
- Next.js mutating data / Server Functions: https://nextjs.org/docs/app/getting-started/mutating-data
- Next.js Route Handlers: https://nextjs.org/docs/app/getting-started/route-handlers
- MDN web app manifest: https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest
- MDN PWA overview: https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/What_is_a_progressive_web_app
- MDN offline and background operation: https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Offline_and_background_operation

## Vercel and data infrastructure

- Vercel Blob: https://vercel.com/docs/vercel-blob
- Vercel private Blob storage: https://vercel.com/docs/vercel-blob/private-storage
- Vercel Cron Jobs: https://vercel.com/docs/cron-jobs
- Vercel Queues: https://vercel.com/docs/queues
- Vercel WAF rate limiting: https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting
- Vercel Speed Insights: https://vercel.com/docs/speed-insights
- Neon documentation: https://neon.com/docs/introduction
- Neon PostGIS: https://neon.com/docs/extensions/postgis

## Nigeria privacy and data references

- Nigeria Data Protection Commission: https://ndpc.gov.ng/
- Nigeria Data Protection Act 2023: https://ndpc.gov.ng/wp-content/uploads/2024/03/Nigeria_Data_Protection_Act_2023.pdf
- NDP Act General Application and Implementation Directive: https://ndpc.gov.ng/wp-content/uploads/2025/07/NDP-ACT-GAID-2025-MARCH-20TH.pdf

## Food-price landscape references

- National Bureau of Statistics Selected Food Price Watch catalog: https://microdata.nigerianstat.gov.ng/index.php/catalog/162
- World Bank Nigeria monthly food-price estimates by product and market: https://microdata.worldbank.org/index.php/catalog/4503
- PricePally: https://www.pricepally.com/
- Bank of Industry PriceSense launch reporting: https://guardian.ng/business-services/business/new-mobile-app-to-aid-food-price-comparison-across-select-states/

## Name due-diligence signals

These do not determine trademark rights; they simply show why formal clearance is required.

- Wetin Dey Global: https://wetindey.ng/
- “Wetin Dey” Nigerian television-series reference: https://en.wikipedia.org/wiki/Wetin_Dey_(TV_series)
