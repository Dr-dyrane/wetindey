"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, CloudOff } from "lucide-react";
import { ModalSheet } from "@/design-system/components/ModalSheet";
import { Button } from "@/design-system/components/Button";
import { Input } from "@/design-system/components/Input";
import { submitVisitConfirmation } from "@/app/actions";
import { haptics } from "@/lib/haptics";
import { formatNaira } from "@/lib/money";

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
  /**
   * Fired once the answer is safely somewhere — on the server, or in the
   * offline queue. `queued` says which, so the caller knows whether refreshing
   * offers would show anything new.
   */
  onConfirmed?: (result: { queued: boolean }) => void;
  lang?: Lang;
}

/* ── Offline queue ────────────────────────────────────────────────────────────

   Separate from `pending_observations` on purpose: that queue's entries are
   price reports and its replay path (in page.tsx) calls submitObservation
   directly. A visit confirmation carries answers that queue cannot express.  */

const QUEUE_KEY = "pending_visit_confirmations";

/**
 * How long a queued confirmation stays worth sending.
 *
 * `submitObservation` timestamps every observation with the moment it runs, so
 * a confirmation replayed after a long offline stretch would be recorded as if
 * the user were standing in the market right now. Freshness is the product's
 * central claim; inflating it is worse than losing one datum. So an entry that
 * has aged past this window is dropped rather than replayed as fresh.
 *
 * Thirty minutes is chosen to sit below the resolution anyone reads — "confirmed
 * 18 minutes ago" is the same answer whether the error is zero or twenty. It is
 * a workaround, not a design: see the note in the department blockers about
 * giving submitObservation a real `observedAt`.
 */
const STALE_AFTER_MS = 30 * 60 * 1000;

/** A poisoned entry — one the server will reject every time — must not retry forever. */
const MAX_ATTEMPTS = 3;

type VisitAnswerPayload = {
  placeId: string;
  itemVariantId: string;
  unitId: string;
  wasAvailable: boolean;
  priceWasRight?: boolean;
  actualPrice?: number;
  didBuy?: boolean;
};

type QueuedConfirmation = VisitAnswerPayload & {
  queuedAt: string;
  attempts: number;
};

function readQueue(): QueuedConfirmation[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(QUEUE_KEY);
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as QueuedConfirmation[]) : [];
  } catch {
    // A corrupt queue is unrecoverable and silently retrying it would spin
    // forever. Drop it and say so, rather than pretend it was never there.
    console.error("ConfirmVisitSheet: pending confirmations were unreadable and have been discarded.");
    window.localStorage.removeItem(QUEUE_KEY);
    return [];
  }
}

