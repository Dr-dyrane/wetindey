"use client";

import React, { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { ModalSheet } from "@/design-system/components/ModalSheet";
import { Button } from "@/design-system/components/Button";
import { Input } from "@/design-system/components/Input";
import { formatNaira } from "@/lib/money";
import { useT } from "@/core/i18n";

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

type Lang = "en" | "pidgin" | "yoruba";

interface ConfirmVisitSheetProps {
  open: boolean;
  /** Null renders nothing — the sheet is inert without a visit to ask about. */
  visit: VisitContext | null;
  onClose: () => void;
  lang?: Lang;
}

/* ── Arming ───────────────────────────────────────────────────────────────────

   The trigger, per USER-FLOW §5: "returning to the app after tapping 'Go there'
   on a place, within a plausible window".

   It lives here rather than in page.tsx because it is the same concern as the
   queue above — the durable half of the visit loop — and because both halves
   have to agree about what a visit IS. Persisted, not held in React state: "Go
   there" hands off to a maps app, and on Android that is a real navigation. The
   tab may be frozen, evicted or killed outright before the user comes back, so
   an in-memory arm would be gone precisely on the path that always fires it.  */

const ARMED_KEY = "wetindey.armed_visit.v1";

/**
 * Below this, they did not go — they bounced off the maps app and came straight
 * back. Asking "was it there?" about a trip that took forty seconds invites an
 * answer about nothing, and a fabricated confirmation is worse than no
 * confirmation: it is the one thing this whole loop exists to prevent.
 *
 * The arm SURVIVES a too-soon return rather than being spent by it. Looking at
 * the route and setting off two minutes later is the normal case.
 */
const MIN_DWELL_MS = 90 * 1000;

/**
 * Above this, we stop asking. Not because the trip did not happen, but because
 * we can no longer tell whether it did — the arm cannot distinguish "walked
 * there and back" from "tapped Go there, got distracted, closed the tab". Past a
 * few hours the question becomes a memory test, and the answer to a memory test
 * gets written to `observations` as though somebody had just seen it.
 */
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
    // A full or blocked localStorage costs us the question, not the trip.
    console.error("ConfirmVisitSheet: could not arm the visit confirmation.", err);
  }
}

export function disarmVisit(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(ARMED_KEY);
}

/**
 * The visit worth asking about right now, if there is one. Consumes it.
 *
 * "Take" rather than "read" on purpose: a due visit is DISARMED as it is handed
 * out, so the question is asked exactly once. If the user dismisses the sheet
 * without answering, that is an answer — they declined — and re-asking on every
 * subsequent focus would nag them into a tap, which is how you collect noise.
 *
 * Returns null in three different situations, all of them normal: nothing armed,
 * armed too recently to be a visit (left armed — they may still be going), and
 * armed too long ago to ask honestly (disarmed and dropped).
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

  // Shape-check rather than trust: this came off disk, possibly written by an
  // older build. A half-filled context would submit an observation against the
  // wrong variant — the exact plausible-wrong failure `getVisitContext` refuses
  // to produce on the server, so it must not sneak in through the back door.
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

/* ── Copy ─────────────────────────────────────────────────────────────────── */

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

