# ADR-027: AI-routed General Search over typed truth capabilities

**Date:** 2026-07-21  
**Status:** Proposed  
**Owners:** Dyrane Technologies

> This proposal records product direction. It authorizes no AI endpoint, provider call,
> model, prompt, tool registry, schema, dependency, UI, deployment, or rollout.

## Context

WetinDey currently asks a person to choose a category before using that category's search
experience. The long-term product question is simpler: a person should be able to ask
naturally, and WetinDey should return a concise decision grounded in current local
evidence.

Examples include:

- `Where can I buy 50kg rice under N90k?`
- `Is there light in Lekki?`
- `Find a pharmacy open now.`
- `Where is diesel cheapest today?`
- `Dollar rate nearby.`

The current repository cannot honestly answer most of these questions. Food is the only
established evidence vertical, Money has a bounded reference-rate and Sample discovery
prototype, and ADR-010 forbids a generic capability registry until at least two complete
verticals are live. The live Food search is a structured server action, not a general AI
search service. An AI SDK appearing in dependency metadata is not a wired product
capability.

The strategic opportunity is therefore not to add a chatbot. It is to let AI reduce the
effort required to express intent while preserving WetinDey's typed evidence, provenance,
freshness, confidence, privacy, and fail-closed boundaries.

## Proposed decision

If accepted, WetinDey will introduce **General Search** as an intent layer over complete,
typed local-information capabilities.

The invariant is:

> AI interprets the question. WetinDey evidence answers it.

### Responsibility boundary

The AI layer may:

1. classify a request into a supported intent;
2. extract typed entities such as item, variant, unit, budget, area, time, and radius;
3. identify missing or ambiguous required fields;
4. select one allowlisted live capability; and
5. select a versioned deterministic renderer for that capability's validated result.

The model never writes final factual copy. Displayed facts, numbers, qualifiers, actions,
and uncertainty come from deterministic templates over the validated capability result;
model-generated prose cannot paraphrase or embellish them.

The AI layer must not:

- invent a price, availability state, business, route, opening status, confidence value,
  review, rating, verification, or source;
- query the database directly;
- turn model knowledge or web text into WetinDey evidence;
- weaken provenance admission, freshness, confidence, moderation, or authorization;
- call an unavailable vertical or silently substitute a different intent;
- expose model prose as an untraceable factual answer; or
- continue reasoning indefinitely when a deterministic typed query can answer.

### Typed request and result contracts

Model output is untrusted input. It must pass a versioned runtime schema before any tool
executes. A conceptual request contains:

```json
{
  "intent": "food_search",
  "query": "Mama Gold rice",
  "unit": "50kg bag",
  "budgetNgn": 90000,
  "browsingContext": "user-confirmed-area",
  "radiusKm": 5
}
```

Unknown keys, unsupported intents, invalid units, impossible budgets, and unsafe values
fail closed. The server derives authorization and sensitive context; the client or model
does not supply trusted account identifiers.

Results share only a small decision envelope:

- the question answered;
- a concise summary;
- typed capability payload;
- server-derived confidence and freshness when that capability supports them;
- opaque evidence references that reveal no source content by themselves;
- alternatives; and
- permitted actions.

The payload remains capability-specific. Power, Transport, Health, Housing, Money, and
Food must not be forced into one price, item, seller, or availability shape. Shared UI is
extracted only after two real verticals prove the same semantics.

Evidence references are server-issued, capability-scoped identifiers with a versioned
format. Resolving one repeats authorization and redaction at read time; it never exposes
private reports, account identity, contact values, precise location, raw capture content,
or internal moderation/fraud fields. Reference and resolved-evidence retention follow the
source capability's approved policy rather than an AI-specific cache.

### Context and privacy

General Search uses the least context needed for the question.

- Browsing context may be included because it defines the area being explored.
- Precise device location is not automatic model context. It requires a fresh fix,
  necessity, and the disclosure/consent rules in ADR-023.
- Search history and preferences remain device-local or account-private unless a later
  approved policy defines purpose, retention, deletion, and user control.
- Raw prompts, exact coordinates, contact values, account identifiers, and provider
  payloads must not enter analytics or model logs by default.
- Context sent to a model must be minimized, redacted, retention-bounded, and disclosed.

### Capability and routing gate

General Search may route only to capabilities that already have a live, independently
proved call path and satisfy their governing ADRs. Unsupported requests return a short,
truthful unavailable state and may offer the nearest supported interpretation only after
the user confirms it.

