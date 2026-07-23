import React from "react";
import dynamic from "next/dynamic";
import type { PresentedSurface } from "@/core/navigation/usePresentation";

// All five hosted surfaces are code-split: none is on the boot path, and the
// host renders each behind a once-opened latch (see useEverPresented), so a
// chunk downloads only the first time its surface is presented and the
// service worker keeps it offline-permanent afterwards. ssr:false with a
// null loading state matches what a closed ModalSheet rendered anyway.
const LocationSheet = dynamic(
  () => import("@/app/_components/location-sheet/LocationSheet").then((m) => m.LocationSheet),
  { ssr: false, loading: () => null }
);
const MyReportsSheet = dynamic(
  () => import("@/app/_components/my-reports-sheet/MyReportsSheet").then((m) => m.MyReportsSheet),
  { ssr: false, loading: () => null }
);
const ManageProfileSheet = dynamic(
  () =>
    import("@/app/_components/manage-profile-sheet/ManageProfileSheet").then(
      (m) => m.ManageProfileSheet
    ),
  { ssr: false, loading: () => null }
);
const ReportProblemSheet = dynamic(
  () =>
    import("@/app/_components/report-problem-sheet/ReportProblemSheet").then(
      (m) => m.ReportProblemSheet
    ),
  { ssr: false, loading: () => null }
);
const AboutSheet = dynamic(
  () => import("@/app/_components/about-sheet/AboutSheet").then((m) => m.AboutSheet),
  { ssr: false, loading: () => null }
);

export {
  React,
  LocationSheet,
  MyReportsSheet,
  ManageProfileSheet,
  ReportProblemSheet,
  AboutSheet,
  type PresentedSurface,
};
