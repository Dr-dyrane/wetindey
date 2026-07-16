import { atom } from "jotai";

// Mobile sheet detent height control: "peek" (~20%), "medium" (~50%), "large" (~90%)
export type SheetDetent = "peek" | "medium" | "large";

export const sheetDetentAtom = atom<SheetDetent>("medium");

// Active marker/place selected on map canvas
export const activeMarkerIdAtom = atom<string | null>(null);

/*
 * `searchFocusedAtom` was here, and is gone.
 *
 * It was write-only: page.tsx destructured it as `_searchFocused` and discarded
 * it, so the sole effect of setting it on focus/blur was to re-render HomePage.
 * The comment on it claimed the opposite — that it "prevents heavy component
 * tree redraws" — while `handleMarkerSelection` was a plain function
 * declaration and therefore a fresh identity on every render, and a dependency
 * of MapboxCanvas's marker effect. Tapping the search box tore down and rebuilt
 * every pin on the map.
 *
 * Both halves are now fixed: the atom is deleted, and page.tsx's map callbacks
 * are wrapped in `useEventCallback` (@/lib/perf), which holds their identity
 * stable against every OTHER re-render too — the atom was only one source of
 * churn among many.
 */
