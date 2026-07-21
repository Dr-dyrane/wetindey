# WetinDey General Search and Decision Engine

**Status:** Vision proposal  
**Priority:** Strategic, after the V1 truth foundation  
**Owner:** Dyrane Technologies  
**Governing proposal:** [ADR-027](../adr/027-ai-routed-general-search.md)

## Vision

WetinDey will evolve from category-first local discovery into Nigeria's trusted local
decision layer.

> Ask naturally. Decide confidently. Move with certainty.

Google answers from the web. General-purpose AI answers from learned knowledge. WetinDey
answers from admitted local evidence: observations, confirmations, businesses, prices,
availability, infrastructure signals, authoritative sources, community reports, and
verified partners.

AI understands the question. WetinDey owns the truth.

## The user promise

A person should not need to understand WetinDey's internal categories before succeeding.
They ask what they need:

- `Where can I buy 50kg rice under N90k?`
- `Is there light in Surulere?`
- `Find a pharmacy open now.`
- `Where is diesel cheapest today?`
- `Dollar rate nearby.`
- `What can I buy for N10,000?`

The product returns a structured decision, not a paragraph and not an invented answer.

## Product model

```text
Natural question
    -> validated intent and entities
    -> one supported typed capability
    -> WetinDey evidence and trust rules
    -> concise decision result
    -> alternatives, actions, and evidence on demand
```

Categories remain explicit internal capabilities. They stop being prerequisite user
knowledge only after General Search proves that it is faster, clearer, and at least as
reliable as the category-first path.

## What AI does

1. Detects a supported intent.
2. Extracts typed entities and constraints.
3. Identifies ambiguity or missing information.
4. Selects one allowlisted live capability.
5. Selects a versioned deterministic renderer for the typed result.

AI does not determine local truth, calculate trust, approve evidence, invent businesses,
write final factual copy, or bypass authorization. Facts, numbers, qualifiers, actions,
and uncertainty render from validated capability data rather than model paraphrase.

## Response order

Every answer should reveal understanding progressively:

1. **Question:** what WetinDey understood.
2. **Answer:** the best available evidence-backed decision.
3. **Confidence:** why the answer deserves or does not deserve confidence.
4. **Alternatives:** only the few that improve the decision.
5. **Action:** navigate, contact, share, or report only when truthfully available.
6. **Evidence:** source and history after the user asks.

The shared shell is intentionally small. Each capability owns its typed meaning; a power
status is not rendered as a Food offer, and an exchange reference is not seller stock.

## Example result

```text
Mama Gold Rice, 50kg
N87,500
Confirmed 22 minutes ago
4 matching sellers within 2.4 km

[View best option] [See alternatives]
```

Every line must be supplied or derived by the selected capability. When evidence cannot
support the request, the correct answer is a short unavailable or uncertain state.

## Search modes

These are user intents, not separate chatbot personalities:

- nearby lookup;
- recommendation;
- comparison;
- explanation grounded in admitted sources;
- navigation;
- community-confirmation lookup;
- budget discovery; and
- typed follow-up refinement.

Only modes supported by a complete live capability may be exposed.

## Strategic phases

### Foundation

Finish provenance admissibility, contribution integrity, moderation, executable tests,
and a second complete typed vertical. Collect privacy-safe query patterns and define
evaluation sets before model integration.

### First General Search slice

Add one global input with an explicit category fallback. Route only supported Food
questions through a versioned intent schema into the existing live Food query. Return a
structured answer and fail closed for everything else.

### Multi-vertical routing

After a second vertical is complete, route between real capabilities and extract only the
contracts both implementations prove they share.

### Follow-ups and multimodal input

Add typed contextual refinements, then voice or image input only after consent, retention,
security, and capability-specific evidence rules are approved.

### Model optimization

Use a gateway only when routing by latency, capability, cost, and safety is operationally
valuable. Users never select models. Model transport remains replaceable and cannot become
the source of truth.

## Product success measures

- A busy user understands the answer in under three seconds.
- Supported requests reach a confident decision faster than category-first search.
- Every factual claim resolves to admitted evidence.
- Unsupported and ambiguous requests abstain rather than improvise.
- General Search does not reduce anonymous browsing, accessibility, privacy, or offline
  resilience.
- Removing category knowledge from the user's task does not remove typed category truth
  from the system.

## Not authorized by this vision

- an open-ended chatbot;
- model-generated local facts;
- direct model database access;
- a speculative universal tool registry;
- empty vertical adapters;
- silent precise-location, preference, or history disclosure;
- replacing category fallback before evidence; or
- implementation, provider activation, deployment, or rollout without a separately
  claimed and independently refuted vertical slice.
