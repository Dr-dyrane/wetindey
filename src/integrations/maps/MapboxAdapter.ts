export interface MapMarkerOptions {
  id: string;
  lat: number;
  lng: number;
  label: string;
  status: "confirmed" | "caution" | "unavailable" | "neutral";
  onClick?: () => void;
}

export interface MapProviderAdapter {
  initialize(container: HTMLDivElement, center: { lat: number; lng: number }, zoom: number): void;
  setCenter(lat: number, lng: number): void;
  addMarker(options: MapMarkerOptions): void;
  clearMarkers(): void;
  resize(): void;
  destroy(): void;
}

// Local typings to satisfy strict TypeScript checking without using "any"
interface MapboxMap {
  flyTo(options: { center: [number, number]; essential: boolean; duration: number }): void;
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

  constructor(accessToken?: string) {
    this.accessToken = accessToken || process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || "";
  }

  public initialize(container: HTMLDivElement, center: { lat: number; lng: number }, zoom: number): void {
    if (this.mapInstance) return;

    // Cast the window global context to our typed interface
    const mapboxgl = (window as unknown as WindowWithMapboxgl).mapboxgl || null;

    if (!mapboxgl) {
      console.warn("Mapbox GL JS library not loaded. Falling back to static map canvas.");
      return;
    }

    mapboxgl.accessToken = this.accessToken;
    this.mapInstance = new mapboxgl.Map({
      container,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [center.lng, center.lat],
      zoom,
      attributionControl: false
    });
  }

  public setCenter(lat: number, lng: number): void {
    if (this.mapInstance) {
      this.mapInstance.flyTo({
        center: [lng, lat],
        essential: true,
        duration: 800
      });
    }
  }

  public addMarker(options: MapMarkerOptions): void {
    if (!this.mapInstance) return;

    const mapboxgl = (window as unknown as WindowWithMapboxgl).mapboxgl;
    if (!mapboxgl) return;

    // Create custom borderless marker element following Apple HIG
    const el = document.createElement("div");
    el.className = `h-9 w-9 rounded-full shadow-md flex items-center justify-center cursor-pointer border-0 transition-transform hover:scale-105 active:scale-95 duration-micro`;
    
    // Status colors conforming to Section 17.3 (Borderless)
    if (options.status === "confirmed") {
      el.className += " bg-status-confirmed text-white";
    } else if (options.status === "caution") {
      el.className += " bg-status-caution text-white";
    } else if (options.status === "unavailable") {
      el.className += " bg-status-unavailable text-white";
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
