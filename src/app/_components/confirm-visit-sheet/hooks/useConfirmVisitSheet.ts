import { useEffect, useState, useT } from "../imports/imports";
import { COPY, type Lang } from "../copy/copy";

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
  lang?: Lang;
}

export function useConfirmVisitSheet({
  open,
  visit,
  lang = "en",
}: UseConfirmVisitSheetOptions) {
  const t = COPY[lang];
  const translate = useT();

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
