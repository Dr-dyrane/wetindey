"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { TrendingUp } from "lucide-react";
import { ModalSheet } from "@/design-system/components/ModalSheet";
import { AsyncList } from "@/design-system/components/AsyncList";
import { Button } from "@/design-system/components/Button";
import { useT } from "@/core/i18n";
import { formatNaira } from "@/lib/money";
import { getMyReports, type MyReport } from "@/app/_actions/actions";

/**
 * The prices you reported, read back to you.
 *
 * This sheet exists because "My reports" was a dead row — `disabled` over an
 * empty `onClick` — in a sheet whose own comment says rows without a destination
 * are disabled. It now has a destination.
 *
 * IT IS ENABLED SIGNED OUT, AND THAT IS THE DESIGN. ADR-003 makes reading
 * anonymous permanently ("recognition, never a gate"), so signed-out is this
 * product's default state forever, not an edge case. Disabling the row for a
 * signed-out user would reproduce the owner's exact "still muted" complaint for
 * the majority of sessions. A signed-out user has zero reports because no key
 * exists to link an anonymous report to a person — that is an ABSENCE, and the
 * honest way to render an absence is an empty state that explains itself, not a
 * grey row that explains nothing. You open it, you read it, you leave.
 *
 * There is no sign-in flow in here on purpose: ProfileSheet already has one, one
 * layer back, and a second would be two OTP implementations racing one session.
 */
export function MyReportsSheet({
  open,
  onClose,
  signedIn,
  onReportPrice,
}: {
  open: boolean;
  onClose: () => void;
  /**
   * Whether anyone is recognised. Drives WHICH empty state renders, never
   * whether the sheet opens — see the note above.
   *
   * This is a hint for copy only and carries no authority. `getMyReports` reads
   * the session server-side and would return `[]` regardless of what this says,
   * which is what keeps a client-side boolean from being able to claim someone
   * else's reports.
   */
  signedIn: boolean;
  /** Present the report sheet. The empty state's only exit that does anything. */
  onReportPrice: () => void;
}) {
  const t = useT();
  const [reports, setReports] = useState<MyReport[] | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  /**
   * A load the user walked away from must not resurrect a message on a closed
   * sheet, or overwrite a newer answer. Same generation counter LocationSheet
   * uses (:118) and for the same reason.
   */
  const generation = useRef(0);

  const load = useCallback(async () => {
    const g = ++generation.current;
    setLoading(true);
    setError(null);
    try {
      const rows = await getMyReports();
      if (g !== generation.current) return;
      setReports(rows);
    } catch (err) {
      console.error("MyReportsSheet: failed to load reports", err);
      if (g !== generation.current) return;
      setError(t("reports.err_load"));
    } finally {
      if (g === generation.current) setLoading(false);
    }
  }, [t]);

  // Refetch on every present rather than caching: you may have filed a report
  // since you last looked, and a stale list on the screen built to show your
  // reports back to you is the one thing it must not do.
  useEffect(() => {
    if (!open) return;
    void load();
    return () => {
      // exhaustive-deps warns that the ref may have changed by cleanup. That
      // difference IS the mechanism, not a bug — bumping the LIVE counter at
      // dismissal is what makes every request still in flight compare unequal
      // and drop its result. Copying it to a variable, as the rule suggests,
      // would increment a stale number and silently disable the cancellation.
      // Same call, same reasoning, as `LocationSheet`'s open-effect cleanup.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      generation.current++;
    };
  }, [open, load]);

  /**
   * WHICH absence this is. `signedIn` picks the words and nothing else — the
   * fetch runs either way and `getMyReports` answers `[]` for a signed-out
   * caller on its own, server-side. This flag has no authority over the data and
   * must never acquire any: it is a client-side boolean, and a client-side
   * boolean deciding whose reports you see is the shape of a breach.
   *
   * Two states, not one, because they are two different facts. Signed out, we do
   * not know who you are. Signed in and empty, we know you and you have not
   * reported yet. Collapsing them would tell a signed-in user to sign in.
   */
  const empty = signedIn
    ? {
        title: t("reports.empty_title"),
        description: t("reports.empty_body"),
        icon: <TrendingUp className="h-5 w-5" aria-hidden />,
        action: (
          <Button variant="primary" size="sm" className="mt-2" onClick={onReportPrice}>
            {t("report_price")}
          </Button>
        ),
      }
    : {
        title: t("reports.signed_out_title"),
        description: t("reports.signed_out_body"),
        icon: <TrendingUp className="h-5 w-5" aria-hidden />,
      };

  /**
   * NO "showing your latest 100" NOTE, and leaving it out is the same call as
   * leaving out "still stands". `getMyReports` caps at 100 with no pagination,
   * which is real — but the branch that would say so cannot render on this data
   * (it needs 100 reports from a signed-in human; there are zero, and the cap
   * would need a second source of truth on this side of the wire, because a
   * "use server" module may only export async functions and the constant cannot
   * cross). Shipping UI that has never rendered, guarded by a copy of a number
   * that can drift from the one that enforces it, buys nothing today and lies
   * quietly the day it drifts. The cap is documented where it is enforced.
   */
  return (
    <ModalSheet open={open} onClose={onClose} title={t("reports.title")} size="page">
      <div className="px-4 py-3">
        <AsyncList<MyReport>
          items={reports}
          isLoading={loading}
          error={error}
          onRetry={() => void load()}
          /* The session IS the subject. Sign out with rows on screen and they
             belong to someone else — that is a new subject, not a refresh, and
             it must show skeletons rather than one frame of the wrong person's
             reports. */
          subject={signedIn ? "in" : "out"}
          renderItem={(r) => <ReportRow report={r} />}
          keyExtractor={(r) => r.id}
          empty={empty}
          errorState={{ title: t("reports.err_load") }}
        />

        {/* The footnote that stops an empty screen reading as a broken one.
            Signed in only: it explains why the owner's 949 anonymous reports are
            not here, which is not a question a signed-out user is asking. */}
        {signedIn && reports?.length === 0 && !error && (
          <p className="px-4 pt-3 text-caption-1 text-text-secondary">
            {t("reports.empty_footnote")}
          </p>
        )}
      </div>
    </ModalSheet>
  );
}

