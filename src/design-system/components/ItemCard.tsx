"use client";

import React, { useState } from "react";
import Image from "next/image";
import { StatusBadge, type StatusKind } from "./StatusBadge";
import { useT } from "@/core/i18n";

export interface ItemCardData {
  id: string;
  slug: string;
  name: string;
  imageUrl?: string | null;
  imageAttribution?: string | null;
  imageLicense?: string | null;
  offerCount?: number;
  placeCount?: number;
  priceFrom?: number | null;
  priceTo?: number | null;
  freshest?: string | null;
  /** The unit the price range is quoted in. A price without its unit can lie. */
  unitLabel?: string | null;
}

const naira = (kobo: number) =>
  new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(kobo / 100);

const toStatus = (freshness?: string | null): StatusKind =>
  freshness === "confirmed" ? "confirmed" : freshness === "unavailable" ? "unavailable" : "caution";

/**
 * The badge's words now live in the dictionary, not here.
 *
 * They were a hardcoded `Record` — which is why no locale ever reached the
 * most-seen string in the product: three languages shipped and this answered to
 * none of them. `useStatusLabel` reads `item.status_*`, so a Pidgin speaker can
 * be given Pidgin badges without anyone opening a component.
 *
 * WHAT IS NOT CHANGING, because it was right: "E no dey", not "Not dey" —
 * corrected by a native speaker. The app's English voice IS Nigerian English;
 * the search field asks "Wetin you dey find?". So Pidgin sitting in an otherwise
 * English map is the brand, not a leak, and `item.status_unavailable` keeps it
 * in the ENGLISH table on purpose. What was once wrong was the grammar: Pidgin
 * needs the subject — "e no dey" is *it isn't there*, while "not dey" is neither
 * Pidgin nor English, a foreigner's guess that reads worse to a Lagos shopper
 * than plain English would, because it is visibly an outsider imitating them.
 *
 * That is also why Pidgin's `item.status_confirmed` / `_caution` are
 * UNTRANSLATED rather than guessed: English shows through, which is honest,
 * until a native speaker supplies the words.
 *
 * "Otilo" (Yorùbá, roughly *it has gone*) is the other true answer and is better
 * where the item SOLD OUT rather than was never stocked. This map cannot tell
 * those apart — `unavailable` covers both — so it takes the one right in both.
 *
 * `info` stays hardcoded: it is a fallback for a state the product does not
 * currently produce, and inventing a translated string for an unreachable badge
 * is how this repo grows dictionary entries nobody reads.
 */
function useStatusLabel(): Record<StatusKind, string> {
  const t = useT();
  return {
    confirmed: t("item.status_confirmed"),
    caution: t("item.status_caution"),
    unavailable: t("item.status_unavailable"),
    info: "Info",
  };
}

/**
 * Monogram for an item with no photo. Hue is derived from the slug so the same
 * item always gets the same tile; a fallback that reshuffles reads as a glitch.
 * Kept desaturated so it can never be mistaken for a status signal.
 *
 * The hsl() below is computed per-slug, so it cannot come from a token — a
 * token is a fixed value and this is a function of the input. Its ink DOES come
 * from a token (--color-monogram-ink), which is deliberately theme-invariant:
 * the tile is light in both themes, so ink that followed text-primary would go
 * white-on-light in dark mode.
 */
function Monogram({ name, slug }: { name: string; slug: string }) {
  let h = 0;
  for (let i = 0; i < slug.length; i++) h = (h * 31 + slug.charCodeAt(i)) % 360;
  return (
    <div
      className="h-full w-full grid place-items-center"
      style={{ background: `linear-gradient(145deg, hsl(${h} 20% 80%), hsl(${(h + 40) % 360} 18% 68%))` }}
      aria-hidden
    >
      <span className="text-title-2 font-semibold text-monogramInk">{name.slice(0, 1).toUpperCase()}</span>
    </div>
  );
}

/**
 * Item row.
 *
 * The photo bleeds to the card's leading, top and bottom edges rather than
 * sitting in an inset tile — the card clips it instead of framing it, so there
 * is no gap and no stroke between image and surface. Apple publishes no rule
 * for this (I checked: the Images and Collections pages cover only resolution,
 * format and colour), but it matches the App Store / News treatment and it is
 * the only way to get an edge here without drawing one.
 *
 * Nothing in this component has a border. Separation is surface + elevation.
 */
