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
 *
 * EVERY IMAGE HERE WAS LOOKED AT. Commons search matches filenames and metadata
 * text, not depicted content, and an earlier pass that trusted it shipped a
 * photo of a basketball player named "Luca Garri" for the item "garri", a flower
 * for "sweet potato", and a Hmong sausage for "onions". So each entry below was
 * chosen by one agent that downloaded and viewed the file, then re-examined by a
 * second that was told to refute it and never saw the first one's reasoning. The
 * doc comment on each entry is the SECOND looker's independent description — if
 * it does not match the item name, the entry is wrong and the photo must go.
 *
 * The white powders (salt, sugar, semolina, wheat meal) and the pepper tray were
 * additionally spot-checked by hand, because they are the ones a plausible
 * filename could most easily get away with.
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
  /** A large round woven raffia tray on a rough wooden trestle table at an open-air West African market, standing on bare reddish earth with loose rocks and scattered litter. The tray holds… */
  "pepper": {
    url: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/eb/Ata_rodo_%28Pepper%29.jpg/500px-Ata_rodo_%28Pepper%29.jpg",
    attribution: "Similitude01",
    license: "CC BY-SA 4.0",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Ata_rodo_(Pepper).jpg",
  },
  /** A close-up, frame-filling photo of a tray stacked with roughly a dozen loaves of soft white bread, each wrapped in clear plastic film. At high magnification the loaves are unmistakable:… */
  "bread": {
    url: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/07/Picture_of_Bread_in_a_tray.jpg/500px-Picture_of_Bread_in_a_tray.jpg",
    attribution: "James Moore200",
    license: "CC BY-SA 4.0",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Picture_of_Bread_in_a_tray.jpg",
  },
  /** A 500x411 studio photo on a plain pale grey-white background showing five compressed cubes, each resting on or partially inside its torn-open silver foil and translucent waxed-paper… */
  "seasoning-cube": {
    url: "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f5/Br%C3%BChw%C3%BCrfel-1.jpg/500px-Br%C3%BChw%C3%BCrfel-1.jpg",
    attribution: "Rainer Z ...",
    license: "CC BY-SA 4.0",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Br%C3%BChw%C3%BCrfel-1.jpg",
  },
  /** Five to six whole raw fish lying on a bed of crushed, melting ice, photographed from above in natural light. Zoomed inspection of the upper region shows dark blue-green backs marked with… */
  "frozen-fish": {
    url: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c2/Frozen_fresh_mackerel.jpg/500px-Frozen_fresh_mackerel.jpg",
    attribution: "Fumikas Sagisavas",
    license: "CC0",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Frozen_fresh_mackerel.jpg",
  },
  /** Close-up photo inside a shop of vertical hanging strips of green sachets. Each sachet is bright green and carries the red Nestlé logo, the white outlined "MILO" wordmark, "ENERGY FOOD… */
  "milo": {
    url: "https://upload.wikimedia.org/wikipedia/commons/thumb/7/7e/Milo_chocolate_powder.jpg/500px-Milo_chocolate_powder.jpg",
    attribution: "Marwan Bello",
    license: "CC BY-SA 4.0",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Milo_chocolate_powder.jpg",
  },
  /** A close-up market photo. Filling the left two-thirds of the frame is a wide, flat woven cane/bamboo tray, tilted toward the camera and held at roughly chest height. It is stacked with… */
  "dried-fish": {
    url: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6f/Smoked_Fish_Seller.jpg/500px-Smoked_Fish_Seller.jpg",
    attribution: "Henry Ojonugwa",
    license: "CC BY-SA 4.0",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Smoked_Fish_Seller.jpg",
  },
  /** An overhead (top-down) photograph of a round bowl with a thin dark/black rim, filling most of the frame, heaped full of fine white crystalline granules. The individual grains are… */
  "sugar": {
    url: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/99/Bowl_of_white_sugar.jpg/500px-Bowl_of_white_sugar.jpg",
    attribution: "Douglas P Perkins",
    license: "CC BY 3.0",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Bowl_of_white_sugar.jpg",
  },
  /** A top-down close-up of a roughly circular mound of very fine, uniform, opaque bright-white granules poured onto a dark brown wood board with strong vertical grain. The pile fills the… */
  "salt": {
    url: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a9/2020-10-08_14_16_54_A_sample_of_Morton_Iodized_Salt_in_the_Franklin_Farm_section_of_Oak_Hill%2C_Fairfax_County%2C_Virginia.jpg/500px-2020-10-08_14_16_54_A_sample_of_Morton_Iodized_Salt_in_the_Franklin_Farm_section_of_Oak_Hill%2C_Fairfax_County%2C_Virginia.jpg",
    attribution: "Famartin",
    license: "CC BY-SA 4.0",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:2020-10-08_14_16_54_A_sample_of_Morton_Iodized_Salt_in_the_Franklin_Farm_section_of_Oak_Hill,_Fairfax_County,_Virginia.jpg",
  },
  /** A large round metal tray on bare dirt ground, heaped with roughly 18-20 knotted clear plastic bags. Each bag holds a dense, moist, smooth lump of paste that sags into a rounded teardrop… */
  "ogi-pap": {
    url: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3d/Ose_Market_-_Akamu_paste.jpg/500px-Ose_Market_-_Akamu_paste.jpg",
    attribution: "Chinelo Okonkwo-Chukwunweike",
    license: "CC BY-SA 4.0",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Ose_Market_-_Akamu_paste.jpg",
  },
  /** A tall stack of plastic egg crates at an open-air market, shot in bright direct sunlight at a steep diagonal. Bottom-left foreground: several large, smooth, matte brown eggs in sharp… */
  "eggs": {
    url: "https://upload.wikimedia.org/wikipedia/commons/thumb/7/7b/Eggs_at_Bakin_Dogo_market_Kaduna_04.jpg/500px-Eggs_at_Bakin_Dogo_market_Kaduna_04.jpg",
    attribution: "Weyham",
    license: "CC BY-SA 4.0",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Eggs_at_Bakin_Dogo_market_Kaduna_04.jpg",
  },
  /** A studio product shot on a plain white/pale-grey background showing two short, wide tin cans with glossy bright-red wraparound labels. The left can is sealed: its gold/brass-coloured top… */
  "tin-tomatoes": {
    url: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c1/Tomato_pur%C3%A9e_in_cans_-_multilingual.jpg/500px-Tomato_pur%C3%A9e_in_cans_-_multilingual.jpg",
    attribution: "Bill Ebbesen",
    license: "CC BY-SA 3.0",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Tomato_pur%C3%A9e_in_cans_-_multilingual.jpg",
  },
  /** A single conical heap of fine, pale cream/yellowish-white granular material on a smooth light-grey studio surface, with loose grains scattered around the base of the pile. At 4x zoom the… */
  "semovita": {
    url: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/27/Semolina_300260.jpg/500px-Semolina_300260.jpg",
    attribution: "Rillke",
    license: "CC BY-SA 3.0 de",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Semolina_300260.jpg",
  },
  /** An open-air market stall with a large heap of raw, unpeeled ginger rhizomes filling the foreground. The rhizomes are big, knobbly, many-fingered palmate "hands" with pale tan-to-cream… */
  "ginger": {
    url: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/86/Fresh_and_big_Ginger_01.jpg/500px-Fresh_and_big_Ginger_01.jpg",
    attribution: "Muktee1494",
    license: "CC BY-SA 4.0",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Fresh_and_big_Ginger_01.jpg",
  },
  /** A wide, shallow round aluminium market tray heaped with a mound of small reddish-brown dried shrimp, shot from slightly above. Zoomed in, the individual animals resolve unambiguously:… */
  "crayfish": {
    url: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/dd/Crayfish_Tray.jpg/500px-Crayfish_Tray.jpg",
    attribution: "BishopNana",
    license: "CC BY 4.0",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Crayfish_Tray.jpg",
  },
  /** A single clear plastic bottle standing on a speckled brown/tan granite countertop in a home kitchen, shot from above at an angle under artificial light. It has a wide white ribbed screw… */
  "vegetable-oil": {
    url: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1d/2022-05-30_21_06_43_A_bottle_of_Wesson_vegetable_oil_in_the_Mountainville_section_of_Ewing_Township%2C_Mercer_County%2C_New_Jersey.jpg/500px-2022-05-30_21_06_43_A_bottle_of_Wesson_vegetable_oil_in_the_Mountainville_section_of_Ewing_Township%2C_Mercer_County%2C_New_Jersey.jpg",
    attribution: "Famartin",
    license: "CC BY-SA 4.0",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:2022-05-30_21_06_43_A_bottle_of_Wesson_vegetable_oil_in_the_Mountainville_section_of_Ewing_Township,_Mercer_County,_New_Jersey.jpg",
  },
  /** A strip of connected single-serve retail sachets resting on cardboard in a dim shop or storeroom. The front sachet is bright yellow with a red oval logo reading "AMA" in blue block… */
  "milk-powder": {
    url: "https://upload.wikimedia.org/wikipedia/commons/thumb/7/75/Ama_Milk_powder.jpg/500px-Ama_Milk_powder.jpg",
    attribution: "Sultan199405",
    license: "CC BY-SA 4.0",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Ama_Milk_powder.jpg",
  },
  /** A whole raw plucked chicken carcass lying in a shallow pale sage-green enamel bowl with a dark navy rim, set on grey square floor tiles. The bird is split/cut open — the ribcage and body… */
  "chicken": {
    url: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9f/Ayam_kampung_free_range_chicken_meat_Indonesia.JPG/500px-Ayam_kampung_free_range_chicken_meat_Indonesia.JPG",
    attribution: "Sakurai Midori",
    license: "CC BY 3.0",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Ayam_kampung_free_range_chicken_meat_Indonesia.JPG",
  },
  /** A large mound of raw red meat piled on a worn wooden butcher's slab at an open-air market. The cuts are deep crimson to bright red with visible muscle fibre and a wet blood sheen,… */
  "beef": {
    url: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d7/Raw_Beef_at_Barkin_Dogo_Market_02.jpg/500px-Raw_Beef_at_Barkin_Dogo_Market_02.jpg",
    attribution: "Samsule2",
    license: "CC BY-SA 4.0",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Raw_Beef_at_Barkin_Dogo_Market_02.jpg",
  },
  /** A large heap of dried seed kernels photographed from above at close range in what is clearly a market-stall setting, filling nearly the whole frame. The kernels are broad-oval to almond… */
  "ogbono": {
    url: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/ed/Ogbono_Seed.jpg/500px-Ogbono_Seed.jpg",
    attribution: "Iwai-Dialax",
    license: "CC BY 4.0",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Ogbono_Seed.jpg",
  },
  /** A white ceramic bowl containing the disassembled contents of a single instant noodle packet. Front and centre is a rectangular block of dried instant noodles — pale yellow, tightly… */
  "noodles": {
    url: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3f/2016_Indomie_Mi_Goreng_Rendang_NL_01.jpg/500px-2016_Indomie_Mi_Goreng_Rendang_NL_01.jpg",
    attribution: "Takeaway",
    license: "CC BY-SA 4.0",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:2016_Indomie_Mi_Goreng_Rendang_NL_01.jpg",
  },
  /** A basket heaped full of dozens of whole, unpeeled garlic bulbs photographed from above. The bulbs are creamy off-white with papery skins and faint pinkish-purple tinting; individual… */
  "garlic": {
    url: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/65/Garlic_bulbs_of_Salem.jpg/500px-Garlic_bulbs_of_Salem.jpg",
    attribution: "Thamizhpparithi Maari",
    license: "CC BY-SA 4.0",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Garlic_bulbs_of_Salem.jpg",
  },
  /** A loose bundle of dry, uncooked long-strand pasta lying on a plain white studio surface. The strands fan out from the left side of the frame with the blunt cut ends pointing toward the… */
  "spaghetti": {
    url: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5b/Spaghetti2.jpg/500px-Spaghetti2.jpg",
    attribution: "Popo le Chien",
    license: "CC0",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Spaghetti2.jpg",
  },
  /** A vertical close-up almost entirely filled by a large heap of flat, broadly oval/teardrop seeds — cream to off-white kernels with slightly darker tan rims and a matte, papery surface. At… */
  "egusi": {
    url: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b6/Egusi_%28Melon_seeds%29.jpg/500px-Egusi_%28Melon_seeds%29.jpg",
    attribution: "Ei'eke",
    license: "CC BY-SA 4.0",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Egusi_(Melon_seeds).jpg",
  },
  /** A single conical heap of dry, coarse-milled flour sitting on a pale off-white plate or dish, shot close-up with a dark blurred background (what looks like a dark jar/bottle at upper… */
  "wheat-meal": {
    url: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/df/Wheat_flour.jpg/500px-Wheat_flour.jpg",
    attribution: "Oliwier Brzezinski",
    license: "CC BY-SA 4.0",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Wheat_flour.jpg",
  },
  /** A close-up of five or six long, stiff, flattened dried fish lying diagonally in a large round woven wicker basket at what looks like a market stall. The fish are pale grey-tan and beige… */
  "stockfish": {
    url: "https://upload.wikimedia.org/wikipedia/commons/thumb/7/7f/Stockfisch.wmt.jpg/500px-Stockfisch.wmt.jpg",
    attribution: "Wolfgang Meinhart, Hamburg",
    license: "CC BY-SA 3.0",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Stockfisch.wmt.jpg",
  },
  /** An opened rectangular gold/brass-coloured metal tin on a dark, worn wooden surface, shot from directly overhead. The lid is rolled and peeled back over the upper half of the tin with its… */
  "sardines": {
    url: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/58/Sardines_in_a_can.jpg/500px-Sardines_in_a_can.jpg",
    attribution: "jules",
    license: "CC BY 2.0",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Sardines_in_a_can.jpg",
  },
  /** A stainless steel bowl filled to the rim with raw, hand-cut chunks of red meat, filling the whole frame (bowl rim visible top-left and along the right edge). The pieces are irregular,… */
  "goat-meat": {
    url: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2d/Goat_Meat_5983.JPG/500px-Goat_Meat_5983.JPG",
    attribution: "Biswarup Ganguly",
    license: "CC BY-SA 3.0",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Goat_Meat_5983.JPG",
  },
};

