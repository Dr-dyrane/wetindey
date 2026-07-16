import { atom } from "jotai";

// Mobile sheet detent height control: "peek" (~20%), "medium" (~50%), "large" (~90%)
export type SheetDetent = "peek" | "medium" | "large";

export const sheetDetentAtom = atom<SheetDetent>("medium");

// Active marker/place selected on map canvas
export const activeMarkerIdAtom = atom<string | null>(null);

// Interactive focus states (preventing heavy component tree redraws)
export const searchFocusedAtom = atom<boolean>(false);

// Dark/light mode theme selection (supports system default overrides)
export const isMobileListActiveAtom = atom<boolean>(false);
