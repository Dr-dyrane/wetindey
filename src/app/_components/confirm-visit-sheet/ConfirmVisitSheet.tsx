"use client";

import { useConfirmVisitSheet, type VisitContext } from "./hooks/useConfirmVisitSheet";
import { ConfirmVisitSheetView } from "./views/ConfirmVisitSheetView";
import type { Lang } from "./copy/copy";

export type { VisitContext } from "./hooks/useConfirmVisitSheet";
export { armVisit, disarmVisit, takeDueVisit } from "./hooks/useConfirmVisitSheet";

export interface ConfirmVisitSheetProps {
  open: boolean;
  visit: VisitContext | null;
  onClose: () => void;
  lang?: Lang;
}

export function ConfirmVisitSheet({ open, visit, onClose, lang = "en" }: ConfirmVisitSheetProps) {
  const sheet = useConfirmVisitSheet({ open, visit, lang });

  return (
    <ConfirmVisitSheetView
      open={open}
      visit={visit}
      onClose={onClose}
      sheet={sheet}
    />
  );
}
