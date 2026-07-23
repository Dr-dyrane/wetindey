"use client";

import { useCallback, useInsertionEffect, useRef } from "react";

/**
 * A callback with a referentially stable identity that always invokes the
 * LATEST closure.
 *
 * WHY THIS EXISTS, concretely. `MapboxCanvas`'s marker effect depends on the
 * `onMarkerClick` prop (the marker effect in MapboxCanvas.tsx). The home page
 * passes `handleMarkerSelection` (src/app/_components/home-page/hooks/useHomePage.ts,
 * now wrapped in this very hook), which before this hook was a plain function
 * declaration that got
 * a fresh identity on every single render. So every HomePage render — including
 * ones that change nothing the map cares about, like focus/blur — re-ran that
 * effect, which does `clearMarkers()` followed by a full re-`addMarker()` of the
 * set. Each marker is a createElement + an innerHTML SVG parse + an
 * addEventListener + a `new mapboxgl.Marker` (`addMarker` in
 * src/integrations/maps/MapboxAdapter.ts). The
 * marker data is not the problem: the `mapMarkers` memo is already stable.
 *
 * WHY NOT `useCallback`. `useCallback` is stable only until its deps change, and
 * `handleMarkerSelection` closes over setState and router-ish values that turn
 * over. A dep list that churns gives back exactly the effect re-run we are
 * trying to kill, and a dep list that lies goes stale. The point of this hook is
 * that identity is stable FOREVER while behaviour stays fresh — which is what an
 * effect dependency actually wants from an event handler.
 *
 * WHY `useInsertionEffect`. It commits the new closure before any layout effect
 * or passive effect reads it, so an effect firing in the same commit calls the
 * current version rather than the previous render's. Assigning in a plain
 * `useEffect` would leave a one-commit-stale window; assigning during render
 * would be a side effect in render and break concurrent rendering.
 *
 * CAVEAT, and it is a real one: do not call the returned function DURING render.
 * The ref is not populated for the first render pass, and a render-phase call
 * would read a closure from a render that may never commit. Event handlers,
 * effects, and timers only. This mirrors the constraint on React's own
 * still-unreleased `useEffectEvent`, which this hook stands in for; when that
 * ships, this file is the single place to swap.
 */
export function useEventCallback<Args extends unknown[], Return>(
  fn: (...args: Args) => Return
): (...args: Args) => Return {
  const ref = useRef<(...args: Args) => Return>(fn);

  useInsertionEffect(() => {
    ref.current = fn;
  }, [fn]);

  return useCallback((...args: Args) => ref.current(...args), []);
}