/**
 * One report: what, where, how much, when.
 *
 * INFORMATIONAL, NOT NAVIGATIONAL — no chevron, no `onClick`. Every other list
 * in this app is navigational, so this is a deliberate exception rather than an
 * oversight: a report is a receipt of something you did, and there is no screen
 * behind it that is about YOUR report. ProfileSheet's Sign out row makes exactly
 * this argument for itself (":649 — neither a category nor a destination"). A
 * chevron here would promise a push that does not exist, which is the same lie
 * as the dead row this sheet replaces. If tapping should fly the map to the
 * place, that is a real feature and it needs a decision, not a guess.
 */
function ReportRow({ report }: { report: MyReport }) {
  const t = useT();
  const sold = report.availabilityState === "unavailable";

  /**
   * Three states, kept separate on purpose — conflating any two of them prints a
   * falsehood:
   *
   * SOLD OUT → "E no dey", and the price is SUPPRESSED. This is the trap this
   * file most needed to avoid. `price_amount` is NOT NULL on all 47 of today's
   * 'unavailable' observations — a live one reads Salt / Bag of Salt / Satellite
   * Town Market, availability 'unavailable', price ₦22,712. The price band
   * already drops sold-out reports (its `actions.ts` query filters to
   * `availabilityState = 'available'`), so the app itself refuses to price them;
   * printing ₦22,712 beside "E no dey" would say the shop both has it and does not.
   *
   * AVAILABLE, WITH A PRICE → the price. The 902 rows of today.
   *
   * AVAILABLE, NO PRICE → neither. `price_amount` is nullable in the schema and
   * `MyReport` admits `null`, so "available but priced at nothing" is a real
   * shape even though the app write path (validation.ts: `priceAmount` is
   * required) never mints it today. It must NOT fall through to "E no dey" — the
   * item is there; we just have no number. Rendering the sold verdict for a
   * missing price is the exact both-has-it-and-doesn't error, inverted.
   */
  const showPrice = report.priceAmount !== null && !sold;

  return (
    /* Its own surface, on the elevated rung — this presents inside a ModalSheet,
       where bare `bg-surface` IS the panel's own colour in dark and the card
       would sink into its background instead of sitting on it. Zero borders:
       material and elevation do the work a hairline used to. */
    <div className="flex items-start justify-between gap-3 squircle-card bg-surface px-4 py-3 shadow-card dark:bg-surface-elevated">
      <div className="min-w-0 flex-1">
        <p className="truncate text-body text-text-primary">{report.variantName}</p>
        {/* Unit is not decoration — a price without its unit can lie. */}
        <p className="truncate text-caption-1 text-text-secondary">
          {report.placeName} · {report.areaName} · {report.unitName}
        </p>
      </div>
      <div className="shrink-0 text-right">
        {showPrice ? (
          <p className="text-body tabular-nums text-text-primary">
            {formatNaira(report.priceAmount as number)}
          </p>
        ) : sold ? (
          <p className="text-body text-status-unavailable">{t("reports.sold_out")}</p>
        ) : null /* available, no price recorded: say nothing, not "E no dey" */}
        {/* An absolute date, not a relative age. This is a receipt of what you
            filed, so the date is the fact; "2 days ago" is a derived staleness
            claim about the OFFER, which is a different subject and not this
            row's to make. It also does not duplicate `formatAge`
            (in `ItemDetailSheet`), which is not exported. */}
        <p className="text-caption-1 tabular-nums text-text-tertiary">
          {formatReportDate(report.observedAt)}
        </p>
      </div>
    </div>
  );
}

/**
 * Hoisted for the same reason as `formatNaira`'s: constructing an Intl formatter
 * is the expensive half, and these rows re-render.
 */
const REPORT_DATE = new Intl.DateTimeFormat("en-NG", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

/** No silent fallback: a timestamp we cannot read is a bug, not a blank. */
function formatReportDate(iso: string): string {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) {
    throw new Error(`MyReportsSheet: unreadable observedAt timestamp ${JSON.stringify(iso)}`);
  }
  return REPORT_DATE.format(ms);
}
