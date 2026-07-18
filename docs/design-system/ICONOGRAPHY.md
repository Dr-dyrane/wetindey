# WetinDey iconography

**Authority:** [ADR-018](../adr/018-controlled-semantic-iconography.md)
**Status:** Accepted visual architecture; implementation remains unclaimed and unverified

## Principle

WetinDey uses neutral interface chrome and controlled semantic color. Icons clarify a
destination, action, system control, domain, or asserted state; they do not decorate every
surface. Text remains the primary carrier of meaning.

## Semantic color matrix

| Visual | Default family | Requirements |
|---|---|---|
| Navigation, destinations, ordinary actions, disclosure, system controls | Neutral | No evidence or availability implication |
| Disabled future category | Neutral disabled | Never use a saturated domain or status tone |
| Complete enabled category | Domain | Documented domain token; never alias a status token |
| Actual confirmed state | Status confirmed | Asserted state plus redundant text/icon/shape |
| Actual caution state | Status caution | Asserted uncertainty/staleness plus redundant text/icon/shape |
| Actual unavailable state | Status unavailable | Asserted unavailability plus redundant text/icon/shape |
| Actual informational state | Status info | Asserted neutral information; not generic accent |
| Rating | Rating | Dedicated token; never caution, confirmation, trust, or verification |
| Licensed flag | Authentic content | Local licensed asset, redundant currency text, no remote request |
| Attributed photograph | Authentic content | Preserve attribution and licence |
| User-chosen avatar | Authentic content | Identity media, not verification or status |

Suggested semantic token families are `icon-neutral-*`, `icon-domain-*`,
`status-confirmed-*`, `status-caution-*`, `status-unavailable-*`, `status-info-*`, and
`rating-*`. Exact token names and values are an implementation decision; separate families
must not alias by meaning merely because provisional values match.

## IconOrb contract

`IconOrb` is circular and borderless. Its allowed visual sizes are:

| Token | Diameter | Typical use |
|---|---:|---|
| Compact | 28 px | Supporting metadata or dense row |
| Standard | 32 px | Standard row, destination, or control |
| Prominent | 48 px | Empty state or feature destination |

Rules:

- Decorative by default: hide the glyph/orb from accessibility APIs when adjacent text
  names the action or destination.
- The outer interactive button, link, row, or control—not the orb—is the hit target and
  is at least 44 × 44 CSS pixels.
- The outer control owns its accessible name, selected/expanded/disabled state, focus
  indication, and pressed behavior.
- Every orb has redundant visible text in its containing component; the containing
  component's accessible name includes the same meaning.
- Use neutral fill and glyph tones for ordinary actions. Domain or status tones require
  the corresponding semantic owner.
- Do not add a stroke or hairline border to the orb.

## Where IconOrb does not apply automatically

There is no blanket orb, circle, or color rule for:

- pills and chips;
- cards and sheets;
- inputs and search fields;
- status badges;
- flags;
- photography;
- avatars;
- map markers;
- logos;
- ratings; or
- every inline glyph.

Those components retain their own shape and semantics. A status badge may use status color
only because it asserts a state. A flag may retain authentic color only because ADR-017's
licensing, local-sprite, and accessibility requirements are satisfied.

## Status, domain, and rating separation

Only actual asserted states use:

- `confirmed`;
- `caution`;
- `unavailable`; or
- `info`.

Do not use those token families for ordinary selection, hover, navigation, category
identity, popularity, price, rewards, avatars, or decoration. Domain tokens identify a
complete enabled category and do not make a claim about evidence. Rating uses a dedicated
token and never borrows caution yellow, confirmation green, or trust language.

Future categories remain neutral while disabled. A category receives a domain tone only
with a complete selectable capability and an exact implementation decision.

## Authentic content

Licensed flags, attributed photography, and user-chosen avatars may retain authentic
color. Authentic color is not a trust badge.

For Aboki FX, ADR-017 remains controlling:

- use the licensed bundled SVG flag sprite;
- do not use emoji as currency markers;
- make currency code and name the accessible meaning;
- make no runtime remote flag request; and
- fall back to a neutral local marker when an asset is absent.

Do not recolor a national flag into a status or domain tone. Do not infer nationality,
location, trust, verification, or provider from a flag.

## Accessibility

### Redundant meaning

Color and glyph shape never carry essential meaning alone. Pair asserted state with text,
and give every interactive parent an accessible name. Decorative icons remain hidden from
screen readers to prevent duplicated announcements.

### Grayscale

In grayscale, state labels, selection, hierarchy, and control purpose must remain
distinguishable through text, icon/shape, position, weight, or surface contrast.

### Forced colors

Allow the user agent to apply system colors. Do not use `forced-color-adjust: none` merely
to preserve branding. Focus, selection, disabled state, and asserted status must survive
with system outlines, text, and control semantics. An accessibility-required outline in
forced-colors mode is not a decorative border.

### Reduced motion

When reduced motion is requested, remove nonessential icon bounce, pulse, spin, rotation,
translation, and scale. Loading that needs a changing indication must retain a
non-animated label or system-understandable state. Do not rely on motion to communicate
selection or completion.

### Targets and zoom

Interactive parents are at least 44 × 44 CSS pixels and remain operable at 200% zoom.
Visible focus must not be clipped by the orb or its parent.

## Surfaces and borders

Spacing, neutral surface contrast, material, and restrained elevation establish
hierarchy. Routine separators, hairline borders, and colored outlines do not. Necessary
focus rings, forced-colors outlines, and information-bearing visualization strokes are
allowed because they communicate interaction or data rather than decoration.

This standard does not convert pills, cards, inputs, or status badges into borderless
orbs. Each component keeps the shape and state contract appropriate to its role.

## Verification checklist

A future implementation is not complete until reviewers can answer yes:

- Are ordinary actions and system controls neutral?
- Are disabled future categories neutral?
- Are domain, status, and rating tokens separate?
- Does every status tone correspond to an actual asserted state?
- Are licensed flags local, attributed, non-emoji, and free of remote requests?
- Do photographs and avatars retain authentic color without implying verification?
- Are IconOrbs exactly 28, 32, or 48 px and borderless?
- Does every interactive parent meet 44 × 44 px and own its accessible name?
- Are decorative icons hidden from accessibility APIs?
- Do grayscale and forced-colors preserve meaning and focus?
- Does reduced motion remove nonessential icon animation?
- Did implementation avoid blanket orb/color rewrites of excluded components?
