export const REPORT_DATE = new Intl.DateTimeFormat("en-NG", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

export function formatReportDate(iso: string): string {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) {
    throw new Error(`MyReportsSheet: unreadable observedAt timestamp ${JSON.stringify(iso)}`);
  }
  return REPORT_DATE.format(ms);
}
