"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * The presentation spine.
 *
 * WHAT THIS REPLACES
 * ------------------
 * page.tsx carried one boolean per presented sheet: `isLocationOpen`,
 * `isMyReportsOpen`, `isReportProblemOpen`, `isAboutOpen`. Four independent
 * flags can all be true at once, which is the shape of the modal-over-modal
 * stacking the app already paid to undo (task #13). This union can hold exactly
 * ONE surface, so opening B replaces A by construction: there is no state in
 * which two of these surfaces are presented together, and none in which one
 * peeks above the next.
 *
 * WHAT STAYED A BOOLEAN, ON PURPOSE
 * ---------------------------------
 * Settings, Profile, Report a price, and the four data-carrying flows
 * (place detail, item detail, Get it, Confirm visit) are NOT in here. They
 * either carry armed state wired into the map or are the navigation hub that
 * dispatches INTO this controller, and the owner's scope for this change was
 * exactly the four dataless reading/utility surfaces below. Pulling the others
 * in was considered and declined: the split the scout proved clean is precisely
 * these four.
 *
 * WHY LOCAL STATE, NOT A MODULE STORE
 * -----------------------------------
 * Unlike i18n, every opener already lives in page.tsx or in a ProfileSheet
 * callback that page.tsx owns. A module store would add subscription wiring for
 * a value with a single writer. `useState` in the one component that opens these
 * surfaces is the whole mechanism.
 */

/**
 * Sub-pages inside About that a hash can land on directly. Not exported: it is
 * only the shape of `about`'s `page` below, and it is structurally identical to
 * AboutSheet's own `AboutPage`, so `surface.page` flows straight into that
 * sheet's `initialPage` prop with no shared import and no cast.
 *
 * The two lists MUST stay identical: PresentationHost passes `surface.page`
 * straight into AboutSheet's `initialPage`, so a page one side names and the
 * other does not would fail to typecheck at that seam. Each value is also its own
 * hash (`how-it-works` -> `/#how-it-works`), which is why `surfaceToHash` can
 * return `surface.page` unchanged.
 */
type AboutPage =
  | "terms"
  | "privacy"
  | "support"
  | "how-it-works"
  | "accessibility"
  | "licenses"
  | "attributions";

/**
 * The one surface presented over the map right now. `none` is the resting state.
 * Exactly one kind at a time, that single-surface invariant is what removes the
 * stacking the four booleans allowed.
 */
export type PresentedSurface =
  | { kind: "none" }
  | { kind: "location" }
  | { kind: "my-reports" }
  | { kind: "manage-profile" }
  | { kind: "report-problem" }
  | { kind: "about"; page?: AboutPage };

const NONE: PresentedSurface = { kind: "none" };

/**
 * The hashes a shared link may carry, mapped to the surface each one opens.
 *
 * READING / ENTRY SURFACES ONLY. `location` is the transient camera and
 * `my-reports` is a personal list read from the session, neither is a shareable
 * URL, and the list must never be addressable by a link, so neither appears here
 * or writes a hash below. Terms, Privacy and Support are the About hub's own
 * sub-pages; a hash lands directly on one via AboutSheet's `initialPage`.
 */
const HASH_TO_SURFACE: Readonly<Record<string, PresentedSurface>> = {
  about: { kind: "about" },
  terms: { kind: "about", page: "terms" },
  privacy: { kind: "about", page: "privacy" },
  support: { kind: "about", page: "support" },
  "how-it-works": { kind: "about", page: "how-it-works" },
  accessibility: { kind: "about", page: "accessibility" },
  licenses: { kind: "about", page: "licenses" },
  attributions: { kind: "about", page: "attributions" },
  "report-problem": { kind: "report-problem" },
};

/**
 * The hash a surface writes back into the URL when it opens, or `null` when it is
 * not deep-linkable. About reflects the sub-page it entered on, so a `/#privacy`
 * link stays `/#privacy` rather than collapsing to `/#about`.
 */
function surfaceToHash(surface: PresentedSurface): string | null {
  switch (surface.kind) {
    case "about":
      return surface.page ?? "about";
    case "report-problem":
      return "report-problem";
    default:
      // none, location, my-reports, manage-profile: nothing shareable to write.
      // manage-profile is session/PII-scoped, so like my-reports it is a union
      // member that is deliberately absent from HASH_TO_SURFACE and writes no hash.
      return null;
  }
}

/** The current fragment, without its leading `#`. Client-only; never call in render. */
function currentHash(): string {
  return window.location.hash.replace(/^#/, "");
}

export interface Presentation {
  surface: PresentedSurface;
  openSurface: (next: PresentedSurface) => void;
  closeSurface: () => void;
}

export function usePresentation(): Presentation {
  const [surface, setSurface] = useState<PresentedSurface>(NONE);

  /**
   * Keep the URL in step with what is presented, so a deep-linkable surface is
   * shareable and the browser Back button closes it.
   *
   * A deep-linkable surface ASSIGNS `location.hash`, which pushes a history entry
   *, that is what makes Back pop it and fire the `hashchange` below, closing the
   * surface. Clearing uses `replaceState`, which fires no event (so the listener
   * cannot chase it) and leaves no bare trailing `#`.
   */
  const reflectHash = useCallback((next: PresentedSurface) => {
    if (typeof window === "undefined") return;
    const want = surfaceToHash(next);
    const have = currentHash();
    if (want) {
      if (have !== want) window.location.hash = want;
    } else if (have) {
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    }
  }, []);

  const openSurface = useCallback(
    (next: PresentedSurface) => {
      setSurface(next);
      reflectHash(next);
    },
    [reflectHash]
  );

  const closeSurface = useCallback(() => {
    setSurface(NONE);
    reflectHash(NONE);
  }, [reflectHash]);

  /**
   * The hash is CLIENT-ONLY: read it here, never during render, so the server and
   * the first paint both resolve `none` and a deep-linked surface appears one
   * frame later, the same discipline i18n uses for the stored locale.
   *
   * `hashchange` is the single source of truth for URL-driven changes: the
   * initial link on mount, a manual edit, and the Back/Forward buttons all arrive
   * through it. It sets state DIRECTLY and never re-reflects, because the URL is
   * already what it says, reflecting would be the write chasing its own event.
   */
  useEffect(() => {
    const apply = () => setSurface(HASH_TO_SURFACE[currentHash()] ?? NONE);
    apply();
    window.addEventListener("hashchange", apply);
    return () => window.removeEventListener("hashchange", apply);
  }, []);

  return { surface, openSurface, closeSurface };
}
