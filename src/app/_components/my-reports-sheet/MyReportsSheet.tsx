"use client";

import { useMyReportsSheet } from "./hooks/useMyReportsSheet";
import { MyReportsSheetView } from "./views/MyReportsSheetView";

export interface MyReportsSheetProps {
  open: boolean;
  onClose: () => void;
  signedIn: boolean;
  onReportPrice: () => void;
}

export function MyReportsSheet({
  open,
  onClose,
  signedIn,
  onReportPrice,
}: MyReportsSheetProps) {
  const sheet = useMyReportsSheet({ open, signedIn, onReportPrice });

  return (
    <MyReportsSheetView
      open={open}
      onClose={onClose}
      signedIn={signedIn}
      sheet={sheet}
    />
  );
}
