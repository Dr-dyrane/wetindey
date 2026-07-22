import type { MapboxMap } from "./MapboxAdapter";

/**
 * Honour the OS "reduce motion" setting by collapsing camera animations to a
 * cut. Read per call rather than cached — the setting can change mid-session.
 *
 * Note we do NOT drop `essential: true`. Mapbox's own reduced-motion handling
 * only fires for non-essential moves and it is all-or-nothing; keeping the move
 * essential and setting duration 0 gives the same result deterministically,
 * whether the move originated from a user tap or from a sheet detent change.
 */
function reducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export const duration = (ms: number) => (reducedMotion() ? 0 : ms);

/**
 * Cross-fade length for the theme-swap snapshot overlay, and the ceiling on
 * how long setTheme will wait for the capture's render tick before swapping
 * without a snapshot. The wait bound matters more than the fade: a swap must
 * never be hostage to a render event that cannot arrive.
 */
const THEME_FADE_MS = 300;
const THEME_SNAPSHOT_CAPTURE_TIMEOUT_MS = 400;
/** Liveness ceiling: past this, continuity is worth less than truth. */
const THEME_SNAPSHOT_MAX_HOLD_MS = 8000;

/**
 * Photograph the current frame. The WebGL back buffer is only readable
 * during a render (`preserveDrawingBuffer` is off, as it should be), so this
 * asks for one repaint and reads the canvas inside that render event — the
 * same in-frame window the frame-evidence probes rely on. If the render tick
 * cannot arrive, the bounded timer proceeds with no snapshot rather than
 * holding the theme hostage: the swap must happen either way; only the
 * continuity garnish is optional.
 */
export function captureThemeSnapshot(
  map: MapboxMap,
  onDone: (dataUrl: string | null, outcome: "captured" | "capture-error" | "capture-timeout") => void
): void {
  let settled = false;
  let fallbackTimer: number | null = null;
  const renderListener = () => {
    if (settled) return;
    settled = true;
    if (fallbackTimer !== null) window.clearTimeout(fallbackTimer);
    map.off("render", renderListener);
    const dataUrl = photographFrame(map);
    onDone(dataUrl, dataUrl ? "captured" : "capture-error");
  };
  fallbackTimer = window.setTimeout(() => {
    if (settled) return;
    settled = true;
    map.off("render", renderListener);
    onDone(null, "capture-timeout");
  }, THEME_SNAPSHOT_CAPTURE_TIMEOUT_MS);
  map.on("render", renderListener);
  map.triggerRepaint();
}

/**
 * Last-frame snapshot shown over the canvas while setStyle rebuilds a theme
 * swap. streets-v12 and dark-v11 cannot style-diff (different layers and
 * sprites — the console says "Unimplemented: setSprite" and rebuilds from
 * scratch), so without this the user watches bare background paint for the
 * whole refetch. The overlay is removed on the lifecycle seam: faded on
 * "ready", instantly on "failed" so it can never mask the failure surface.
 */
export class ThemeSnapshotOverlay {
  private el: HTMLDivElement | null = null;

  get active(): boolean {
    return this.el !== null;
  }

