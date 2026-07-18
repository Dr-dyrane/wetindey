# ADR-018: Controlled semantic iconography

**Date:** 2026-07-18
**Status:** Accepted — visual architecture only; runtime completion unverified
**Decision owner:** WetinDey Founder

## Context

WetinDey needs contextual color and dimensional iconography that make repeated actions
recognizable without turning the interface into a blanket rainbow or confusing context
with asserted status. The earlier interpretation of this ADR made ordinary destinations
and actions neutral. That produced technically accessible but visually under-articulated
controls and did not express the Founder's intended visual system.

Commit `284a685` is the recorded example: its foundation is technically accessible, but
its visual result is **NOT ACCEPTED**. Passing source, focus, naming, target-size, or
contrast checks cannot substitute for a direct visual verdict.

Flags, photography, and avatars are different. Their color is part of licensed or
user-chosen content, not interface status. ADR-017 already requires a licensed bundled SVG
flag sprite, non-emoji rendering, accessible text, and no remote flag requests. This ADR
preserves that decision.

## Decision

WetinDey adopts controlled semantic iconography.

### Color ownership

Primary cards, sheets, inputs, and page surfaces remain calm and neutral. Repeated icon
contexts use controlled named color tokens:

| Owner | Permitted use | Prohibited implication |
|---|---|---|
| Authentic content | Licensed flags, attributed photography, and user-chosen avatars may retain authentic color | Trust, availability, verification, ranking, or endorsement |
| Food | Warm contextual family | Caution, unavailable, confirmation, rating, or generic brand accent |
| Money | Teal contextual family | Confirmation, contact, verification, or exchange-provider status |
| Location and navigation | Blue contextual family | Information truth-state, verification, or generic selection |
| Contact and phone | Green contextual family | Confirmed status, availability, seller verification, or trust |
| Rating | Gold contextual family | Caution, confirmation, trust, verification, or domain identity |
| Status | Dedicated `caution`, `confirmed`, and `unavailable` families apply only when the interface asserts that actual state | Domain identity, navigation, contact, rating, ordinary emphasis, or decoration |
| Neutral | Universal close, search, settings, other universal system controls, and disabled/future categories | No contextual or state assertion |

Contextual and status tones are separate named token families even if provisional values
look similar. Contact green is not confirmed green; rating gold is not caution; navigation
blue is not a status claim. Repeated contexts reuse their named tokens rather than choosing
one-off colors. A future category that is not selectable or complete remains neutral.

Only an actual asserted state may use a status tone. Decorative emphasis, hover, selected
navigation, contact, price, popularity, ratings, identity, and contribution activity are
not status assertions. Color never carries meaning alone, and controlled contextual color
does not authorize coloring every icon.

### Authentic color

Licensed flags, attributed photography, and user-chosen avatars may retain authentic
color. They are content, not tokenized status. They must not be tinted to mimic trust or
domain state.

ADR-017 remains authoritative for Aboki FX flags: use the licensed local SVG sprite,
currency code and name carry accessible meaning, emoji is not the marker system, and
runtime remote flag requests are prohibited. This ADR neither changes the provider-aware
currency model nor authorizes asset implementation.

### IconOrb

`IconOrb` is a circular, borderless contextual icon container with exactly three visual
sizes:

| Size | Use |
|---:|---|
| 28 px | Compact supporting icon |
| 32 px | Standard row or control icon |
| 48 px | Prominent empty state, destination, or feature icon |

The orb has an opaque contextual base, a subtle lighter top and deeper lower gradient,
restrained inner sheen or ambient depth, and soft elevation. It has no decorative
hairline. Its glyph is a redesigned solid, optically balanced shape rendered in
high-contrast ink with restrained depth; a thin outline icon dropped into a colored
circle does not satisfy this contract.

The orb is decorative by default and therefore hidden from accessibility APIs when
adjacent text supplies the name. The label belongs to the containing row, button, link, or
control. Every `IconOrb` has redundant visible text in that containing component; the
containing component's accessible name includes the same meaning. The glyph itself is
never a substitute for text.

An orb is not an interactive target by itself. Any interactive parent is at least
44 × 44 CSS pixels, has a visible focus indication, and exposes its state and accessible
name. The 28 px and 32 px orbs may sit inside that larger parent.

`IconOrb` is not a blanket treatment for pills, cards, inputs, status badges, flags,
photographs, avatars, map markers, or every icon. Flags, photographs, and avatars are
authentic content and are specifically excluded from the orb's gradient, glyph, and
context-token rules. Other components keep their own structure.

### Borders, separators, and surfaces