/**
 * Fail the seed on a key that matches no item, rather than shipping a grey
 * letter where a photograph was meant to be.
 *
 * This exists because four entries were keyed "tomato-paste", "semolina",
 * "powdered-milk" and "instant-noodles" while the seed's items are actually
 * "tin-tomatoes", "semovita", "milk-powder" and "noodles". The photographs were
 * correct and verified; the keys were hand-typed from the item NAMES instead of
 * being taken from the slugs, which were already known. `withImage()` looks up
 * by slug and returns {} on a miss, so all four failed silently and four of the
 * best-priced items on the landing list rendered as monograms — the exact defect
 * this file exists to remove, reintroduced by a typo the type system cannot see.
 *
 * A Record<string, T> cannot express "keys must be item slugs", so the check is
 * a runtime one, called by the seed before it writes anything.
 */
export function assertItemImages(itemSlugs: string[]): void {
  const known = new Set(itemSlugs);
  const orphans = Object.keys(ITEM_IMAGES).filter((k) => !known.has(k));
  if (orphans.length) {
    throw new Error(
      `ITEM_IMAGES has ${orphans.length} key(s) matching no seeded item: ${orphans.join(", ")}.\n` +
      `These photos would never be shown. Fix the key to the item's slug — the ` +
      `slug is the join, the display name is not.`
    );
  }
}
