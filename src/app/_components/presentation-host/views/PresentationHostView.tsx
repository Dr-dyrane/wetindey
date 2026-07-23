import {
  React,
  LocationSheet,
  MyReportsSheet,
  ManageProfileSheet,
  ReportProblemSheet,
  AboutSheet,
} from "../imports/imports";
import { useEverPresented } from "@/app/_components/home-page/hooks/useEverPresented";
import type { PresentationHostProps } from "../PresentationHost";
export type PresentationHostViewProps = PresentationHostProps;

export function PresentationHostView(p: PresentationHostViewProps) {
  // Once-opened latches: each surface is a code-split chunk that must not
  // download at boot (so: not rendered until first open) and must not
  // unmount mid exit animation (so: never un-rendered after that).
  const locationEver = useEverPresented(p.surface.kind === "location");
  const myReportsEver = useEverPresented(p.surface.kind === "my-reports");
  const manageProfileEver = useEverPresented(p.surface.kind === "manage-profile");
  const reportProblemEver = useEverPresented(p.surface.kind === "report-problem");
  const aboutEver = useEverPresented(p.surface.kind === "about");

  return (
    <div>
      {locationEver && (
        <LocationSheet
          open={p.surface.kind === "location"}
          onClose={p.onClose}
          radiusKm={p.radiusKm}
          onCommit={p.onCommitLocation}
        />
      )}

      {myReportsEver && (
        <MyReportsSheet
          open={p.surface.kind === "my-reports"}
          onClose={p.onClose}
          signedIn={p.signedIn}
          onReportPrice={p.onReportPrice}
        />
      )}

      {manageProfileEver && (
        <ManageProfileSheet
          open={p.surface.kind === "manage-profile"}
          onClose={p.onClose}
          user={p.manageProfileUser}
          onSessionChange={p.onSessionChange}
        />
      )}

      {reportProblemEver && (
        <ReportProblemSheet open={p.surface.kind === "report-problem"} onClose={p.onClose} />
      )}

      {aboutEver && (
        <AboutSheet
          open={p.surface.kind === "about"}
          onClose={p.onClose}
          initialPage={p.surface.kind === "about" ? p.surface.page : undefined}
        />
      )}
    </div>
  );
}