const COPY: Record<Lang, Copy> = {
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

/* ── Pieces ───────────────────────────────────────────────────────────────── */

function Banner({
  kind,
  icon,
  children,
}: {
  kind: "confirmed" | "caution" | "unavailable";
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  const map = {
    confirmed: "bg-status-confirmed-bg text-status-confirmed-fg",
    caution: "bg-status-caution-bg text-status-caution-fg",
    unavailable: "bg-status-unavailable-bg text-status-unavailable-fg",
  } as const;
  return (
    <div
      role="status"
      className={`flex items-center gap-2.5 squircle px-4 py-3 text-footnote font-medium ${map[kind]}
                  animate-in fade-in slide-in-from-top-1 duration-standard`}
    >
      <span className="shrink-0">{icon}</span>
      <span>{children}</span>
    </div>
  );
}

/**
 * One question, two answers, 44pt each.
 *
 * A segmented pair rather than a list: this is asked of someone standing in a
 * market with one hand on their phone, and the whole design constraint is that
 * it be answerable without reading carefully. The status dot carries the sense
 * of each side so a glance is enough; the label carries it for everyone else.
 */
function Choice<T extends string>({
  legend,
  options,
  value,
  onSelect,
  disabled,
}: {
  legend: string;
  options: { id: T; label: string; kind: "confirmed" | "unavailable" }[];
  value: T | null;
  onSelect: (v: T) => void;
  disabled?: boolean;
}) {
  return (
    <fieldset disabled={disabled} className="space-y-2 disabled:opacity-50">
      <legend className="mb-2 text-subhead text-text-secondary">{legend}</legend>
      <div className="grid grid-cols-2 gap-1 squircle bg-fillTertiary p-1">
        {options.map((o) => {
          const active = value === o.id;
          return (
            <button
              key={o.id}
              type="button"
              aria-pressed={active}
              onClick={() => onSelect(o.id)}
              className={`flex min-h-tap items-center justify-center gap-2 squircle px-2 text-subhead font-medium
                          transition duration-micro active:scale-[0.97]
                          ${active ? "bg-surface shadow-card text-text-primary" : "text-text-secondary"}`}
            >
              <span
                className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                  o.kind === "confirmed" ? "bg-status-confirmed" : "bg-status-unavailable"
                } ${active ? "" : "opacity-40"}`}
              />
              <span className="truncate">{o.label}</span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

/* ── The sheet ────────────────────────────────────────────────────────────── */

/**
 * The visit context remains readable during containment, but every answer and
 * send control is disabled. Keeping the sheet reachable explains the pause
 * without collecting, queueing, or transmitting an answer.
 */
export function ConfirmVisitSheet({ open, visit, onClose, lang = "en" }: ConfirmVisitSheetProps) {
  const t = COPY[lang];
  const translate = useT();

  const [wasThere, setWasThere] = useState<"yes" | "no" | null>(null);
  const [priceRight, setPriceRight] = useState<"yes" | "no" | null>(null);
  const [didBuy, setDidBuy] = useState<"yes" | "no" | null>(null);
  const [realPrice, setRealPrice] = useState("");
  // A new visit is a new question. Reset the read-only form so stale answers
  // never appear behind the containment notice.
  useEffect(() => {
    if (!open) return;
    setWasThere(null);
    setPriceRight(null);
    setDidBuy(null);
    setRealPrice("");
  }, [open, visit?.offerId]);

  const needsPrice = wasThere === "yes" && priceRight === "no";

  if (!visit) return null;

  const quoted =
    visit.quotedPriceMax && visit.quotedPriceMax > visit.quotedPriceMin
      ? `${formatNaira(visit.quotedPriceMin)}–${formatNaira(visit.quotedPriceMax)}`
      : formatNaira(visit.quotedPriceMin);

  return (
    <ModalSheet open={open} onClose={onClose} title={t.title} size="form">
      <div className="space-y-5 px-4 py-4">
        <Banner kind="caution" icon={<AlertTriangle className="h-4 w-4" />}>
          <span>
            <span className="block font-semibold">{translate("contribution.paused_title")}</span>
            <span className="mt-0.5 block font-normal">{translate("contribution.paused_body")}</span>
          </span>
        </Banner>

        {/* What is being asked about. Stated once, plainly, so the questions
            below can stay short enough to answer without reading. */}
        <div className="squircle-card bg-surface dark:bg-surface-elevated px-4 py-3">
          <p className="text-body font-semibold text-text-primary">
            {visit.itemName}
            <span className="font-normal text-text-secondary"> · {visit.variantName}</span>
          </p>
          <p className="mt-0.5 text-footnote text-text-secondary">
            {t.at(visit.placeName)} · {quoted} / {visit.unitName}
          </p>
        </div>

        <Choice
          legend={t.qThere}
          value={wasThere}
          onSelect={setWasThere}
          disabled
          options={[
            { id: "yes", label: t.thereYes, kind: "confirmed" },
            { id: "no", label: t.thereNo, kind: "unavailable" },
          ]}
        />

        {/* "No, it wasn't there" ends the conversation: there is no price to be
            right about and nothing to have bought. Asking anyway would be two
            taps of pure friction on the answer we most want people to give. */}
        {wasThere === "yes" && (
          <div className="space-y-5 animate-in fade-in slide-in-from-bottom-1 duration-standard">
            <Choice
              legend={t.qPrice(quoted)}
              value={priceRight}
              onSelect={setPriceRight}
              disabled
              options={[
                { id: "yes", label: t.priceYes, kind: "confirmed" },
                { id: "no", label: t.priceNo, kind: "unavailable" },
              ]}
            />

            {needsPrice && (
              <div className="space-y-1.5 animate-in fade-in duration-standard">
                <label htmlFor="visit-real-price" className="block text-footnote text-text-secondary">
                  {t.priceLabel}
                </label>
                <Input
                  id="visit-real-price"
                  data-autofocus
                  type="number"
                  inputMode="decimal"
                  min={0}
                  value={realPrice}
                  onChange={(e) => setRealPrice(e.target.value)}
                  placeholder={t.pricePlaceholder}
                  disabled
                />
              </div>
            )}

            <Choice
              legend={t.qBuy}
              value={didBuy}
              onSelect={setDidBuy}
              disabled
              options={[
                { id: "yes", label: t.buyYes, kind: "confirmed" },
                { id: "no", label: t.buyNo, kind: "unavailable" },
              ]}
            />
          </div>
        )}

        {/* Retained as a visible affordance only on the typed-price branch;
            containment keeps it non-activatable in every input modality. */}
        {needsPrice && (
          <Button
            type="button"
            variant="primary"
            size="md"
            className="w-full"
            disabled
          >
            {translate("contribution.paused_action")}
          </Button>
        )}
      </div>
    </ModalSheet>
  );
}
