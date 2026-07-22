"use client";

import React from "react";
import { useSettingsSheet } from "./hooks/useSettingsSheet";
import { SettingsSheetView } from "./views/SettingsSheetView";

export type LangType = "en" | "pidgin" | "yoruba";

export interface SettingsSheetProps {
  open: boolean;
  onClose: () => void;
  lang: LangType;
  onLangChange: (l: LangType) => void;
  theme: string;
  onToggleTheme: () => void;
  radiusKm: number;
  onRadiusChange: (km: number) => void;
  t: Record<string, string>;
}

export function SettingsSheet(props: SettingsSheetProps) {
  const sheet = useSettingsSheet();
  return <SettingsSheetView {...props} sheet={sheet} />;
}
