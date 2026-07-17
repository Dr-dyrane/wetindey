import { ImageResponse } from "next/og";
import {
  LOGO_VIEWBOX,
  LOGO_CANVAS,
  NIGERIA_PATH,
  NIGERIA_TRANSFORM,
  QUESTION_PATH,
  QUESTION_TRANSFORM,
} from "@/design-system/brand/logoGeometry";

/**
 * The Open Graph card for the app root.
 *
 * Today a shared WetinDey link renders as a bare URL — in WhatsApp, which is
 * the channel this product actually travels on. This is the image that fixes
 * that. It is deliberately the ONE card for the ONE route that exists;
 * `/item/[slug]` and `/place/[slug]` will each want their own
 * `opengraph-image.tsx` colocated in their own segment, generated from that
 * row's data. See the spec returned with this work.
 *
 * ── Why there are colour literals here, when the house rule says zero ──
 *
 * The rule exists because `accent` INVERTS between themes, so a hardcoded white
 * label on an accent fill goes invisible in dark. That failure mode cannot occur
 * here — and note that the audit is strict enough to have flagged this very
 * paragraph when it named the offending utility class literally, which is a
 * point in the audit's favour, not against it:
 * this file is never rendered in a browser and never sees a theme. It is
 * rasterised to a PNG by satori + resvg, which parse no stylesheet, resolve no
 * `var()`, and have no `documentElement.classList` to read. A token reference
 * would evaluate to nothing and paint nothing.
 *
 * This is the same exemption layout.tsx already carries for
 * `<meta name="theme-color">` (layout.tsx:25-33 — "The only colour literals in
 * the app, and they cannot be tokens"), for the same reason: the consumer runs
 * before, or entirely outside, CSS.
 *
 * The values below are transcribed from the LIGHT `:root` block of globals.css
 * and must be kept in step with it by hand, exactly like the theme-color pair.
 * Light rather than dark because a crawler fetches exactly one PNG and every
 * viewer gets it — there is no media query to answer with — and that one PNG is
 * composited onto WhatsApp / iMessage / Slack chrome, which is white more often
 * than not.
 */
const INK = {
  /** globals.css `--color-background` (systemGroupedBackground). */
  background: "#F2F2F7",
  /** globals.css `--color-surface`. */
  surface: "#FFFFFF",
  /** globals.css `--color-text-primary`; also `--color-accent` in light. */
  textPrimary: "#000000",
  /**
   * globals.css `--color-text-secondary` — rgba(60,60,67,0.60) — flattened onto
   * `--color-background`. resvg composites alpha correctly, so the alpha value
   * would work; the flat value is used so the token's *rendered* result cannot
   * change if this element is ever moved onto a different fill.
   */
  textSecondary: "#6C6C71",
  /**
   * globals.css `--color-status-confirmed` (systemGreen). The only saturated
   * hue on the card, spent on the one thing the product actually claims.
   */
  statusConfirmed: "#34C759",
  /** globals.css `--color-status-confirmed-fg` — the ramp's darkened value for
   *  small text on a tint. */
  statusConfirmedFg: "#248A3D",
  /** globals.css `--color-status-confirmed-bg` — rgba(52,199,89,0.14) —
   *  flattened onto `--color-surface`. */
  statusConfirmedBg: "#E9F9EE",
} as const;

