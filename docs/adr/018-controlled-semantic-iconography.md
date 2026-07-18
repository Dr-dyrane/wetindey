# ADR-018: Controlled semantic iconography

**Date:** 2026-07-18
**Status:** Accepted — visual architecture only; runtime completion unverified
**Decision owner:** WetinDey Founder

## Context

WetinDey needs enough visual character to make categories and actions legible without
turning color into decoration or evidence. Earlier provisional guidance assigned green as
a general accent, named separators as layout tools, and sometimes treated border removal
as a reason to color every icon container. Those rules collide:

- a green ordinary action can look like a confirmed state;
- a yellow category or star can look like caution;
- a disabled future category can look available when it carries a saturated domain tone;
- repeated separators and borders undermine the surface hierarchy;
- and a blanket orb rule adds chrome to pills, cards, inputs, and status badges that
  already have their own semantics.

Flags, photography, and avatars are different. Their color is part of licensed or
user-chosen content, not interface status. ADR-017 already requires a licensed bundled SVG
flag sprite, non-emoji rendering, accessible text, and no remote flag requests. This ADR
preserves that decision.

## Decision

WetinDey adopts controlled semantic iconography.

### Color ownership

Primary surfaces and ordinary interface chrome are monochrome or neutral. Ordinary
destinations, actions, navigation, disclosure controls, inputs, and system controls use
neutral icon and container tones. Color is admitted only by a named semantic owner:

| Owner | Permitted use | Prohibited implication |
|---|---|---|
| Authentic content | Licensed flags, attributed photography, and user-chosen avatars may retain authentic color | Trust, availability, verification, ranking, or endorsement |
| Domain | A complete enabled domain may own a documented domain tone for category recognition | Confirmed, caution, unavailable, information, or rating |
| Status | `confirmed`, `caution`, `unavailable`, and `info` tones apply only when the interface asserts that actual state | Brand accent, category identity, ordinary action, decoration, or disabled availability |
| Rating | Rating uses its own semantic token | Caution, confirmation, trust, verification, or domain identity |
| Neutral | Ordinary destinations, actions, navigation, system controls, and disabled future categories | No state assertion |

Domain tones and status tones are separate token families even when provisional color
values happen to resemble one another. A future category that is not selectable or does
not have a complete capability remains neutral; saturation cannot advertise an
unavailable future.

Only an actual asserted state may use a status tone. Decorative emphasis, hover, selected
navigation, price, popularity, ratings, identity, and contribution activity are not
status assertions. Every state also has redundant text, shape, icon, or position so color
never carries meaning alone.

### Authentic color

Licensed flags, attributed photography, and user-chosen avatars may retain authentic
color. They are content, not tokenized status. They must not be tinted to mimic trust or
domain state.

ADR-017 remains authoritative for Aboki FX flags: use the licensed local SVG sprite,
currency code and name carry accessible meaning, emoji is not the marker system, and
runtime remote flag requests are prohibited. This ADR neither changes the provider-aware
currency model nor authorizes asset implementation.

### IconOrb

`IconOrb` is a circular, borderless, neutral-or-semantic icon container with exactly three
visual sizes:

| Size | Use |
|---:|---|
| 28 px | Compact supporting icon |
| 32 px | Standard row or control icon |
| 48 px | Prominent empty state, destination, or feature icon |

The orb is decorative by default and therefore hidden from accessibility APIs when
adjacent text supplies the name. The label belongs to the containing row, button, link, or
control. Every `IconOrb` has redundant visible text in that containing component; the
containing component's accessible name includes the same meaning. The glyph itself is
never a substitute for text.

An orb is not an interactive target by itself. Any interactive parent is at least
44 × 44 CSS pixels, has a visible focus indication, and exposes its state and accessible
name. The 28 px and 32 px orbs may sit inside that larger parent.

`IconOrb` is not a blanket treatment for pills, cards, inputs, status badges, flags,
photographs, avatars, map markers, or every icon. Those components keep their own
structure. A status badge may use a status token because it asserts a state, not because
it contains an icon.

### Borders, separators, and surfaces

Primary containment is expressed through spacing, neutral surface contrast, material,
and restrained elevation. `IconOrb` is borderless. The earlier provisional separator
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
  status, rating, and domain combinations.

## Superseded provisional guidance

This accepted decision supersedes, without deleting the historical record:

- the provisional green `Accent`/`Accent pressed` values as a universal action or brand
  rule;
- provisional `Separator` tokens as a default containment mechanism;
- any statement that borders or separators should routinely establish card or sheet
  hierarchy; and
- any interpretation of “colorful iconography” as permission to color every ordinary
  action, future category, or container.

The surface hierarchy, status semantics, focus requirements, and ADR-017 authentic flag
rules remain in force.

## Consequences

- Primary product surfaces stay calm and neutral.
- Status color becomes scarcer and therefore more trustworthy.
- Domain recognition can evolve without borrowing evidence semantics.
- Rating cannot accidentally read as caution or confirmation.
- Licensed content keeps authentic color without making the interface itself multicolor.
- `IconOrb` provides a repeatable icon container without becoming a universal component
  wrapper.
- Existing UI may not conform. Acceptance records the target architecture, not runtime
  completion.

## Implementation and evidence gates

The implementation lane is separate and currently unclaimed. Before runtime completion
may be asserted, a future exact-path lane must:

1. inventory existing icon, status, rating, category, flag, avatar, photograph, border,
   and separator usages;
2. propose and review light, dark, forced-colors, and focus token values without merging
   domain, rating, and status families;
3. prove licences and attribution for every retained flag or icon asset;
4. implement `IconOrb` sizes, decorative behavior, accessible parent labels, and
   44 × 44 targets without wrapping excluded component families;
5. drive grayscale, forced-colors, 200% zoom, keyboard, screen-reader, touch-target, and
   reduced-motion behavior;
6. verify disabled future categories stay neutral and actual status tones are not used
   decoratively; and
7. obtain an independent visual and accessibility refutation.

This ADR authorizes no application, asset, token, test, deployment, or design-system
implementation change.

## Alternatives considered

**Green as the universal accent.** Rejected. It competes with confirmation and makes an
ordinary action look evidentiary.

**Color every category and action.** Rejected. It creates noise, weakens status meaning,
and advertises disabled future categories as live.

**Make every icon an orb.** Rejected. A useful primitive becomes decorative chrome and
collides with flags, avatars, photographs, pills, cards, inputs, map markers, and badges.

**Monochrome everything, including content.** Rejected. Licensed flags, photography, and
avatars carry authentic information and identity that neutral interface chrome does not.

## References

- [ADR-017: Provider-aware Money & Exchange reference](017-cbn-reference-rate-converter.md)
- [Iconography design-system standard](../design-system/ICONOGRAPHY.md)
- [Service architecture of record](../architecture/SERVICE-ARCHITECTURE.md)
