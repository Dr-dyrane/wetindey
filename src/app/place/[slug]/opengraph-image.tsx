import { ogCard, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/og";
import { placeTypeLabel } from "@/lib/seo";
import { getPlaceBySlug, getPlaceOffersForSeo } from "@/lib/seo-queries";

/**
 * The share card for a market, generated from its own row: the name, what it is
 * and where, and how many prices are on it. Same reasoning as the item card:
 * without this file the route has no OG image, and Node runtime because it reads
 * the database.
 */
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = "A WetinDey market information card";
export const revalidate = 3600;

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const place = await getPlaceBySlug(slug);
  if (!place) return ogCard({ eyebrow: "WetinDey", title: "Lagos food markets" });

  const result = await getPlaceOffersForSeo(place.id);
  const where = place.areaName ? `${place.areaName}, Lagos` : "Lagos";
  return ogCard({
    eyebrow: "WetinDey",
    title: place.name,
    subtitle: `${placeTypeLabel(place.placeType)} in ${where}`,
    pill:
      result.kind === "observed"
        ? `${result.offers.length} observed ${
            result.offers.length === 1 ? "listing" : "listings"
          }`
        : undefined,
  });
}
