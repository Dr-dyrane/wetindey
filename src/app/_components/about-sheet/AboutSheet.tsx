"use client";

import { useAboutSheet, type AboutPage } from "./hooks/useAboutSheet";
import { AboutSheetView } from "./views/AboutSheetView";

export type { AboutPage };

export interface AboutSheetProps {
  open: boolean;
  onClose: () => void;
  initialPage?: AboutPage;
}

export function AboutSheet({ open, onClose, initialPage }: AboutSheetProps) {
  const sheet = useAboutSheet({ open, initialPage });

  return <AboutSheetView open={open} onClose={onClose} sheet={sheet} />;
}
