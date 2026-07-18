import { ogCard, nairaPlain, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/og";
import { itemPriceSummary } from "@/lib/seo";
import { getItemBySlug, getItemOffers } from "@/lib/seo-queries";

/**
 * The share card for an item, generated from its own row so a WhatsApp or
 * iMessage link shows the food and a price, not a bare URL. Without this file the
 * route has no OG image at all (the root card is not inherited).
 *
 * No `runtime = "edge"`: this reads the database through `pg`, which is Node
 * only, and next/og renders fine on the Node runtime. Price is the min within
 * the modal unit via the shared `itemPriceSummary`, so the card and the page
 * agree, and "From NGN X" is honest for a starting price where a range would not
 * fit a pill.
 */
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = "A WetinDey food item information card";
export const revalidate = 3600;

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const item = await getItemBySlug(slug);
  if (!item) return ogCard({ eyebrow: "WetinDey", title: "Food prices in Lagos" });

  const result = await getItemOffers(item.id);
  const summary =
    result.kind === "observed" ? itemPriceSummary(result.offers) : null;
  if (!summary) {
    return ogCard({
      eyebrow: "WetinDey",
      title: item.name,
      subtitle: "Food catalog information in Lagos",
    });
  }

  return ogCard({
    eyebrow: "WetinDey",
    title: `${item.name} price in Lagos`,
    pill: `Observed from ${nairaPlain(summary.minKobo)} / ${summary.unit}`,
  });
}
