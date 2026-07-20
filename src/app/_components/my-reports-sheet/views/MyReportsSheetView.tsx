import {
  React,
  ModalSheet,
  AsyncList,
  Button,
  TrendingUp,
  formatNaira,
  type MyReport,
} from "../imports/imports";
import { type useMyReportsSheet } from "../hooks/useMyReportsSheet";
import { formatReportDate } from "../copy/copy";
import "../styles/MyReportsSheet.css";

export interface MyReportsSheetViewProps {
  open: boolean;
  onClose: () => void;
  signedIn: boolean;
  sheet: ReturnType<typeof useMyReportsSheet>;
}

export function MyReportsSheetView({
  open,
  onClose,
  signedIn,
  sheet,
}: MyReportsSheetViewProps) {
  const { t, reports, error, loading, load, onReportPrice } = sheet;

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

  return (
    <ModalSheet open={open} onClose={onClose} title={t("reports.title")} size="page">
      <div className="px-4 py-3">
        <AsyncList<MyReport>
          items={reports}
          isLoading={loading}
          error={error}
          onRetry={() => void load()}
          subject={signedIn ? "in" : "out"}
          renderItem={(r) => <ReportRow report={r} t={t} />}
          keyExtractor={(r) => r.id}
          empty={empty}
          errorState={{ title: t("reports.err_load") }}
        />

        {signedIn && reports?.length === 0 && !error && (
          <p className="px-4 pt-3 text-caption-1 text-text-secondary">
            {t("reports.empty_footnote")}
          </p>
        )}
      </div>
    </ModalSheet>
  );
}

function ReportRow({
  report,
  t,
}: {
  report: MyReport;
  t: ReturnType<typeof useMyReportsSheet>["t"];
}) {
  const sold = report.availabilityState === "unavailable";
  const showPrice = report.priceAmount !== null && !sold;

  return (
    <div className="flex items-start justify-between gap-3 squircle-card bg-surface px-4 py-3 shadow-card dark:bg-surface-elevated">
      <div className="min-w-0 flex-1">
        <p className="truncate text-body text-text-primary">{report.variantName}</p>
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
        ) : null}
        <p className="text-caption-1 tabular-nums text-text-tertiary">
          {formatReportDate(report.observedAt)}
        </p>
      </div>
    </div>
  );
}
