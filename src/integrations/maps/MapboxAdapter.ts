export interface MapMarkerOptions {
  id: string;
  lat: number;
  lng: number;
  label: string;
  status: "confirmed" | "caution" | "unavailable" | "neutral";
  onClick?: () => void;
}

/**
 * Pixels of the viewport that are covered by chrome, per edge.
 *
 * This is the single most important camera concept in this app. The sheet sits
 * ON TOP of the map and covers 52% of the screen at medium and 94% at large, so
 * the geometric centre of the <canvas> is NOT the centre of the map the user can
 * actually see. Mapbox models exactly this: given padding, every camera
 * operation treats the un-covered rectangle as the viewport, so `center` lands
 * in the middle of the visible band instead of behind the sheet.
 */
export interface MapPadding {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export const ZERO_PADDING: MapPadding = { top: 0, right: 0, bottom: 0, left: 0 };

/** Screen-space point, origin at the canvas top-left. */
export interface ScreenPoint {
  x: number;
  y: number;
}

export interface MapProviderAdapter {
  initialize(
    container: HTMLDivElement,
    center: { lat: number; lng: number },
    zoom: number,
    theme?: "light" | "dark",
    padding?: MapPadding
  ): void;
  setTheme(theme: "light" | "dark"): void;
  setPadding(padding: MapPadding, options?: { animate?: boolean }): void;
  getPadding(): MapPadding;
  setCenter(lat: number, lng: number): void;
  recenterTo(lat: number, lng: number, zoom?: number): void;
  projectPoint(lat: number, lng: number): ScreenPoint | null;
  addMarker(options: MapMarkerOptions): void;
  clearMarkers(): void;
  resize(): void;
  destroy(): void;
}

/** Camera duration for a deliberate move (selection, recenter). */
const FLY_DURATION_MS = 800;
/**
 * Camera duration for a padding change. Short: the map is correcting itself
 * under a sheet the user is already moving, so it must read as the same gesture,
 * not as a second animation chasing the first.
 */
const PADDING_DURATION_MS = 300;

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

const duration = (ms: number) => (reducedMotion() ? 0 : ms);

// Local typings to satisfy strict TypeScript checking without using "any"
interface MapboxCameraOptions {
  center?: [number, number];
  zoom?: number;
  padding?: MapPadding;
  essential?: boolean;
  duration?: number;
}

interface MapboxMap {
  flyTo(options: MapboxCameraOptions): void;
  easeTo(options: MapboxCameraOptions): void;
  project(lnglat: [number, number]): ScreenPoint;
  setStyle(style: string): void;
  resize(): void;
  remove(): void;
}

interface MapboxMarker {
  remove(): void;
}

interface WindowWithMapboxgl extends Window {
  mapboxgl?: {
    accessToken: string;
    Map: new (options: {
      container: HTMLDivElement;
      style: string;
      center: [number, number];
      zoom: number;
      attributionControl: boolean;
    }) => MapboxMap;
    Marker: new (element: HTMLDivElement) => {
      setLngLat(lnglat: [number, number]): {
        addTo(map: MapboxMap): MapboxMarker;
      };
    };
  };
}

export class MapboxAdapter implements MapProviderAdapter {
  private mapInstance: MapboxMap | null = null;
  private markersMap: Map<string, MapboxMarker> = new Map();
  private accessToken: string;
  /** Theme the live style already reflects; see setTheme. */
  private currentTheme: "light" | "dark" = "light";
  /**
   * The occlusion the camera is currently compensating for. Held here rather
   * than read back off the map so that padding set before `initialize` (the
   * adapter is created asynchronously — see MapboxCanvas) is not lost, and so
   * every camera call has one source of truth to pass along.
   */
  private padding: MapPadding = { ...ZERO_PADDING };

  constructor(accessToken?: string) {
    this.accessToken = accessToken || process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || "";
  }

  /** The map is the app's base layer, so its style has to track the app theme. */
  public static styleFor(theme: "light" | "dark"): string {
    return theme === "dark"
      ? "mapbox://styles/mapbox/dark-v11"
      : "mapbox://styles/mapbox/streets-v12";
  }

  public initialize(
    container: HTMLDivElement,
    center: { lat: number; lng: number },
    zoom: number,
    theme: "light" | "dark" = "light",
    padding: MapPadding = ZERO_PADDING
  ): void {
    if (this.mapInstance) return;

    // Cast the window global context to our typed interface
    const mapboxgl = (window as unknown as WindowWithMapboxgl).mapboxgl || null;

    if (!mapboxgl) {
      console.warn("Mapbox GL JS library not loaded. Falling back to static map canvas.");
      return;
    }

    mapboxgl.accessToken = this.accessToken;
    this.currentTheme = theme;
    this.padding = { ...padding };
    this.mapInstance = new mapboxgl.Map({
      container,
      style: MapboxAdapter.styleFor(theme),
      center: [center.lng, center.lat],
      zoom,
      attributionControl: false
    });
    // Applied as a camera call rather than a constructor option so the very
    // first frame is already padded: the opening centre must sit above the
    // sheet, not behind it.
    this.mapInstance.easeTo({ padding: this.padding, essential: true, duration: 0 });
  }

