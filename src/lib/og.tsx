import { ImageResponse } from "next/og";

/**
 * The share card shared by the item and place routes.
 *
 * The root card (`src/app/opengraph-image.tsx`) is NOT inherited by nested
 * routes: a shared item or place link would otherwise render with no image.
 * That file's own comment anticipated this ("each will want their own
 * opengraph-image.tsx generated from that row's data"); this is that renderer,
 * kept in one place so the two routes cannot drift.
 *
 * The satori rules were established the hard way in the root card and are
 * repeated here because they are load-bearing, not stylistic:
 *   · `display: flex` on EVERY element, leaf text included: satori has no block
 *     layout and throws on a multi-child element with no `display`.
 *   · NO `fontWeight`: next/og's bundled fallback font ships a single weight, so
 *     400/700/900 rasterise identically. Hierarchy is size and colour alone.
 *   · ASCII only. The bundled font has no naira glyph, so a "₦" would rasterise
 *     as tofu. Prices are written "NGN 4,500"; `nairaPlain` does the grouping
 *     without Intl, which the edge runtime may lack locale data for.
 *
 * The colours are transcribed from the LIGHT `:root` of globals.css, the same
 * hand-synced copy the root card and the theme-color meta carry, because a
 * rasteriser resolves no `var()`. One PNG is served to every viewer, so light is
 * the right single choice (it composites onto white chat chrome).
 */
const INK = {
  background: "#F2F2F7",
  textPrimary: "#000000",
  textSecondary: "#6C6C71",
  statusConfirmed: "#34C759",
  statusConfirmedFg: "#248A3D",
  statusConfirmedBg: "#E9F9EE",
} as const;

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = "image/png";

/** "4500" kobo -> "NGN 45". Grouping by hand; no Intl, no naira glyph. */
export function nairaPlain(kobo: number): string {
  const naira = Math.round(kobo / 100).toString();
  return `NGN ${naira.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
}

export function ogCard(opts: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  pill?: string;
}) {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: INK.background,
          padding: "76px 84px",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 38, color: INK.textSecondary, letterSpacing: "-0.01em" }}>
            {opts.eyebrow}
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 84,
              color: INK.textPrimary,
              letterSpacing: "-0.03em",
              lineHeight: 1.05,
              marginTop: 20,
            }}
          >
            {opts.title}
          </div>
          {opts.subtitle ? (
            <div style={{ display: "flex", fontSize: 40, color: INK.textSecondary, marginTop: 22 }}>
              {opts.subtitle}
            </div>
          ) : null}
        </div>

        {opts.pill ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              alignSelf: "flex-start",
              background: INK.statusConfirmedBg,
              color: INK.statusConfirmedFg,
              fontSize: 34,
              padding: "16px 32px",
              borderRadius: 999,
            }}
          >
            <div style={{ display: "flex", width: 18, height: 18, borderRadius: 999, background: INK.statusConfirmed }} />
            {opts.pill}
          </div>
        ) : null}
      </div>
    ),
    OG_SIZE,
  );
}
