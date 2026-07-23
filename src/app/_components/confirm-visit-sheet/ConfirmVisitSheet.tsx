"use client";

import { useConfirmVisitSheet, type VisitContext } from "./hooks/useConfirmVisitSheet";
import { ConfirmVisitSheetView } from "./views/ConfirmVisitSheetView";

export type { VisitContext } from "./hooks/useConfirmVisitSheet";
export { armVisit, disarmVisit, takeDueVisit } from "./hooks/useConfirmVisitSheet";

export interface ConfirmVisitSheetProps {
  open: boolean;
  visit: VisitContext | null;
  onClose: () => void;
}

export function ConfirmVisitSheet({ open, visit, onClose }: ConfirmVisitSheetProps) {
  const sheet = useConfirmVisitSheet({ open, visit });

  return (
    <ConfirmVisitSheetView
      open={open}
      visit={visit}
      onClose={onClose}
      sheet={sheet}
    />
  );
}
