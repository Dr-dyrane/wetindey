/**
 * Product photography for the seeded items.
 *
 * Sourced from Wikimedia Commons so every file carries a free licence we can
 * honour. CC BY / CC BY-SA oblige attribution wherever the image is shown, so
 * the credit and licence travel with the URL into the database and are
 * rendered next to the photo (see PhotoCredits in ItemCard.tsx).
 *
 * Widths come from the Commons thumbnail API rather than being hand-built:
 * upload.wikimedia.org 400s on widths it will not generate. Every URL below
 * was fetched and confirmed to return image/* before being committed.
 */
export const ITEM_IMAGES: Record<string, {
  url: string;
  attribution: string;
  license: string;
  sourceUrl: string;
}> = {
  "rice": {
    url: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b0/Rice_processing_in_South_East_Nigeria25.jpg/500px-Rice_processing_in_South_East_Nigeria25.jpg",
    attribution: "Chukwukajustice",
    license: "CC BY-SA 4.0",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Rice_processing_in_South_East_Nigeria25.jpg",
  },
  "oloyin-beans": {
    url: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1b/Patterned_cowpea_%2820240714%29.jpg/500px-Patterned_cowpea_%2820240714%29.jpg",
    attribution: "Fumikas Sagisavas",
    license: "CC0",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Patterned_cowpea_(20240714).jpg",
  },
  "white-garri": {
    url: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/11/Gari_processing.jpg/500px-Gari_processing.jpg",
    attribution: "Liberty photography",
    license: "CC BY-SA 4.0",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Gari_processing.jpg",
  },
  "yellow-garri": {
    url: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/05/Garri_garnished_with_onions_and_other_spice.jpg/500px-Garri_garnished_with_onions_and_other_spice.jpg",
    attribution: "Bukky658",
    license: "CC BY-SA 4.0",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Garri_garnished_with_onions_and_other_spice.jpg",
  },
  "yam": {
    url: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a5/Tubers_of_Yam_in_Jalingo_Market.jpg/500px-Tubers_of_Yam_in_Jalingo_Market.jpg",
    attribution: "Yahuzaishat",
    license: "CC BY 4.0",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Tubers_of_Yam_in_Jalingo_Market.jpg",
  },
  "sweet-potato": {
    url: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/38/Ipomoea_batatas_-_Tubers.jpg/500px-Ipomoea_batatas_-_Tubers.jpg",
    attribution: "Filo gèn'",
    license: "CC BY-SA 4.0",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Ipomoea_batatas_-_Tubers.jpg",
  },
  "plantain": {
    url: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a5/Plantain_Bunches.jpg/500px-Plantain_Bunches.jpg",
    attribution: "BishopNana",
    license: "CC BY 4.0",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Plantain_Bunches.jpg",
  },
  "tomatoes": {
    url: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4b/Fresh_tomatoes_stacked_at_market_stall.jpg/500px-Fresh_tomatoes_stacked_at_market_stall.jpg",
    attribution: "TopmanJnr1",
    license: "CC BY-SA 4.0",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Fresh_tomatoes_stacked_at_market_stall.jpg",
  },
  "onions": {
    url: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/12/Pile_of_Onions_at_Barkin_Dogo_Market%2C_Kaduna_North_01.jpg/500px-Pile_of_Onions_at_Barkin_Dogo_Market%2C_Kaduna_North_01.jpg",
    attribution: "Samsule2",
    license: "CC BY-SA 4.0",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Pile_of_Onions_at_Barkin_Dogo_Market,_Kaduna_North_01.jpg",
  },
  "palm-oil": {
    url: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/Epo_%28red_palm_oil%29.jpg/500px-Epo_%28red_palm_oil%29.jpg",
    attribution: "6th.quan",
    license: "CC BY-SA 4.0",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Epo_(red_palm_oil).jpg",
  },
  "groundnut-oil": {
    url: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b9/Groundnut_oils_inside_galloons.jpg/500px-Groundnut_oils_inside_galloons.jpg",
    attribution: "MOIBARDE",
    license: "CC BY-SA 4.0",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Groundnut_oils_inside_galloons.jpg",
  },
};