  /**
   * Swap basemaps in place when the theme changes, keeping camera and markers.
   *
   * Guarded on the currently-applied theme. Calling setStyle with the style the
   * map already has still tears the style down and rebuilds it from scratch —
   * and if that lands before the first style has finished loading, the map is
   * left blank. Since the theme effect fires once on mount with the initial
   * theme, an unguarded call blanked the map on every load.
   */
  public setTheme(theme: "light" | "dark"): void {
    if (!this.mapInstance) return;
    if (theme === this.currentTheme) return;
    this.currentTheme = theme;
    this.mapInstance.setStyle(MapboxAdapter.styleFor(theme));
  }

  /**
   * Tell the camera how much of the viewport is covered.
   *
   * The camera is usually still when this is called (the sheet moved, the map
   * did not), and the geographic centre must not change — only where on screen
   * that centre is drawn. `easeTo` with nothing but padding does exactly that:
   * it holds `center`, `zoom` and `bearing` and slides the map so the same point
   * sits in the middle of the new, smaller visible box. A `jumpTo` here would
   * teleport the world sideways under a sheet that is itself animating, which
   * reads as a glitch; the ease reads as the map making room.
   */
  public setPadding(padding: MapPadding, options?: { animate?: boolean }): void {
    this.padding = { ...padding };
    if (!this.mapInstance) return;
    this.mapInstance.easeTo({
      padding: this.padding,
      essential: true,
      duration: options?.animate === false ? 0 : duration(PADDING_DURATION_MS)
    });
  }

  public getPadding(): MapPadding {
    return { ...this.padding };
  }

  /**
   * Fly to a point, keeping the current zoom.
   *
   * The padding is what makes this correct. Without it Mapbox centres on the
   * full viewport, so with the sheet up at medium the target landed 26% of the
   * screen height BELOW the sheet's top edge — i.e. the app "centred" on
   * something the user could not see. See MapboxCanvas for where padding
   * comes from.
   */
  public setCenter(lat: number, lng: number): void {
    if (!this.mapInstance) return;
    this.mapInstance.flyTo({
      center: [lng, lat],
      padding: this.padding,
      essential: true,
      duration: duration(FLY_DURATION_MS)
    });
  }

  /**
   * RECENTER — put a point back under the user's eye at a legible zoom.
   *
   * Distinct from setCenter: this asserts a zoom as well as a centre, which is
   * what "take me back to where I am" means after the user has pinched out to
   * the whole city. Padding-aware for the same reason as everything else here.
   */
  public recenterTo(lat: number, lng: number, zoom: number = 14.5): void {
    if (!this.mapInstance) return;
    this.mapInstance.flyTo({
      center: [lng, lat],
      zoom,
      padding: this.padding,
      essential: true,
      duration: duration(FLY_DURATION_MS)
    });
  }

  /**
   * Where a coordinate currently lands on screen, in canvas pixels.
   *
   * Exists so occlusion can be asserted rather than eyeballed — a caller (or a
   * test harness) can check that a target sits above the sheet's top edge.
   */
  public projectPoint(lat: number, lng: number): ScreenPoint | null {
    if (!this.mapInstance) return null;
    return this.mapInstance.project([lng, lat]);
  }

  public addMarker(options: MapMarkerOptions): void {
    if (!this.mapInstance) return;

    const mapboxgl = (window as unknown as WindowWithMapboxgl).mapboxgl;
    if (!mapboxgl) return;

    // Create custom borderless marker element following Apple HIG
    const el = document.createElement("div");
    el.className = `h-9 w-9 rounded-full shadow-md flex items-center justify-center cursor-pointer transition-transform hover:scale-105 active:scale-95 duration-micro`;

    // Status colors conforming to Section 17.3 (Borderless)
    if (options.status === "confirmed") {
      el.className += " bg-status-confirmed text-onStatus";
    } else if (options.status === "caution") {
      el.className += " bg-status-caution text-onStatus";
    } else if (options.status === "unavailable") {
      el.className += " bg-status-unavailable text-onStatus";
    } else {
      // Neutral startup market pins (Apple HIG gray style)
      el.className += " bg-fillSecondary text-accent";
    }

    // Hairline marker pin svg
    el.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
        <circle cx="12" cy="10" r="3"/>
      </svg>
    `;

    if (options.onClick) {
      el.addEventListener("click", () => {
        options.onClick?.();
      });
    }

    const markerInstance = new mapboxgl.Marker(el)
      .setLngLat([options.lng, options.lat])
      .addTo(this.mapInstance);

    this.markersMap.set(options.id, markerInstance);
  }

  public clearMarkers(): void {
    this.markersMap.forEach((marker) => marker.remove());
    this.markersMap.clear();
  }

  public resize(): void {
    if (this.mapInstance) {
      this.mapInstance.resize();
    }
  }

  public destroy(): void {
    if (this.mapInstance) {
      this.clearMarkers();
      this.mapInstance.remove();
      this.mapInstance = null;
    }
  }
}
