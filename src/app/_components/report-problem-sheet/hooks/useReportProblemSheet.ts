import {
  type FormEvent,
  useLocaleControl,
  useState,
  useT,
  submitProblemReport,
} from "../imports/imports";
import { type Kind } from "../copy/copy";

export interface UseReportProblemSheetOptions {
  onClose: () => void;
}

export function useReportProblemSheet({ onClose }: UseReportProblemSheetOptions) {
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

  // Dismissal - backdrop, Escape and the close control all route here - resets,
  // so reopening the sheet starts blank rather than showing a stale confirmation
  // or a half-typed report from last time.
  const dismiss = () => {
    reset();
    onClose();
  };

  const canSend = kind !== "" && body.trim().length > 0 && !submitting;

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!canSend) return;
    setSubmitting(true);
    setError("");
    try {
      await submitProblemReport({ kind: kind as Kind, body: body.trim(), appLocale: locale });
      setSuccess(true);
    } catch (err) {
      // The message is redacted to a digest in production and could carry the
      // rejected payload back in dev, so we never surface it - a fixed, honest
      // line instead, in the app's Nigerian-English register.
      console.error("ReportProblemSheet: submit failed", err);
      setError(t("problem.err_send"));
    } finally {
      setSubmitting(false);
    }
  };

  return {
    t,
    kind,
    setKind,
    body,
    setBody,
    submitting,
    error,
    success,
    canSend,
    dismiss,
    onSubmit,
  };
}
