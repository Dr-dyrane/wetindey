import { useState } from "react";

/**
 * Latches true the first time `open` is true and never resets.
 *
 * This is the render gate for the code-split sheets: a next/dynamic
 * component fetches its chunk when first RENDERED, so rendering it
 * unconditionally would re-download every sheet right after boot on exactly
 * the metered connections the split protects. Gating on `open` alone would
 * unmount the sheet the instant it closes and clip ModalSheet's exit
 * animation (ModalSheet self-manages its presence THROUGH the exit
 * transition, then removes its own DOM). Once opened, staying mounted
 * forever costs nothing: a closed ModalSheet renders null.
 *
 * setState during render is the documented derived-state form; it re-renders
 * synchronously before commit and stays strict-mode pure.
 */
export function useEverPresented(open: boolean): boolean {
  const [ever, setEver] = useState(false);
  if (open && !ever) setEver(true);
  return ever || open;
}
