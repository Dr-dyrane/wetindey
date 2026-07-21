import {
  AlertTriangle,
  Button,
  CheckCircle2,
  IconOrb,
  ModalSheet,
  SheetPicker,
} from "../imports/imports";
import { KIND_KEYS, type Kind } from "../copy/copy";
import { type useReportProblemSheet } from "../hooks/useReportProblemSheet";
import "../styles/ReportProblemSheet.css";

export interface ReportProblemSheetViewProps {
  open: boolean;
  onClose: () => void;
  sheet: ReturnType<typeof useReportProblemSheet>;
}

export function ReportProblemSheetView({ open, onClose, sheet }: ReportProblemSheetViewProps) {
  const { t, kind, setKind, body, setBody, submitting, error, success, canSend, dismiss, onSubmit } =
    sheet;

  return (
    <ModalSheet open={open} onClose={onClose} title={t("problem.title")} size="form">
      {success ? (
        /* The whole point of the sheet, once it has done its job: a receipt that
           claims nothing beyond receipt. Its own surface on the elevated rung,
           because this presents inside a ModalSheet where bare bg-surface IS the
           panel colour in dark. */
        <div className="flex flex-col items-center gap-3 px-6 py-8 text-center">
          <IconOrb size={48} tone="status-confirmed">
            <CheckCircle2 />
          </IconOrb>
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
              options={KIND_KEYS.map((entry) => ({ id: entry.id, label: t(entry.labelKey) }))}
              value={kind}
              onSelect={(value) => setKind(value as Kind)}
              placeholder={t("problem.kind_placeholder")}
            />

            <div className="space-y-1.5">
              <label htmlFor="problem-body" className="block text-footnote text-text-secondary">
                {t("problem.body_label")}
              </label>
              {/* No Textarea component exists; this mirrors Input.tsx's token set
                  exactly - zero borders, fill for the resting state, focus:bg-surface
                  as the lift. The 1000-char cap is enforced server-side by zod;
                  maxLength here is a courtesy to the typist, not the guard. */}
              <textarea
                id="problem-body"
                value={body}
                onChange={(event) => setBody(event.target.value)}
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
