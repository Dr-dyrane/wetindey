"use client";

import React from "react";
import { LocationSheet } from "@/app/_components/LocationSheet";
import { MyReportsSheet } from "@/app/_components/MyReportsSheet";
import { ReportProblemSheet } from "@/app/_components/ReportProblemSheet";
import { AboutSheet } from "@/app/_components/AboutSheet";
import type { PresentedSurface } from "@/core/navigation/usePresentation";

interface PresentationHostProps {
  /** The single presented surface. Exactly one of the sheets below is `open`. */
  surface: PresentedSurface;
  /** Dismiss whatever is presented. Backdrop, Escape and each sheet's close control all land here. */
  onClose: () => void;
  /** LocationSheet: the active search radius coverage is judged against. */
  radiusKm: number;
  /** LocationSheet committed a position; recentre the map. */
  onCommitLocation: (coords: { lat: number; lng: number }) => void;
  /** MyReportsSheet: whether anyone is recognised. Picks the empty-state copy, never gates the sheet. */
  signedIn: boolean;
  /**
   * MyReportsSheet's empty-state exit: close this surface and present the report-price sheet, which
   * stays page.tsx's own boolean (it carries ~15 form fields this controller does not own).
   */
  onReportPrice: () => void;
}

/**
 * The one controller surface renderer.
 *
 * Every sheet is always mounted and gated by `open`, exactly as the four
 * booleans gated them in page.tsx, so ModalSheet's present/dismiss lifecycle
 * (focus move, `presentedCount`, the results-sheet demote) is byte-for-byte
 * unchanged. What changed is upstream: `surface` can hold only one kind, so at
 * most one `open` is ever true and opening one surface closes any other by
 * construction. That single-surface invariant is the stacking fix, there is no
 * state in which a previous surface peeks above the new one.
 *
 * The data-carrying sheets (item detail, Get it, Confirm visit) and the boolean
 * ones (Settings, Profile, Report a price) stay siblings in page.tsx; they are
 * not this host's to own.
 */
export function PresentationHost({
  surface,
  onClose,
  radiusKm,
  onCommitLocation,
  signedIn,
  onReportPrice,
}: PresentationHostProps) {
  return (
    <>
      <LocationSheet
        open={surface.kind === "location"}
        onClose={onClose}
        radiusKm={radiusKm}
        onCommit={onCommitLocation}
      />

      <MyReportsSheet
        open={surface.kind === "my-reports"}
        onClose={onClose}
        signedIn={signedIn}
        onReportPrice={onReportPrice}
      />

      <ReportProblemSheet open={surface.kind === "report-problem"} onClose={onClose} />

      <AboutSheet
        open={surface.kind === "about"}
        onClose={onClose}
        initialPage={surface.kind === "about" ? surface.page : undefined}
      />
    </>
  );
}