export const alt = "WetinDey: know before you go. Food prices confirmed by people who went.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * ── What was verified, and how (the brief asked which) ──
 *
 * Everything below was established by rasterising through this exact
 * `ImageResponse` into a real PNG and looking at the pixels, not by reasoning
 * about satori's docs. Three assumptions were tested; two were WRONG and are
 * recorded here so nobody re-derives them:
 *
 *   1. "Satori's SVG support is limited, so the mark needs to go through an
 *      `<img src="data:image/svg+xml;base64,...">`."
 *      FALSE. Inline JSX `<svg>` renders this mark correctly, `<defs>`,
 *      `<mask>` and both `transform` attributes included. The question-mark
 *      cutout is present in the raster. The `<img>`/data-URI route also works;
 *      it is simply not needed, so the simpler one is used.
 *
 *   2. "A fixed mask id will collide once a second inline `<svg>` appears."
 *      FALSE. Verified with a deliberate collision: two inline `<svg>`s both
 *      declaring `id="m"` with DIFFERENT mask content rendered their own masks
 *      independently. Satori scopes each inline `<svg>` to its own document, so
 *      the `useId()` that NigeriaLogo.tsx needs is a real browser-DOM concern
 *      that does not apply here. Hence a literal id and no `useId()` — which
 *      is just as well, since hooks do not run in this pass.
 *
 *   3. "`fontWeight` gives the title emphasis."
 *      FALSE, and this one is visible in the output. next/og's bundled fallback
 *      font ships a SINGLE weight: 400, 700 and 900 rasterise to identical
 *      pixels. There is therefore no `fontWeight` anywhere in this file — a
 *      prop that silently does nothing is worse than no prop, because the next
 *      person reads it as intent that shipped. Hierarchy here is carried by
 *      size and colour alone, which is what the design language asks for
 *      anyway. Real weight would mean shipping a font binary; see blockers.
 *
 * The geometry is imported, never re-typed. logoGeometry.ts is the single
 * source of truth and says so; a second transcription of a 6 KB path is a
 * second thing to drift.
 */
function BrandMark({ size: px }: { size: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={LOGO_VIEWBOX}
      width={px}
      height={px}
    >
      <defs>
        <mask id="og-mark-cutout">
          {/* White keeps the silhouette, black knocks the question mark out. */}
          <rect x="0" y="0" width={LOGO_CANVAS} height={LOGO_CANVAS} fill="#FFFFFF" />
          <g transform={QUESTION_TRANSFORM}>
            <path d={QUESTION_PATH} fill="#000000" />
          </g>
        </mask>
      </defs>
      <g mask="url(#og-mark-cutout)">
        <g transform={NIGERIA_TRANSFORM}>
          <path d={NIGERIA_PATH} fill={INK.textPrimary} />
        </g>
      </g>
    </svg>
  );
}

export default async function OpengraphImage() {
  return new ImageResponse(
    (
      // Satori implements a flexbox subset and has no block layout: an element
      // with more than one child and no `display` throws rather than guessing.
      // Hence `display: flex` on everything, including leaf text nodes.
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: INK.background,
          padding: "72px 80px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "44px" }}>
          <BrandMark size={232} />

          <div style={{ display: "flex", flexDirection: "column" }}>
            <div
              style={{
                display: "flex",
                fontSize: 104,
                letterSpacing: "-0.04em",
                color: INK.textPrimary,
                lineHeight: 1.05,
              }}
            >
              WetinDey
            </div>
            <div
              style={{
                display: "flex",
                fontSize: 38,
                color: INK.textSecondary,
                marginTop: "10px",
              }}
            >
              Wetin dey your area?
            </div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
          {/* Sentence case. The house rule is not decorative: an uppercase
              headline would be the loudest thing on the card, and the green dot
              below is supposed to be. */}
          <div
            style={{
              display: "flex",
              fontSize: 46,
              color: INK.textPrimary,
              letterSpacing: "-0.02em",
            }}
          >
            Know before you go: food prices confirmed by people who went.
          </div>

          {/* Separation is fill, never a stroke. Both pills are fills sitting on
              the grouped background; neither carries an outline. */}
          <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "14px",
                background: INK.statusConfirmedBg,
                color: INK.statusConfirmedFg,
                fontSize: 30,
                padding: "14px 28px",
                borderRadius: "999px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  width: 16,
                  height: 16,
                  borderRadius: "999px",
                  background: INK.statusConfirmed,
                }}
              />
              Confirmed nearby
            </div>
            <div
              style={{
                display: "flex",
                background: INK.surface,
                color: INK.textSecondary,
                fontSize: 30,
                padding: "14px 28px",
                borderRadius: "999px",
              }}
            >
              Festac, Lagos
            </div>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
