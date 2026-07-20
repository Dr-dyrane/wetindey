"use client";

import { useManageProfileSheet } from "./hooks/useManageProfileSheet";
import { ManageProfileSheetView } from "./views/ManageProfileSheetView";

export interface ManageProfileSheetProps {
  open: boolean;
  onClose: () => void;
  user: { name: string; email: string } | null;
  onSessionChange: () => void;
}

export function ManageProfileSheet({
  open,
  onClose,
  user,
  onSessionChange,
}: ManageProfileSheetProps) {
  const sheet = useManageProfileSheet({ open, user, onSessionChange });

  return <ManageProfileSheetView open={open} onClose={onClose} sheet={sheet} />;
}