ADR-010 remains binding: no generic tool registry, empty adapter, universal response
component, or speculative module is authorized before at least two complete verticals
exist. The first implementation should be one vertical slice from a visible General
Search input through schema validation, one live capability, a structured answer, and
failure states in the same change.

### User experience

The response order follows the Dyrane Constitution:

1. **Understanding:** the interpreted question;
2. **Decision:** the best evidence-backed answer;
3. **Confidence:** freshness, corroboration, provenance, and uncertainty;
4. **Alternatives:** a small number of useful options;
5. **Action:** only actions the selected capability can truthfully support; and
6. **Evidence:** details on request, never an initial data dump.

Answers are structured surfaces, not conversational essays. A follow-up such as
`What about within 5 km?` mutates the typed request; it does not create an unconstrained
chat history.

Category controls become an implementation and recovery aid, not an immediate removal
target. They remain visible until General Search is measurably faster, clearer, accessible,
and more reliable for supported tasks.

### Model and provider policy

Models are replaceable infrastructure. A future gateway may select a bounded model by
latency, capability, cost, and safety, but routing policy is server-owned and invisible to
the user. Model failure, timeout, malformed output, quota exhaustion, or gateway outage
must fall back to deterministic supported search without blocking anonymous browsing.

Vercel AI Gateway is a possible transport, not a truth source and not an architectural
requirement. Any provider activation requires separate privacy, security, retention,
cost, observability, and failure evidence.

## Delivery sequence

### Phase 0: prove the foundation

- Complete truth/admissibility and contribution-integrity gates.
- Prove at least two typed verticals end to end.
- Inventory real queries and ambiguous Nigerian language patterns without storing private
  prompt data by default.
- Define evaluation sets for intent accuracy, entity extraction, abstention, latency, and
  factual traceability.

### Phase 1: one General Search vertical slice

- One global input alongside an explicit category fallback.
- Versioned intent schema with deterministic validation.
- Food routing only where Food can answer truthfully.
- Structured evidence-backed result and fail-closed unsupported state.
- No conversational memory and no speculative adapter framework.

### Phase 2: earned multi-vertical routing

- Add a second complete typed capability.
- Extract only contracts proven common by both live verticals.
- Add ambiguity clarification, capability-aware suggestions, and shared accessibility
  behavior.

### Phase 3: bounded follow-ups and multimodal input

- Typed follow-up mutations with visible context.
- Voice or image input only after consent, privacy, safety, and capability-specific
  evidence rules are approved.
- Personalized defaults only with explicit control and deletion semantics.

## Alternatives considered

**Ship a general chatbot now.** Rejected. It would answer beyond WetinDey's evidence and
make fluent uncertainty look like local truth.

**Build a universal tool registry before the verticals.** Rejected by ADR-010 and the
no-dead-service rule.

**Use model knowledge or live web search as local truth.** Rejected. External sources may
enter only through the governed provenance and review boundary.

**Remove categories immediately.** Rejected. Categories remain a clear deterministic
fallback until General Search proves better comprehension and reliability.

**Use one universal result schema.** Rejected. A small shared decision envelope may be
valid, but typed capability payloads preserve domain truth.

## Consequences

**Benefits:** people can express intent naturally; categories stop being prerequisite
knowledge; the interface can answer decisions instead of exposing database structure;
models remain replaceable; factual claims stay traceable.

**Costs:** every supported intent needs evaluation data, typed validation, abstention,
latency budgets, privacy controls, and a complete underlying capability. Natural-language
input increases ambiguity and abuse surface.

**Constraint:** General Search can expose only what WetinDey can already answer honestly.
AI does not accelerate unsupported product claims.

## Validation and review

Before implementation acceptance, independently refute:

- intent and entity accuracy against a versioned Nigerian-language evaluation set;
- abstention for every unsupported vertical and ambiguous high-impact request;
- traceability from every displayed fact to a typed capability result;
- zero model-generated prices, businesses, availability, confidence, or verification;
- deterministic fallback for model, gateway, network, quota, and schema failures;
- no exact coordinates, contact values, identifiers, or raw prompts in logs/analytics;
- anonymous browsing and explicit category fallback;
- keyboard, screen-reader, compact/regular, light/dark, offline, loading, empty, and error
  behavior; and
- a measured improvement in time-to-answer and decision confidence over category-first
  search.

Reconsider this proposal if two complete verticals do not share enough interaction
semantics, if deterministic parsing answers the common query set more safely, or if model
latency, cost, or privacy reduces user confidence.
