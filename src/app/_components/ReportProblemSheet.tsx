"use client";

import React, { useState } from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { ModalSheet } from "@/design-system/components/ModalSheet";
import { SheetPicker } from "@/design-system/components/SheetPicker";
import { Button } from "@/design-system/components/Button";
import { useT, useLocaleControl } from "@/core/i18n";
import { submitProblemReport } from "@/app/actions";

/** The four problem kinds, in the order the picker shows them. Each id is the
 *  exact enum value `submitProblemReportInput` (src/lib/validation.ts) admits, so
 *  the control cannot mint a kind the write path would reject. */
const KIND_KEYS = [
  { id: "price_wrong", labelKey: "problem.kind_price" },
  { id: "place_wrong", labelKey: "problem.kind_place" },
  { id: "app_bug", labelKey: "problem.kind_bug" },
  { id: "other", labelKey: "problem.kind_other" },
] as const;

type Kind = (typeof KIND_KEYS)[number]["id"];

/**
 * "Report a problem", the whole sheet. Opened from the Profile row that spent its
 * life `disabled` over a no-op `onClick`; this is its destination.
 *
 * COLD ONLY, on purpose. It is presented from Profile, where no offer is on
 * screen, so it captures no `placeId`/`itemVariantId`/`unitId` — the report is a
 * free-text "something is wrong", not a report ABOUT a specific offer. The DB
 * columns for that context exist (nullable, forward-looking); a warm entry point
 * inside a detail sheet is a separate change that would pass them in here.
 *
 * NOT GATED ON THE SESSION. ADR-003: auth is recognition, never a gate. Anyone
 * can file, signed in or out; `submitProblemReport` resolves attribution
 * server-side and files anonymously when there is no session. This sheet never
 * mentions signing in.
 *
 * THE CONFIRMATION PROMISES NOTHING IT CANNOT KEEP. There is no reply channel —
 * no email-back, no ticket, no status the user can later check — because none
 * exists in this product. So the success copy says only what is true: it was
 * received, and the people who run WetinDey read these. It does NOT say "we'll
 * get back to you".
 */
export function ReportProblemSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT();
  const [locale] = useLocaleControl();

  const [kind, setKind] = useState<Kind | "">("");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const reset = () => {
    setKind("");
    setBody("");
    setSubmitting(false);
    setError("");
    setSuccess(false);
  };

  // Dismissal — backdrop, Escape and the close control all route here — resets,
  // so reopening the sheet starts blank rather than showing a stale confirmation
  // or a half-typed report from last time.
  const dismiss = () => {
    reset();
    onClose();
  };

  const canSend = kind !== "" && body.trim().length > 0 && !submitting;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSend) return;
    setSubmitting(true);
    setError("");
    try {
      await submitProblemReport({ kind: kind as Kind, body: body.trim(), appLocale: locale });
      setSuccess(true);
    } catch (err) {
      // The message is redacted to a digest in production and could carry the
      // rejected payload back in dev, so we never surface it — a fixed, honest
      // line instead, in the app's Nigerian-English register.
      console.error("ReportProblemSheet: submit failed", err);
      setError(t("problem.err_send"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalSheet open={open} onClose={dismiss} title={t("problem.title")} size="form">
      {success ? (
        /* The whole point of the sheet, once it has done its job: a receipt that
           claims nothing beyond receipt. Its own surface on the elevated rung,
           because this presents inside a ModalSheet where bare bg-surface IS the
           panel colour in dark. */
        <div className="flex flex-col items-center gap-3 px-6 py-8 text-center">
          <span className="grid h-12 w-12 place-items-center squircle bg-status-confirmed-bg text-status-confirmed-fg">
            <CheckCircle2 className="h-6 w-6" />
          </span>
          <h3 className="text-headline text-text-primary">{t("problem.success_title")}</h3>
          <p className="max-w-xs text-body text-text-secondary">{t("problem.success_body")}</p>
          <Button variant="primary" size="md" className="mt-2 w-full" onClick={dismiss}>
            {t("done")}
          </Button>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-5 py-4">
          {error && (
            <div
              role="status"
              className="mx-4 flex items-center gap-2.5 squircle-card bg-status-unavailable-bg px-4 py-3 text-[13px] font-medium text-status-unavailable-fg animate-in fade-in slide-in-from-top-1 duration-standard"
            >
              <span className="shrink-0">
                <AlertTriangle className="h-4 w-4" />
              </span>
              <span>{error}</span>
            </div>
          )}

          <div className="mx-4 space-y-4">
            {/* A sheet, not a dropdown (HIG). Four kinds so the owner can separate
                "your data is wrong" from "the app is broken" without reading the
                prose underneath. */}
            <SheetPicker
              title={t("problem.kind_label")}
              label={t("problem.kind_label")}
              options={KIND_KEYS.map((k) => ({ id: k.id, label: t(k.labelKey) }))}
              value={kind}
              onSelect={(v) => setKind(v as Kind)}
              placeholder={t("problem.kind_placeholder")}
            />

            <div className="space-y-1.5">
              <label htmlFor="problem-body" className="block text-footnote text-text-secondary">
                {t("problem.body_label")}
              </label>
              {/* No Textarea component exists; this mirrors Input.tsx's token set
                  exactly — zero borders, fill for the resting state, focus:bg-surface
                  as the lift. The 1000-char cap is enforced server-side by zod;
                  maxLength here is a courtesy to the typist, not the guard. */}
              <textarea
                id="problem-body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                maxLength={1000}
                rows={4}
                placeholder={t("problem.body_placeholder")}
                className="w-full resize-none bg-fillTertiary text-text-primary squircle text-body px-4 py-3 transition-colors duration-micro placeholder:text-text-tertiary focus:bg-surface"
              />
            </div>

            <Button type="submit" variant="primary" size="md" className="w-full" disabled={!canSend}>
              {submitting ? t("problem.sending") : t("problem.send")}
            </Button>
          </div>
        </form>
      )}
    </ModalSheet>
  );
}
