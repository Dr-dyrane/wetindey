"use client";

import { useEffect, useState } from "react";

/**
 * Match a media query, with an SSR-safe first render.
 *
 * Returns `null` until mounted, because `window.matchMedia` does not exist on
 * the server and guessing would produce a hydration mismatch. Callers should
 * treat `null` as "not known yet" and render nothing layout-defining.
 *
 * The usual objection to this pattern is the flash before `mounted` flips —
 * here there is none: ThemeProvider already holds the tree at
 * `visibility: hidden` until it mounts, so the unresolved frame is never seen.
 */
export function useMediaQuery(query: string): boolean | null {
  const [matches, setMatches] = useState<boolean | null>(null);

  useEffect(() => {
    const mql = window.matchMedia(query);
    setMatches(mql.matches);
    const onChange = (e: MediaQueryListEvent) => setMatches(e.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}
