"use client";

import { useLocationSheet } from "./hooks/useLocationSheet";
import { LocationSheetView } from "./views/LocationSheetView";

export interface LocationSheetProps {
  open: boolean;
  onClose: () => void;
  radiusKm: number;
  onCommit?: (coords: { lat: number; lng: number }) => void;
}

export function LocationSheet({ open, onClose, radiusKm, onCommit }: LocationSheetProps) {
  const sheet = useLocationSheet({ open, onClose, radiusKm, onCommit });

  return (
    <LocationSheetView
      open={open}
      onClose={onClose}
      radiusKm={radiusKm}
      sheet={sheet}
    />
  );
}
