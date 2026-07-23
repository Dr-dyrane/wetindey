import { useEffect, useMemo, useState } from "../imports/imports";
import { useT } from "@/core/i18n";

/** The shape the view reads: the deleted fork's Copy interface, unchanged. */
interface Copy {
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

/**
 * The visit being asked about.
 *
 * Captured at "Go there" time, while the app still had the offer in hand and a
 * connection to fetch with — NOT on return. Someone walking back from a market
 * is the least likely person in the product to have bars, so nothing here may
 * require a round-trip to ask the question. `getVisitContext` fills this on the
 * way out; the caller stashes it and hands it back on the way in.
 */
export interface VisitContext {
  offerId: string;
  placeId: string;
  placeName: string;
  itemVariantId: string;
  unitId: string;
  itemName: string;
  variantName: string;
  unitName: string;
  /** What WetinDey told the user, in kobo. This is the claim under test. */
  quotedPriceMin: number;
  quotedPriceMax: number | null;
  /** ISO. When the quote above was read out of offers_current. */
  quotedAt: string;
}

const ARMED_KEY = "wetindey.armed_visit.v1";
const MIN_DWELL_MS = 90 * 1000;
const ARM_EXPIRES_MS = 4 * 60 * 60 * 1000;

interface ArmedVisit {
  visit: VisitContext;
  /** Epoch ms at "Go there". */
  armedAt: number;
}

/**
 * Remember that the user went, and what they were told before they left.
 *
 * MUST be called synchronously from the "Go there" tap — the handoff that
 * follows it may unload the page, so anything awaited here never lands. The
 * caller fetches the `VisitContext` when the sheet OPENS, while it still has a
 * connection; see `getVisitContext` in actions.ts.
 */
export function armVisit(visit: VisitContext): void {
  if (typeof window === "undefined") return;
  try {
    const armed: ArmedVisit = { visit, armedAt: Date.now() };
    window.localStorage.setItem(ARMED_KEY, JSON.stringify(armed));
  } catch (err) {
    console.error("ConfirmVisitSheet: could not arm the visit confirmation.", err);
  }
}

export function disarmVisit(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(ARMED_KEY);
}

/**
 * The visit worth asking about right now, if there is one. Consumes it.
 */
export function takeDueVisit(now: number = Date.now()): VisitContext | null {
  if (typeof window === "undefined") return null;

  const raw = window.localStorage.getItem(ARMED_KEY);
  if (!raw) return null;

  let armed: ArmedVisit;
  try {
    armed = JSON.parse(raw) as ArmedVisit;
  } catch {
    console.error("ConfirmVisitSheet: the armed visit was unreadable and has been discarded.");
    disarmVisit();
    return null;
  }

  const v = armed?.visit;
  const intact =
    Number.isFinite(armed?.armedAt) &&
    Boolean(v?.offerId && v?.placeId && v?.itemVariantId && v?.unitId && v?.placeName) &&
    Number.isFinite(v?.quotedPriceMin);
  if (!intact) {
    console.error("ConfirmVisitSheet: the armed visit was incomplete and has been discarded.");
    disarmVisit();
    return null;
  }

  const age = now - armed.armedAt;
  if (age < MIN_DWELL_MS) return null;
  if (age > ARM_EXPIRES_MS) {
    disarmVisit();
    return null;
  }

  disarmVisit();
  return v;
}

export interface UseConfirmVisitSheetOptions {
  open: boolean;
  visit: VisitContext | null;
}

export function useConfirmVisitSheet({ open, visit }: UseConfirmVisitSheetOptions) {
  const translate = useT();

  /* The fork's Copy shape, resolved from the central dictionary. The words are
     verbatim what the fork carried (byte-parity proven before its deletion),
     so the view renders exactly what it always rendered. Memoised on the
     translate identity, which changes exactly when the locale does. */
  const t = useMemo<Copy>(
    () => ({
      title: translate("confirm.title"),
      at: (place: string) => translate("confirm.at", { place }),
      qThere: translate("confirm.q_there"),
      thereYes: translate("confirm.there_yes"),
      thereNo: translate("confirm.there_no"),
      qPrice: (price: string) => translate("confirm.q_price", { price }),
      priceYes: translate("confirm.price_yes"),
      priceNo: translate("confirm.price_no"),
      priceLabel: translate("confirm.price_label"),
      pricePlaceholder: translate("confirm.price_placeholder"),
      qBuy: translate("confirm.q_buy"),
      buyYes: translate("confirm.buy_yes"),
      buyNo: translate("confirm.buy_no"),
    }),
    [translate]
  );

  const [wasThere, setWasThere] = useState<"yes" | "no" | null>(null);
  const [priceRight, setPriceRight] = useState<"yes" | "no" | null>(null);
  const [didBuy, setDidBuy] = useState<"yes" | "no" | null>(null);
  const [realPrice, setRealPrice] = useState("");

  // Reset read-only form when new visit question is asked
  useEffect(() => {
    if (!open) return;
    setWasThere(null);
    setPriceRight(null);
    setDidBuy(null);
    setRealPrice("");
  }, [open, visit?.offerId]);

  const needsPrice = wasThere === "yes" && priceRight === "no";

  return {
    t,
    translate,
    wasThere,
    setWasThere,
    priceRight,
    setPriceRight,
    didBuy,
    setDidBuy,
    realPrice,
    setRealPrice,
    needsPrice,
  };
}