  /**
   * Pin the snapshot over the canvas but UNDER the DOM markers: the overlay is
   * inserted as the canvas's next sibling inside Mapbox's canvas container, and
   * markers are later siblings, so the pins keep floating above the frozen
   * ground exactly as they do above the live one. Removal is owned by the
   * lifecycle seam (emitStyleLifecycle): faded on "ready", immediate on
   * "failed" so the failure surface is never hidden behind a healthy-looking
   * photograph, and destroy() collects it with everything else.
   */
  install(map: MapboxMap, dataUrl: string): void {
    this.remove(false);
    const canvas = map.getCanvas();
    const canvasContainer = canvas.parentElement;
    if (!canvasContainer) return;
    const overlay = document.createElement("div");
    overlay.setAttribute("aria-hidden", "true");
    overlay.style.position = "absolute";
    overlay.style.inset = "0";
    overlay.style.backgroundImage = `url("${dataUrl}")`;
    overlay.style.backgroundSize = "100% 100%";
    overlay.style.pointerEvents = "none";
    overlay.style.opacity = "1";
    overlay.style.transition = `opacity ${duration(THEME_FADE_MS)}ms ease`;
    canvas.insertAdjacentElement("afterend", overlay);
    this.el = overlay;
    // "ready" is the healthy fade trigger, but it is gated on the frame probe,
    // and environments whose framebuffer cannot be read never emit it even
    // though the new style paints perfectly. `idle` is Mapbox's probe-free
    // "everything is loaded and drawn" — the caller installs this overlay in
    // the same task that calls setStyle, so the first idle to fire belongs to
    // the incoming style. The ceiling timer guarantees the photograph can
    // never become wallpaper if every signal goes missing.
    const idleListener = () => {
      map.off("idle", idleListener);
      if (this.el === overlay) this.remove(true);
    };
    map.on("idle", idleListener);
    window.setTimeout(() => {
      if (this.el === overlay) this.remove(true);
    }, THEME_SNAPSHOT_MAX_HOLD_MS);
  }

  remove(fade: boolean): void {
    const overlay = this.el;
    if (!overlay) return;
    this.el = null;
    const fadeMs = duration(THEME_FADE_MS);
    if (!fade || fadeMs === 0) {
      overlay.remove();
      return;
    }
    let collected = false;
    const collect = () => {
      if (collected) return;
      collected = true;
      overlay.remove();
    };
    overlay.addEventListener("transitionend", collect, { once: true });
    // transitionend is not guaranteed (display changes, tab backgrounding);
    // the timer makes removal unconditional.
    window.setTimeout(collect, fadeMs + 100);
    overlay.style.opacity = "0";
  }
}

/**
 * Read the frame the way inspectFrameEvidence does — gl.readPixels during the
 * render event — rather than canvas.toDataURL. The two reads answer from
 * different buffers: on ANGLE/SwiftShader (and some mobile GPUs) the canvas-
 * level read reflects an already-presented, cleared buffer and comes back
 * black even while readPixels still sees the drawn frame. A black photograph
 * held over the map would be strictly worse than the bare rebuild, so a
 * near-black read is rejected here exactly like a failed one (the dark
 * style's land sits well above the 8/255 floor).
 */
function photographFrame(map: MapboxMap): string | null {
  try {
    const canvas = map.getCanvas();
    const gl =
      (canvas.getContext("webgl2") as WebGL2RenderingContext | null) ??
      (canvas.getContext("webgl") as WebGLRenderingContext | null);
    if (!gl || gl.isContextLost()) return null;
    const width = gl.drawingBufferWidth;
    const height = gl.drawingBufferHeight;
    if (width <= 0 || height <= 0) return null;
    const pixels = new Uint8Array(width * height * 4);
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    let maxChannel = 0;
    for (let sampleY = 0; sampleY < 8; sampleY++) {
      for (let sampleX = 0; sampleX < 8; sampleX++) {
        const x = Math.floor(((width - 1) * sampleX) / 7);
        const y = Math.floor(((height - 1) * sampleY) / 7);
        const offset = (y * width + x) * 4;
        maxChannel = Math.max(
          maxChannel,
          pixels[offset],
          pixels[offset + 1],
          pixels[offset + 2]
        );
      }
    }
    if (maxChannel < 8) return null;
    const flipped = document.createElement("canvas");
    flipped.width = width;
    flipped.height = height;
    const context2d = flipped.getContext("2d");
    if (!context2d) return null;
    const image = context2d.createImageData(width, height);
    const rowBytes = width * 4;
    // readPixels rows run bottom-up; ImageData runs top-down.
    for (let y = 0; y < height; y++) {
      image.data.set(
        pixels.subarray((height - 1 - y) * rowBytes, (height - y) * rowBytes),
        y * rowBytes
      );
    }
    context2d.putImageData(image, 0, 0);
    // JPEG: the map is opaque, and encoding is several times faster than PNG
    // at these canvas sizes. This runs once per theme toggle.
    return flipped.toDataURL("image/jpeg", 0.7);
  } catch {
    return null;
  }
}
