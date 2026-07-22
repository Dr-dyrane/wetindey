import {
  React,
  LocationSheet,
  MyReportsSheet,
  ManageProfileSheet,
  ReportProblemSheet,
  AboutSheet,
} from "../imports/imports";
import type { PresentationHostProps } from "../PresentationHost";
export type PresentationHostViewProps = PresentationHostProps;

export function PresentationHostView(p: PresentationHostViewProps) {
  return (
    <div>
      <LocationSheet
        open={p.surface.kind === "location"}
        onClose={p.onClose}
        radiusKm={p.radiusKm}
        onCommit={p.onCommitLocation}
      />

      <MyReportsSheet
        open={p.surface.kind === "my-reports"}
        onClose={p.onClose}
        signedIn={p.signedIn}
        onReportPrice={p.onReportPrice}
      />

      <ManageProfileSheet
        open={p.surface.kind === "manage-profile"}
        onClose={p.onClose}
        user={p.manageProfileUser}
        onSessionChange={p.onSessionChange}
      />

      <ReportProblemSheet open={p.surface.kind === "report-problem"} onClose={p.onClose} />

      <AboutSheet
        open={p.surface.kind === "about"}
        onClose={p.onClose}
        initialPage={p.surface.kind === "about" ? p.surface.page : undefined}
      />
    </div>
  );
}
