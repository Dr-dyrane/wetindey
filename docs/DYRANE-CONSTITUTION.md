# Dyrane Constitution v1.0

Software exists to reduce human effort, not increase it.

## 1. Purpose

Build software that helps people think less, decide faster, and trust more.

If a feature increases cognitive load without increasing value, it does not belong.

## 2. Truth

Represent reality honestly.

Never fake certainty.

Never hide uncertainty.

Never mislead through UI.

Truth always wins over aesthetics.

## 3. Simplicity

Remove before adding.

The best interface is the one that disappears.

Complexity belongs inside the system, never inside the user's mind.

## 4. Clarity

Every screen answers one primary question.

Every action has one obvious path.

Everything else supports that purpose.

## 5. Attention

Attention is finite.

Spend it deliberately.

Nothing should compete with the most important information.

## 6. Information

Do not display data.

Reveal meaning.

Do not show numbers.

Explain decisions.

## 7. Visualization

Visualize decisions, not information.

Cards explain.

Charts compare.

Tables verify.

Logs prove.

## 8. Hierarchy

The eye should know where to look without thinking.

Hierarchy comes from:

1. Size
2. Weight
3. Spacing
4. Contrast
5. Color

## 9. Color

Color communicates meaning.

Never decoration.

- Gray = Neutral
- Blue = Primary
- Green = Positive
- Orange = Attention
- Red = Critical

## 10. Motion

Motion explains change.

Never entertain.

Every animation must communicate:

- Arrival
- Departure
- Progress
- Relationship
- Continuity

## 11. AI

AI exists to reduce work.

Never remove human judgment.

AI explains.

Humans decide.

## 12. Progressive Disclosure

Reveal complexity gradually.

Do not overwhelm.

Simple first.

Advanced when requested.

## 13. Context

Information without context is noise.

Every metric answers:

- Why?
- Compared to what?
- What should I do?

## 14. Density

Whitespace is information.

Silence is design.

Not everything deserves to exist.

## 15. Components

Components exist to express intent.

Never build components because they are fashionable.

## 16. Architecture

Organize around human intent.

Never around frameworks.

Frameworks change.

Intent survives.

## 17. Performance

Fast is a feature.

Responsiveness is correctness.

Waiting is friction.

## 18. Accessibility

The interface belongs to everyone.

Accessibility is not optional.

It is correctness.

## 19. Copy

Every word must earn its place.

Short.

Clear.

Human.

## 20. Defaults

The default path should be the correct path.

The user should rarely configure before succeeding.

## 21. Errors

Never blame the user.

Explain.

Recover.

Continue.

## 22. Trust

Never surprise the user.

Predictability creates confidence.

Confidence creates trust.

## 23. Feedback

Every action deserves feedback.

Nothing should feel broken.

## 24. Decisions

The best interface minimizes decisions.

The system should think first.

The human should confirm.

## 25. Consistency

Consistency creates intuition.

Intuition creates speed.

## 26. Evolution

Software is never finished.

Every change should improve clarity.

Never accumulate complexity.

## 27. Craft

Beautiful software is not decoration.

Beauty is clarity made visible.

## 28. Ownership

Every pixel must justify its existence.

Every line of code must justify its maintenance.

## 29. Philosophy

Technology is temporary.

Human cognition is not.

Design for humans.

## 30. Final Principle

Whenever uncertain, ask only one question:

> Does this reduce cognitive effort while increasing human confidence?

If the answer is no, remove it.

## The Dyrane Test

Before merging any change, every engineer or AI agent should silently ask:

1. Is this true?
2. Is this simpler?
3. Is this clearer?
4. Does it reduce cognitive effort?
5. Does it help someone make a better decision?
6. Would removing this make the product better?
7. Is this timeless, or just trendy?
8. Does it earn the user's trust?
9. Is this the smallest solution that solves the problem?
10. Would I still make this decision five years from now?

If any answer is no, keep refining.

## How this governs WetinDey

The Dyrane Constitution is the standing human-centered product, design, and engineering
test for WetinDey. Apply it during ideation, implementation, review, refutation, and
release.

It does not replace evidence or change repository precedence. Live code remains the
source of implemented behavior; accepted ADRs govern approved decisions; the architecture
of record governs verified system structure. When a proposal satisfies this Constitution
but conflicts with those authorities, reconcile the conflict explicitly before changing
the product.

## Delivery order for interface work

The Constitution governs both the answer and the order used to reach it. When an
interface direction is unresolved, visual understanding must not wait behind speculative
architecture. Converge on the smallest clear experience in live pixels, freeze that
accepted visual contract, and then connect truthful data, behavior, resilience,
accessibility, and release evidence beneath it.

This is not permission to polish a lie. Safety, privacy, security, schema, migration,
provider, and claim-semantics decisions begin at their governing boundary. Behavioral
defects begin with reproducible evidence. The complete operating sequence and stop rules
live in the
[UI Delivery Decision Tree](design-system/UI-DELIVERY-DECISION-TREE.md).