function writeQueue(queue: QueuedConfirmation[]) {
  if (queue.length === 0) window.localStorage.removeItem(QUEUE_KEY);
  else window.localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

function enqueue(payload: VisitAnswerPayload) {
  const queue = readQueue();
  queue.push({ ...payload, queuedAt: new Date().toISOString(), attempts: 0 });
  writeQueue(queue);
}

/**
 * Replay whatever was answered offline.
 *
 * Wire this to the `online` event and to mount, next to the existing
 * `pending_observations` sync. Returns what happened so the caller can decide
 * whether to refetch offers.
 */
export async function flushPendingVisitConfirmations(): Promise<{ sent: number; dropped: number }> {
  if (typeof window === "undefined" || !navigator.onLine) return { sent: 0, dropped: 0 };

  const queue = readQueue();
  if (queue.length === 0) return { sent: 0, dropped: 0 };

  const now = Date.now();
  const keep: QueuedConfirmation[] = [];
  let sent = 0;
  let dropped = 0;

  for (const entry of queue) {
    const age = now - new Date(entry.queuedAt).getTime();
    if (!Number.isFinite(age) || age > STALE_AFTER_MS) {
      dropped++;
      continue;
    }

    try {
      const { queuedAt: _q, attempts: _a, ...payload } = entry;
      await submitVisitConfirmation(payload);
      sent++;
    } catch (err) {
      console.error("ConfirmVisitSheet: replaying a queued confirmation failed.", err);
      const attempts = entry.attempts + 1;
      if (attempts >= MAX_ATTEMPTS) dropped++;
      else keep.push({ ...entry, attempts });
    }
  }

  writeQueue(keep);
  return { sent, dropped };
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
  send: string;
  sending: string;
  thanks: string;
  queued: string;
  failed: string;
  retry: string;
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
    send: "Send",
    sending: "Sending…",
    thanks: "Thank you. The next person gets a better answer.",
    queued: "Saved. We'll send it when you're back online.",
    failed: "That didn't send. Try again.",
    retry: "Try again",
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
    send: "Send am",
    sending: "Dey send…",
    thanks: "Thank you! You don help the next person.",
    queued: "Network bad. We save am, we go send later.",
    failed: "E no send. Try again.",
    retry: "Try again",
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
    send: "Firanṣẹ́",
    sending: "Ń firanṣẹ́…",
    thanks: "A dúpẹ́. Ẹni tó bá tẹ̀lé e yóò rí ìdáhùn tó dára.",
    queued: "A ti fipamọ́. A ó firanṣẹ́ nígbà tí netiwọọki bá dé.",
    failed: "Kò lọ. Gbìyànjú lẹ́ẹ̀kansí.",
    retry: "Gbìyànjú lẹ́ẹ̀kansí",
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

type Phase = "asking" | "sending" | "done" | "queued" | "failed";

/**
 * The loop that closes.
 *
 * Everything before this is a price lookup. This is the part that asks the one
 * person who actually knows — the one who went — whether the answer we gave was
 * true, and feeds it back so the next lookup is better.
 *
 * Three questions, one tap each. The common path (it was there, the price was
 * right, I bought it) is three taps and submits itself; "it wasn't there" is one
 * tap and submits itself, because the other two questions stop meaning anything
 * the moment the answer is no. Only the price-correction path asks for a fourth
 * interaction, and only that path shows a Send button — auto-submitting while
 * someone is halfway through typing "3500" would file "₦35".
 */
export function ConfirmVisitSheet({ open, visit, onClose, onConfirmed, lang = "en" }: ConfirmVisitSheetProps) {
  const t = COPY[lang];

  const [wasThere, setWasThere] = useState<"yes" | "no" | null>(null);
  const [priceRight, setPriceRight] = useState<"yes" | "no" | null>(null);
  const [didBuy, setDidBuy] = useState<"yes" | "no" | null>(null);
  const [realPrice, setRealPrice] = useState("");
  const [phase, setPhase] = useState<Phase>("asking");
  const [errorMsg, setErrorMsg] = useState("");

  /** Guards the auto-submit effect against firing twice for one answer set. */
  const sentRef = useRef(false);

  // A new visit is a new question. Reset everything, including the guard, or
  // the second market of the day silently inherits the first one's answers.
  useEffect(() => {
    if (!open) return;
    sentRef.current = false;
    setWasThere(null);
    setPriceRight(null);
    setDidBuy(null);
    setRealPrice("");
    setPhase("asking");
    setErrorMsg("");
  }, [open, visit?.offerId]);

  const priceNum = Number.parseFloat(realPrice);
  const priceValid = Number.isFinite(priceNum) && priceNum > 0;
  const needsPrice = wasThere === "yes" && priceRight === "no";

  const complete =
    wasThere === "no" ||
    (wasThere === "yes" && priceRight !== null && didBuy !== null && (!needsPrice || priceValid));

  const send = useCallback(async () => {
    if (!visit || sentRef.current) return;

    const payload: VisitAnswerPayload =
      wasThere === "no"
        ? {
            placeId: visit.placeId,
            itemVariantId: visit.itemVariantId,
            unitId: visit.unitId,
            wasAvailable: false,
          }
        : {
            placeId: visit.placeId,
            itemVariantId: visit.itemVariantId,
            unitId: visit.unitId,
            wasAvailable: true,
            priceWasRight: priceRight === "yes",
            ...(priceRight === "no" ? { actualPrice: priceNum } : {}),
            didBuy: didBuy === "yes",
          };

    sentRef.current = true;
    setErrorMsg("");

    // Offline is the expected case, not the exception. Take the answer, say so
    // plainly, and get out of the way — the queue is drained on reconnect.
    if (typeof window !== "undefined" && !navigator.onLine) {
      try {
        enqueue(payload);
        setPhase("queued");
        haptics.success();
        onConfirmed?.({ queued: true });
        return;
      } catch (err) {
        console.error("ConfirmVisitSheet: could not queue the confirmation.", err);
        sentRef.current = false;
        setPhase("failed");
        haptics.error();
        setErrorMsg(t.failed);
        return;
      }
    }

    setPhase("sending");
    try {
      await submitVisitConfirmation(payload);
      setPhase("done");
      haptics.success();
      onConfirmed?.({ queued: false });
    } catch (err) {
      console.error("ConfirmVisitSheet: submitting the confirmation failed.", err);
      // Do not queue this. Being online and rejected means the server had an
      // opinion about the answer, and replaying it later would only collect the
      // same rejection. Show it and let the user decide.
      sentRef.current = false;
      setPhase("failed");
      haptics.error();
      setErrorMsg(t.failed);
    }
  }, [visit, wasThere, priceRight, didBuy, priceNum, onConfirmed, t.failed]);

  // Auto-submit the tap-only paths. Nobody should have to find a button after
  // answering the last question; the answer set itself is the commit.
  useEffect(() => {
    if (phase !== "asking" || !complete || needsPrice) return;
    void send();
  }, [phase, complete, needsPrice, send]);

  // Hand the sheet back once the answer has landed. Short: there is nothing
  // left to read, and the map is what they want to see.
  useEffect(() => {
    if (phase !== "done" && phase !== "queued") return;
    const id = window.setTimeout(onClose, 1400);
    return () => window.clearTimeout(id);
  }, [phase, onClose]);

  if (!visit) return null;

  const busy = phase === "sending" || phase === "done" || phase === "queued";
  const quoted =
    visit.quotedPriceMax && visit.quotedPriceMax > visit.quotedPriceMin
      ? `${formatNaira(visit.quotedPriceMin)}–${formatNaira(visit.quotedPriceMax)}`
      : formatNaira(visit.quotedPriceMin);

  return (
    <ModalSheet open={open} onClose={onClose} title={t.title} size="form">
      <div className="space-y-5 px-4 py-4">
        {phase === "done" && (
          <Banner kind="confirmed" icon={<CheckCircle2 className="h-4 w-4" />}>{t.thanks}</Banner>
        )}
        {phase === "queued" && (
          <Banner kind="caution" icon={<CloudOff className="h-4 w-4" />}>{t.queued}</Banner>
        )}
        {phase === "failed" && errorMsg && (
          <Banner kind="unavailable" icon={<AlertTriangle className="h-4 w-4" />}>{errorMsg}</Banner>
        )}

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
          disabled={busy}
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
              disabled={busy}
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
                  disabled={busy}
                />
              </div>
            )}

            <Choice
              legend={t.qBuy}
              value={didBuy}
              onSelect={setDidBuy}
              disabled={busy}
              options={[
                { id: "yes", label: t.buyYes, kind: "confirmed" },
                { id: "no", label: t.buyNo, kind: "unavailable" },
              ]}
            />
          </div>
        )}

        {/* Only the typed path gets a button, and only once it can succeed. */}
        {needsPrice && phase !== "done" && phase !== "queued" && (
          <Button
            type="button"
            variant="primary"
            size="md"
            className="w-full"
            disabled={!complete || phase === "sending"}
            isLoading={phase === "sending"}
            onClick={() => void send()}
          >
            {phase === "sending" ? t.sending : t.send}
          </Button>
        )}

        {phase === "failed" && !needsPrice && (
          <Button type="button" variant="secondary" size="md" className="w-full" onClick={() => void send()}>
            {t.retry}
          </Button>
        )}
      </div>
    </ModalSheet>
  );
}
