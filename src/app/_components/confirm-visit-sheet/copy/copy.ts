export type Lang = "en" | "pidgin" | "yoruba";

export interface Copy {
  title: string;
  at: (place: string) => string;
  qThere: string;
  thereYes: string;
  thereNo: string;
  qPrice: (price: string) => string;
  priceYes: string;
  priceNo: string;
  priceLabel: string;
  pricePlaceholder: string;
  qBuy: string;
  buyYes: string;
  buyNo: string;
}

export const COPY: Record<Lang, Copy> = {
  en: {
    title: "How did it go?",
    at: (place) => `At ${place}`,
    qThere: "Was it there?",
    thereYes: "Yes, it was",
    thereNo: "No, it wasn't",
    qPrice: (price) => `Was it ${price}?`,
    priceYes: "Yes, that's it",
    priceNo: "No, it was different",
    priceLabel: "What did it cost?",
    pricePlaceholder: "₦ e.g. 3500",
    qBuy: "Did you buy it?",
    buyYes: "Yes, I bought it",
    buyNo: "No, I didn't",
  },
  pidgin: {
    title: "How e go?",
    at: (place) => `For ${place}`,
    qThere: "E dey there?",
    thereYes: "Yes, e dey",
    thereNo: "No, e no dey",
    qPrice: (price) => `Na ${price} dem sell am?`,
    priceYes: "Yes, na im",
    priceNo: "No, e different",
    priceLabel: "How much dem sell am?",
    pricePlaceholder: "₦ e.g. 3500",
    qBuy: "You buy am?",
    buyYes: "Yes, I buy am",
    buyNo: "No, I no buy",
  },
  yoruba: {
    title: "Báwo ni ó ṣe lọ?",
    at: (place) => `Ní ${place}`,
    qThere: "Ṣé ó wà níbẹ̀?",
    thereYes: "Bẹ́ẹ̀ni, ó wà",
    thereNo: "Rárá, kò sí",
    qPrice: (price) => `Ṣé ${price} ni?`,
    priceYes: "Bẹ́ẹ̀ni, ìyẹn ni",
    priceNo: "Rárá, ó yàtọ̀",
    priceLabel: "Iye tí wọ́n tà á?",
    pricePlaceholder: "₦ bí 3500",
    qBuy: "Ṣé o rà á?",
    buyYes: "Bẹ́ẹ̀ni, mo rà á",
    buyNo: "Rárá, n kò rà á",
  },
};
