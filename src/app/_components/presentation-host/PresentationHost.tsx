"use client";

import React from "react";
import { PresentationHostView } from "./views/PresentationHostView";
import type { PresentedSurface } from "@/core/navigation/usePresentation";

export interface PresentationHostProps {
  surface: PresentedSurface;
  onClose: () => void;
  radiusKm: number;
  onCommitLocation: (coords: { lat: number; lng: number }) => void;
  signedIn: boolean;
  onReportPrice: () => void;
  manageProfileUser: { name: string; email: string } | null;
  onSessionChange: () => void;
}

export function PresentationHost(props: PresentationHostProps) {
  return <PresentationHostView {...props} />;
}