export function ItemCard({ item, onSelect }: { item: ItemCardData; onSelect: (item: ItemCardData) => void }) {
  const statusLabel = useStatusLabel();
  const [broken, setBroken] = useState(false);
  const status = toStatus(item.freshest);
  const showImage = item.imageUrl && !broken;

  const priceLabel =
    item.priceFrom == null
      ? "No price yet"
      : item.priceTo && item.priceTo > item.priceFrom
        ? `${naira(item.priceFrom)} – ${naira(item.priceTo)}`
        : naira(item.priceFrom);

  return (
    <button
      onClick={() => onSelect(item)}
      className="group relative flex w-full items-stretch gap-3 overflow-hidden bg-surface text-left
                 shadow-card squircle
                 active:scale-[0.985] transition-transform duration-instant"
    >
      {/* Bleeds: no padding, no inset, clipped by the card's own squircle. */}
      <div className="relative w-[88px] shrink-0 self-stretch bg-surface-sunken">
        {showImage ? (
          <Image
            src={item.imageUrl!}
            alt=""
            fill
            sizes="88px"
            className="object-cover"
            /**
             * Straight from Wikimedia's CDN, not /_next/image. The optimizer
             * fetches every photo server-side from one IP, which
             * upload.wikimedia.org answers with 429 and no image renders. The
             * stored URLs are already ~50KB thumbnails.
             */
            unoptimized
            onError={() => setBroken(true)}
          />
        ) : (
          <Monogram name={item.name} slug={item.slug} />
        )}
      </div>

      {/**
       * Two tiers, not four.
       *
       * Name and price sit at the SAME level — subhead, semibold — because they
       * answer one question together ("what, and how much"). Setting the price
       * a step larger inverts the hierarchy: the thing you scan for last would
       * shout loudest.
       *
       * Everything under them steps down on all three axes — size, weight and
       * colour — and stops at SECONDARY. No text in this card is tertiary: that
       * tier means "you may ignore this", and nothing left in the row qualifies.
       *
       * No tier-two element has a taller line box than the tier it serves —
       * the ramp is rem-based, so that holds at every Dynamic Type size. Row
       * height is the price's alone and never gains a step from this.
       */}
      <div className="min-w-0 flex-1 py-2 pr-3">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="min-w-0 truncate text-subhead font-semibold text-text-primary">{item.name}</h3>
        </div>
        <p className="truncate text-subhead font-semibold tabular-nums text-text-primary">
          {priceLabel}
          {item.unitLabel && item.priceFrom != null && (
            /* The unit is not decoration. A range spanning a 1L bottle and a 25L
               keg is arithmetically fine and factually nonsense; naming the unit
               is what makes the number mean something. So it drops a size and a
               weight off the price to read as its qualifier rather than its
               peer — but it keeps SECONDARY ink. Tertiary is 30% alpha, under
               3:1 against this card, and a fact the price depends on cannot be
               the one thing in the row you can't read. */
            <span className="ml-1 text-footnote font-normal text-text-secondary"> / {item.unitLabel}</span>
          )}
        </p>
        <div className="mt-1 flex items-center gap-1.5">
          <StatusBadge kind={status}>{statusLabel[status]}</StatusBadge>
          {item.placeCount ? (
            <span className="truncate text-caption-1 text-text-secondary">
              {item.placeCount} {item.placeCount === 1 ? "place" : "places"}
            </span>
          ) : null}
        </div>
      </div>
    </button>
  );
}

/**
 * Photo credit. CC BY / CC BY-SA only hold if the author and licence appear
 * with the image, so this is a licence obligation, not a nicety.
 */
export function PhotoCredits({ items }: { items: ItemCardData[] }) {
  const credits = items.filter((i) => i.imageUrl && i.imageAttribution);
  if (credits.length === 0) return null;
  const unique = Array.from(new Map(credits.map((c) => [c.imageAttribution, c])).values());
  return (
    <p className="px-1 pt-1 text-caption-2 leading-relaxed text-text-tertiary">
      Photos:{" "}
      {unique.map((c, i) => (
        <span key={c.id}>
          {i > 0 && ", "}
          {c.imageAttribution} ({c.imageLicense})
        </span>
      ))}
      {", via Wikimedia Commons"}
    </p>
  );
}
