"use client";

import React, { useState } from "react";
import Image from "next/image";
import { ChevronRight } from "lucide-react";
import { StatusBadge, type StatusKind } from "./StatusBadge";

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
}

const naira = (kobo: number) =>
  new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(kobo / 100);

/** Freshness values are already the status vocabulary; keep the mapping honest. */
const toStatus = (freshness?: string | null): StatusKind =>
  freshness === "confirmed" ? "confirmed" : freshness === "unavailable" ? "unavailable" : "caution";

const STATUS_LABEL: Record<StatusKind, string> = {
  confirmed: "Confirmed",
  caution: "Check again",
  unavailable: "Not dey",
  info: "Info",
};

/**
 * Monogram fallback for an item with no photo.
 *
 * Derives a stable hue from the slug so the same item always gets the same
 * tile — a fallback that reshuffles on every render reads as a glitch. This is
 * the one place a non-semantic colour is allowed, and it stays desaturated so
 * it can't be mistaken for a status signal.
 */
function Monogram({ name, slug }: { name: string; slug: string }) {
  let h = 0;
  for (let i = 0; i < slug.length; i++) h = (h * 31 + slug.charCodeAt(i)) % 360;
  return (
    <div
      className="h-full w-full grid place-items-center"
      style={{ background: `linear-gradient(145deg, hsl(${h} 22% 78%), hsl(${(h + 40) % 360} 20% 66%))` }}
      aria-hidden
    >
      <span className="text-[22px] font-bold text-black/45">{name.slice(0, 1).toUpperCase()}</span>
    </div>
  );
}

export function ItemCard({ item, onSelect }: { item: ItemCardData; onSelect: (item: ItemCardData) => void }) {
  const [broken, setBroken] = useState(false);
  const status = toStatus(item.freshest);
  const showImage = item.imageUrl && !broken;

  const priceLabel =
    item.priceFrom == null
      ? "No price yet"
      : item.priceTo && item.priceTo > item.priceFrom
        ? `${naira(item.priceFrom)} – ${naira(item.priceTo)}`
        : `${naira(item.priceFrom)}`;

  return (
    <button
      onClick={() => onSelect(item)}
      className="group w-full flex items-center gap-3 p-2.5 rounded-card text-left
                 bg-surface shadow-card ring-1 ring-inset ring-separator
                 active:scale-[0.985] transition-transform duration-instant"
    >
      <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-[12px] bg-surface-sunken">
        {showImage ? (
          <Image
            src={item.imageUrl!}
            alt=""
            fill
            sizes="64px"
            className="object-cover"
            /**
             * Served straight from Wikimedia's CDN rather than through
             * /_next/image. Routing these through the optimizer makes the
             * server fetch every photo from one IP on first render, which
             * upload.wikimedia.org answers with 429 Too Many Requests — the
             * images then fail to appear at all. Letting the browser request
             * them is ordinary hotlinking: one request per client, served by
             * a CDN built for it. The stored URLs are already ~50KB thumbnails,
             * so there is little left for the optimizer to save.
             */
            unoptimized
            onError={() => setBroken(true)}
          />
        ) : (
          <Monogram name={item.name} slug={item.slug} />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <h3 className="text-[15px] font-semibold text-text-primary truncate">{item.name}</h3>

        <p className="mt-0.5 text-[15px] font-semibold text-text-primary tabular-nums truncate">{priceLabel}</p>

        <div className="mt-1.5 flex items-center gap-2">
          <StatusBadge kind={status}>{STATUS_LABEL[status]}</StatusBadge>
          {item.placeCount ? (
            <span className="text-[12px] text-text-secondary truncate">
              {item.placeCount} {item.placeCount === 1 ? "place" : "places"}
            </span>
          ) : null}
        </div>
      </div>

      <ChevronRight className="h-4 w-4 shrink-0 text-text-tertiary" strokeWidth={2.5} />
    </button>
  );
}

/**
 * Photo credit. CC BY / CC BY-SA are only honoured if the author and licence
 * actually appear next to the image, so this is a licence obligation rather
 * than a nicety — it ships wherever the photography does.
 */
export function PhotoCredits({ items }: { items: ItemCardData[] }) {
  const credits = items.filter((i) => i.imageUrl && i.imageAttribution);
  if (credits.length === 0) return null;
  const unique = Array.from(new Map(credits.map((c) => [c.imageAttribution, c])).values());
  return (
    <p className="px-1 pt-1 text-[10px] leading-relaxed text-text-tertiary">
      Photos:{" "}
      {unique.map((c, i) => (
        <span key={c.id}>
          {i > 0 && ", "}
          {c.imageAttribution} ({c.imageLicense})
        </span>
      ))}
      {" — via Wikimedia Commons"}
    </p>
  );
}
