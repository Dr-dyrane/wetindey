"use client";

import { useReportProblemSheet } from "./hooks/useReportProblemSheet";
import { ReportProblemSheetView } from "./views/ReportProblemSheetView";

export interface ReportProblemSheetProps {
  open: boolean;
  onClose: () => void;
}

/**
 * "Report a problem", the whole sheet. Opened from the Profile row that spent its
 * life `disabled` over a no-op `onClick`; this is its destination.
 *
 * COLD ONLY, on purpose. It is presented from Profile, where no offer is on
 * screen, so it captures no `placeId`/`itemVariantId`/`unitId` - the report is a
 * free-text "something is wrong", not a report ABOUT a specific offer. The DB
 * columns for that context exist (nullable, forward-looking); a warm entry point
 * inside a detail sheet is a separate change that would pass them in here.
 *
 * NOT GATED ON THE SESSION. ADR-003: auth is recognition, never a gate. Anyone
 * can file, signed in or out; `submitProblemReport` resolves attribution
 * server-side and files anonymously when there is no session. This sheet never
 * mentions signing in.
 *
 * THE CONFIRMATION PROMISES NOTHING IT CANNOT KEEP. There is no reply channel -
 * no email-back, no ticket, no status the user can later check - because none
 * exists in this product. So the success copy says only what is true: it was
 * received, and the people who run WetinDey read these. It does NOT say "we'll
 * get back to you".
 */
export function ReportProblemSheet({ open, onClose }: ReportProblemSheetProps) {
  const sheet = useReportProblemSheet({ onClose });

  return <ReportProblemSheetView open={open} onClose={sheet.dismiss} sheet={sheet} />;
}