Primary containment is expressed through spacing, neutral surface contrast, material,
and restrained elevation. `IconOrb` uses dimensional fill and soft elevation but no
decorative hairline. The earlier provisional separator
tokens and guidance to use borders or separators as routine containment are superseded.
Necessary platform focus indicators, forced-colors outlines, data-visualization strokes,
and controls whose affordance would otherwise disappear are accessibility or information
requirements, not decorative borders.

This does not mean every rounded component becomes an orb. Pills, cards, inputs, and
status badges keep their own shapes and semantics, and no blanket color, circle, or
border-removal rewrite is authorized by this ADR.

### Accessibility and motion

- Grayscale must preserve hierarchy, state labels, and control recognition.
- Forced-colors mode may replace authored colors with system colors; meaning, focus,
  selection, and state must remain visible without forced-color suppression.
- Reduced motion removes nonessential icon translation, rotation, bounce, pulse, and
  scale animation. State changes remain immediate and understandable.
- Decorative icons are hidden from accessibility APIs; informative controls expose a
  redundant accessible name.
- Interactive parents meet the 44 × 44 minimum even when the visible orb is smaller.
- Light and dark appearances require contrast verification for icon, orb, text, focus,
  status, rating, and contextual combinations.
- Reused-tab visual refutation is required so cached assets or stale CSS cannot be mistaken
  for the accepted design.

## Superseded provisional guidance

This accepted decision supersedes, without deleting the historical record:

- the provisional green `Accent`/`Accent pressed` values as a universal action or brand
  rule;
- provisional `Separator` tokens as a default containment mechanism;
- any statement that borders or separators should routinely establish card or sheet
  hierarchy; and
- the old neutral-ordinary-controls interpretation of this ADR;
- flat or translucent color discs with generic thin outline glyphs as sufficient
  `IconOrb` execution; and
- any interpretation of contextual iconography as permission for a blanket rainbow,
  one-off colors, or colored disabled/future categories.

The surface hierarchy, status semantics, focus requirements, and ADR-017 authentic flag
rules remain in force.

## Consequences

- Primary product surfaces stay calm while repeated contexts gain controlled color.
- Food warm, Money teal, navigation/location blue, contact/phone green, and rating gold
  become stable mappings rather than per-screen choices.
- Status color remains scarce and separate from contextual color.
- Universal close, search, settings, and disabled/future categories remain neutral.
- Licensed content keeps authentic color without making the interface itself multicolor.
- `IconOrb` requires designed solid glyphs and dimensional opaque treatment rather than a
  token swap around existing outline icons.
- Existing UI may not conform. Acceptance records the target architecture, not runtime
  completion.
- Commit `284a685` remains technically accessible evidence but is visually not accepted.

## Implementation and evidence gates

The implementation lane is separate and currently unclaimed. Before runtime completion
may be asserted, a future exact-path lane must:

1. inventory existing icon, context, status, rating, category, flag, avatar, photograph,
   border, and separator usages;
2. propose and review light, dark, forced-colors, and focus token values without merging
   contextual, rating, and status families;
3. prove licences and attribution for every retained flag or icon asset;
4. implement the opaque gradient, restrained sheen/depth, soft elevation, solid
   optically balanced glyphs, `IconOrb` sizes, decorative behavior, accessible parent
   labels, and 44 × 44 targets without wrapping excluded content;
5. drive grayscale, forced-colors, 200% zoom, keyboard, screen-reader, touch-target, and
   reduced-motion behavior;
6. verify stable Food/Money/location/navigation/contact/rating mappings, neutral universal
   controls and disabled categories, and no decorative status use; and
7. obtain independent light/dark, grayscale, forced-colors, reduced-motion,
   screen-reader, and reused-tab visual/accessibility refutation.

This ADR authorizes no application, asset, token, test, deployment, or design-system
implementation change.

## Alternatives considered

**Green as the universal accent.** Rejected. It competes with confirmation and makes an
ordinary action look evidentiary.

**Keep ordinary destinations and actions neutral.** Rejected by the Founder. It is
technically calm but visually under-articulates stable context.

**Color every category and action independently.** Rejected. It creates a blanket rainbow,
weakens status meaning, and prevents repeated contexts from forming a stable language.

**Make every icon an orb.** Rejected. A useful primitive becomes decorative chrome and
collides with flags, avatars, photographs, pills, cards, inputs, map markers, and badges.

**Use flat discs and existing thin outline glyphs.** Rejected. It changes color without
creating the dimensional, optically balanced icon system the decision requires.

**Monochrome everything, including content.** Rejected. Licensed flags, photography, and
avatars carry authentic information and identity that neutral interface chrome does not.

## References

- [ADR-017: Provider-aware Money & Exchange reference](017-cbn-reference-rate-converter.md)
- [Iconography design-system standard](../design-system/ICONOGRAPHY.md)
- [Service architecture of record](../architecture/SERVICE-ARCHITECTURE.md)
