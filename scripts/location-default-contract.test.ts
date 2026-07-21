import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  DEVICE_LOCATION_FRESH_MS,
  ROUTE_ORIGIN_FRESH_MS,
  isDeviceLocationFresh,
  mergePersistedLocationState,
  migratePersistedLocationState,
  newestDeviceLocation,
  type DeviceLocation,
  useLocationStore,
} from "../src/core/state/locationStore";
import { PRIMARY_LOCATION, SW_LAGOS_AREAS, SW_LAGOS_PLACES } from "../src/db/lagosSouthWest";
import { MapboxAdapter, type MapStyleLifecycleState } from "../src/integrations/maps/MapboxAdapter";
import {
  INITIAL_MAP_CANVAS_RUNTIME_STATE,
  INITIAL_MAP_CANVAS_STYLE_STATE,
  mapCanvasOverlay,
  reduceMapCanvasRuntimeState,
  reduceMapCanvasStyleState,
  type MapCanvasRuntimeState,
  type MapCanvasStyleState,
} from "../src/design-system/components/MapboxCanvas";
import { disclosedRouteOrigin, isDisclosedRouteOriginAdmissible } from "../src/lib/directions";

const testFilter = process.env.WETINDEY_CONTRACT_FILTER;

function test(name: string, run: () => void) {
  if (testFilter && !name.includes(testFilter)) return;
  try {
    run();
    process.stdout.write(`✓ ${name}\n`);
  } catch (error) {
    process.stderr.write(`✗ ${name}\n`);
    throw error;
  }
}

const previousDefault = {
  position: {
    lat: 6.4641,
    lng: 3.2753,
    provenance: "default" as const,
    areaName: "Festac Town",
    areaSlug: "festac",
    setAt: 0,
  },
};

test("the synthetic default uses the canonical Festac area centre", () => {
  const festac = SW_LAGOS_AREAS.find((area) => area.slug === "festac");
  assert.ok(festac);
  assert.deepEqual(
    { lat: PRIMARY_LOCATION.lat, lng: PRIMARY_LOCATION.lng },
    { lat: 6.4655, lng: 3.279 }
  );
  assert.deepEqual({ lat: PRIMARY_LOCATION.lat, lng: PRIMARY_LOCATION.lng }, festac.center);
  assert.equal(PRIMARY_LOCATION.source, festac.source);
});

test("legacy synthetic defaults migrate to browsing context only", () => {
  assert.deepEqual(migratePersistedLocationState(previousDefault, 1), {
    browsingLocation: {
      lat: PRIMARY_LOCATION.lat,
      lng: PRIMARY_LOCATION.lng,
      provenance: "default",
      areaName: "Festac Town",
      areaSlug: "festac",
      setAt: 0,
    },
  });
});

for (const provenance of ["manual", "simulated"] as const) {
  test(`${provenance} browsing coordinates survive migration without rehydrating a device fix`, () => {
    const legacy = {
      position: {
        lat: 6.50123,
        lng: 3.40123,
        provenance,
        areaName: "Chosen area",
        areaSlug: "chosen-area",
        setAt: 1_721_234_567_890,
      },
    };
    const migrated = migratePersistedLocationState(legacy, 2);
    assert.deepEqual(migrated, { browsingLocation: legacy.position });
    const merged = mergePersistedLocationState(migrated, useLocationStore.getState());
    assert.deepEqual(merged.browsingLocation, legacy.position);
    assert.equal(merged.deviceLocation, null);
  });
}

test("persisted device browsing context is reduced to its canonical area centre", () => {
  const legacy = {
    position: {
      lat: 6.50123,
      lng: 3.40123,
      provenance: "device" as const,
      areaName: "Festac Town",
      areaSlug: "festac",
      setAt: 1_721_234_567_890,
    },
  };
  assert.deepEqual(migratePersistedLocationState(legacy, 2), {
    browsingLocation: {
      lat: PRIMARY_LOCATION.lat,
      lng: PRIMARY_LOCATION.lng,
      provenance: "device",
      areaName: "Festac Town",
      areaSlug: "festac",
      setAt: legacy.position.setAt,
    },
  });
});

test("malformed current state falls back to canonical browsing context", () => {
  const merged = mergePersistedLocationState(
    { browsingLocation: null },
    useLocationStore.getState()
  );
  assert.deepEqual(merged.browsingLocation, {
    lat: PRIMARY_LOCATION.lat,
    lng: PRIMARY_LOCATION.lng,
    provenance: "default",
    areaName: "Festac Town",
    areaSlug: "festac",
    setAt: 0,
  });
  assert.equal(merged.deviceLocation, null);
});

test("device freshness is five minutes and route admission is one minute", () => {
  assert.equal(DEVICE_LOCATION_FRESH_MS, 300_000);
  assert.equal(ROUTE_ORIGIN_FRESH_MS, 60_000);
  const now = 2_000_000;
  const location: DeviceLocation = {
    lat: 6.5,
    lng: 3.4,
    accuracyM: 42,
    capturedAt: now - ROUTE_ORIGIN_FRESH_MS,
    receivedAt: now,
    provenance: "device",
  };
  assert.equal(isDeviceLocationFresh(location, ROUTE_ORIGIN_FRESH_MS, now), true);
  const disclosed = disclosedRouteOrigin(location, now);
  assert.ok(disclosed);
  assert.equal(isDisclosedRouteOriginAdmissible(disclosed, now), true);
  assert.equal(isDisclosedRouteOriginAdmissible(disclosed, now + ROUTE_ORIGIN_FRESH_MS + 1), false);
  assert.equal(
    disclosedRouteOrigin({ ...location, capturedAt: now - ROUTE_ORIGIN_FRESH_MS - 1 }, now),
    null
  );
  assert.equal(
    isDeviceLocationFresh(
      { ...location, capturedAt: now - DEVICE_LOCATION_FRESH_MS - 1 },
      DEVICE_LOCATION_FRESH_MS,
      now
    ),
    false
  );
});

test("out-of-order device responses cannot replace newer evidence", () => {
  const newer: DeviceLocation = {
    lat: 6.5,
    lng: 3.4,
    accuracyM: 30,
    capturedAt: 2_000,
    receivedAt: 2_010,
    provenance: "device",
  };
  const older = { ...newer, capturedAt: 1_000, receivedAt: 2_020 };
  assert.equal(newestDeviceLocation(newer, older), newer);
  assert.equal(newestDeviceLocation(older, newer), newer);
});

test("the collision correction does not move the demo place", () => {
  const stalls = SW_LAGOS_PLACES.find((place) => place.slug === "festac-24-road-stalls");
  assert.ok(stalls);
  assert.deepEqual(stalls.location, { lat: 6.46408, lng: 3.27525 });
  assert.equal(stalls.verified, false);
});

const sources = Object.fromEntries(
  [
    "src/core/state/locationStore.ts",
    "src/core/state/globalStore.ts",
    "src/app/_components/location-sheet/hooks/useLocationSheet.ts",
    "src/app/_hooks/useLocationIdentity.ts",
    "src/app/_components/home-page/hooks/useHomePage.ts",
    "src/app/_components/home-page/views/HomePageView.tsx",
    "src/app/_components/map-presentation/views/MapPresentationView.tsx",
    "src/design-system/components/MapboxCanvas.tsx",
    "src/integrations/maps/MapboxAdapter.ts",
    "src/app/_components/get-it-sheet/hooks/useGetItSheet.ts",
    "src/app/_components/get-it-sheet/views/GetItSheetView.tsx",
    "src/lib/directions.ts",
    "src/app/_actions/actions.ts",
    "src/app/_actions/place-actions.ts",
    "src/app/_actions/exchange-location-actions.ts",
    "src/integrations/maps/MapboxNearbyExchangeSearch.ts",
  ].map((path) => [path, readFileSync(join(process.cwd(), path), "utf8")])
);

test("the truthful vertical keeps concepts and persistence separate", () => {
  const store = sources["src/core/state/locationStore.ts"];
  const camera = sources["src/core/state/globalStore.ts"];
  const home = sources["src/app/_components/home-page/hooks/useHomePage.ts"];
  const mapView = sources["src/app/_components/map-presentation/views/MapPresentationView.tsx"];
  assert.match(store, /browsingLocation:\s*state\.browsingLocation/);
  assert.doesNotMatch(store, /deviceLocation:\s*state\.deviceLocation/);
  assert.match(store, /version:\s*3/);
  assert.match(camera, /cameraCenter:/);
  assert.doesNotMatch(camera, /\bmapCenter:/);
  assert.match(mapView, /sharedUsers=\{\[\]\}/);
  assert.match(home, /routeOrigin && routeOrigin\.targetKey === routeTarget\?\.key/);
  assert.doesNotMatch(
    sources["src/app/_components/home-page/views/HomePageView.tsx"],
    /<GetItSheet[\s\S]{0,300}origin=\{/
  );
});

test("avatar session callbacks directly refresh map self identity avatar state", () => {
  const home = sources["src/app/_components/home-page/hooks/useHomePage.ts"];
  const homeView = sources["src/app/_components/home-page/views/HomePageView.tsx"];
  assert.match(
    home,
    /const handleSessionChange = useEventCallback\(async \(\) => \{[\s\S]{0,140}await refetchSession\(\);[\s\S]{0,140}await refreshSelfProfileAvatar\(\);[\s\S]{0,80}\}\);/
  );
  assert.match(home, /const refreshSelfProfileAvatar = useEventCallback\(async \(\) => \{/);
  assert.match(
    home,
    /const nextAvatarUrl = latestProfile\?\.avatarUrl \?\? null;[\s\S]{0,120}setSelfHeaderAvatarUrl\(nextAvatarUrl\);[\s\S]{0,240}getImageProps\(\{[\s\S]{0,220}width: 64,[\s\S]{0,120}height: 64[\s\S]{0,120}\}\)\.props\.src;/
  );
  assert.match(home, /const resolvedSelfIdentity = useMemo\(\(\) => \{/);
  assert.match(
    home,
    /const resolvedSelfIdentity = useMemo\(\(\) => \{[\s\S]{0,120}if \(!selfMapMarkerAvatarUrl\) return selfIdentity;[\s\S]{0,120}avatarUrl: selfMapMarkerAvatarUrl/,
  );
  assert.match(home, /const resolvedSelfAvatarUrl = selfHeaderAvatarUrl \?\? userProfile\?\.avatarUrl;/);
  assert.match(homeView, /selfIdentity=\{resolvedSelfIdentity\}/);
  assert.match(homeView, /url=\{resolvedSelfAvatarUrl\}/);
  assert.doesNotMatch(
    home,
    /const resolvedSelfIdentity = useMemo\(\(\) => \{[\s\S]{0,200}avatarUrl: selfAvatarUrl/,
  );
  assert.doesNotMatch(homeView, /selfIdentity=\{selfIdentity\}/);
  assert.match(
    home,
    /if \(!sessionUser\) \{[\s\S]{0,120}setSelfHeaderAvatarUrl\(null\);[\s\S]{0,120}setSelfMapMarkerAvatarUrl\(null\);[\s\S]{0,40}return;/
  );
});

test("device identity, accuracy halo and route disclosure remain explicit", () => {
  const canvas = sources["src/design-system/components/MapboxCanvas.tsx"];
  const adapter = sources["src/integrations/maps/MapboxAdapter.ts"];
  const locationSheet = sources["src/app/_components/location-sheet/hooks/useLocationSheet.ts"];
  const identity = sources["src/app/_hooks/useLocationIdentity.ts"];
  const sheet = sources["src/app/_components/get-it-sheet/hooks/useGetItSheet.ts"];
  const sheetView = sources["src/app/_components/get-it-sheet/views/GetItSheetView.tsx"];
  const directions = sources["src/lib/directions.ts"];
  assert.match(canvas, /useFreshDeviceLocation\(\)/);
  assert.match(locationSheet, /const freshDeviceLocation = useFreshDeviceLocation\(\)/);
  assert.doesNotMatch(locationSheet, /\bdeviceCoords\b/);
  assert.match(canvas, /adapter\.setUserPosition\(null\)/);
  assert.match(adapter, /const halo = document\.createElement\("span"\)/);
  assert.match(adapter, /const orb = document\.createElement\("span"\)/);
  assert.match(adapter, /image\.onload = \(\) => fallback\.remove\(\)/);
  assert.match(adapter, /image\.onerror = \(\) => image\.remove\(\)/);
  assert.match(adapter, /identityName ===\s*"Me"\s*\?\s*"Me"/);
  assert.ok(
    locationSheet.indexOf("recordDeviceLocation(deviceLocation)") <
      locationSheet.indexOf("await getCoverageForPoint"),
    "outside-coverage fixes must be retained before coverage lookup"
  );
  assert.match(
    identity,
    /const handleRecenter = useCallback\([\s\S]{0,300}recordDeviceLocation\(deviceLocation\)[\s\S]{0,200}setCameraCenter/
  );
  assert.doesNotMatch(
    identity,
    /const handleRecenter = useCallback\([\s\S]{0,500}setDeviceBrowsingLocation/
  );
  assert.match(sheetView, /Choose what leaves WetinDey/);
  assert.match(sheet, /maximumAgeMs:\s*0/);
  assert.match(sheet, /handoff\(null\)/);
  assert.match(sheet, /onOriginDisclosed\?\.\(targetPlaceId, origin\)/);
  assert.match(sheet, /origin && isDisclosedRouteOriginAdmissible\(origin\) \? origin : null/);
  assert.match(directions, /!isRouteOriginAdmissible\(origin\)/);
});

test("auth transitions cannot retain or restore a stale profile avatar", () => {
  const identity = sources["src/app/_hooks/useLocationIdentity.ts"];
  assert.match(
    identity,
    /useEffect\(\(\) => \{[\s\S]{0,120}let cancelled = false;[\s\S]{0,160}setUserProfile\(null\);/
  );
  assert.match(
    identity,
    /getMyProfile\(\)[\s\S]{0,120}if \(!cancelled\) setUserProfile\(profile\)/
  );
  assert.match(
    identity,
    /return \(\) => \{[\s\S]{0,60}cancelled = true;[\s\S]{0,40}\};[\s\S]{0,60}\}, \[session, sessionUser\]\)/
  );
});

test("coordinate failures never interpolate precise values", () => {
  const actions = sources["src/app/_actions/actions.ts"];
  const getIt = sources["src/app/_components/get-it-sheet/hooks/useGetItSheet.ts"];
  assert.doesNotMatch(actions, /invalid search origin \$\{/);
  assert.doesNotMatch(actions, /Invalid coordinate: lat=/);
  assert.doesNotMatch(getIt, /invalid coordinate.*lat=\$\{/);
});

test("exchange discovery admits only explicit browsing context and fails partial queries closed", () => {
  const action = sources["src/app/_actions/exchange-location-actions.ts"];
  const discovery = sources["src/integrations/maps/MapboxNearbyExchangeSearch.ts"];
  const home = sources["src/app/_components/home-page/hooks/useHomePage.ts"];
  assert.match(action, /provenance:\s*"browsing"/);
  assert.match(action, /input\.provenance !== "browsing"/);
  assert.match(home, /getNearbyExchangeLocations\(\{[\s\S]{0,100}provenance: "browsing"/);
  assert.match(discovery, /results\.some\(\(result\) => result\.status === "rejected"\)/);
  assert.doesNotMatch(discovery, /results\.every\(\(result\) => result\.status === "rejected"\)/);
  assert.match(discovery, /Number\(origin\.lat\.toFixed\(3\)\)/);
  assert.match(discovery, /Number\(origin\.lng\.toFixed\(3\)\)/);
});

test("nearest coverage tie-breaks prefer neighbourhood then slug deterministically", () => {
  const actions = sources["src/app/_actions/place-actions.ts"];
  assert.match(
    actions,
    /\.orderBy\(sql`ST_Distance\(\$\{areas\.center\}, ST_GeogFromText\(\$\{point\}\)\) asc, \(\$\{areas\.type\} = 'neighborhood'\) desc, \$\{areas\.slug\} asc`\)\s*\.limit\(1\)/
  );

  type Candidate = {
    distanceM: number;
    type: "lga" | "neighborhood";
    slug: string;
  };
  const rank = (candidates: Candidate[]) =>
    [...candidates].sort(
      (left, right) =>
        left.distanceM - right.distanceM ||
        Number(right.type === "neighborhood") - Number(left.type === "neighborhood") ||
        left.slug.localeCompare(right.slug)
    );

  assert.equal(
    rank([
      { distanceM: 0, type: "lga", slug: "aaa-lga" },
      { distanceM: 0, type: "neighborhood", slug: "zzz-neighborhood" },
    ])[0]?.type,
    "neighborhood"
  );
  assert.equal(
    rank([
      { distanceM: 0, type: "neighborhood", slug: "z-last-in-sort" },
      { distanceM: 0, type: "neighborhood", slug: "a-first-in-sort" },
    ])[0]?.slug,
    "a-first-in-sort"
  );
});

type StyleListener = () => void;

class FakeWebGLContext {
  readonly RGBA = 0x1908;
  readonly UNSIGNED_BYTE = 0x1401;
  drawingBufferWidth = 320;
  drawingBufferHeight = 240;
  black = false;
  lost = false;
  routeOnlyPixel = false;
  transparent = false;
  leaveReadTargetUntouched = false;
  throwOnRead = false;

  isContextLost() {
    return this.lost;
  }

  readPixels(
    x: number,
    y: number,
    _width: number,
    _height: number,
    _format: number,
    _type: number,
    target: Uint8Array
  ) {
    if (this.throwOnRead) throw new Error("readback rejected");
    if (this.leaveReadTargetUntouched) return;
    const routeOnlySample = this.routeOnlyPixel && x < 70 && y < 55;
    if (this.transparent) {
      target.fill(0);
      return;
    }
    target[0] = this.black && !routeOnlySample ? 0 : 36;
    target[1] = this.black && !routeOnlySample ? 0 : 48;
    target[2] = this.black && !routeOnlySample ? 0 : 56;
    target[3] = 255;
  }
}

class FakeCanvas {
  readonly context = new FakeWebGLContext();
  contextAvailable = true;
  contextType: "webgl2" | "webgl" = "webgl2";
  throwOnContextAccess = false;

  getContext(type: string) {
    if (this.throwOnContextAccess) throw new Error("GL access rejected");
    return type === this.contextType && this.contextAvailable ? this.context : null;
  }
}

class FakeMap {
  static latest: FakeMap | null = null;
  static instances: FakeMap[] = [];
  static rejectNextConstruction = false;
  private reportedStyle: string;
  private center: { lng: number; lat: number };
  private zoom: number;
  private bearing: number;
  private pitch: number;
  private canvas = new FakeCanvas();
  private styleLoaded = false;
  private styleListeners = new Set<StyleListener>();
  private idleListeners = new Set<StyleListener>();
  private renderListeners = new Set<StyleListener>();
  private errorListeners = new Set<(event: unknown) => void>();
  private contextLostListeners = new Set<StyleListener>();
  private contextRestoredListeners = new Set<StyleListener>();
  private rejectStyleChanges = false;
  private usableStyleFrame = false;
  private emitStyleLoadInsideSetStyle = false;
  private emitRenderInsideSetStyle = false;
  private emitRenderBeforeRejectedSetStyle = false;
  private mutationSafe = false;
  private routeSourcePresent = false;
  private routeLayerPresent = false;
  private routeReplayCount = 0;
  private removed = false;
  private onRemove: (() => void) | null = null;
  private rejectNextRemove = false;

  constructor(options: {
    style: string;
    center: [number, number];
    zoom: number;
    bearing?: number;
    pitch?: number;
  }) {
    if (FakeMap.rejectNextConstruction) {
      FakeMap.rejectNextConstruction = false;
      throw new Error("map construction rejected");
    }
    this.reportedStyle = options.style;
    this.center = { lng: options.center[0], lat: options.center[1] };
    this.zoom = options.zoom;
    this.bearing = options.bearing ?? 0;
    this.pitch = options.pitch ?? 0;
    FakeMap.latest = this;
    FakeMap.instances.push(this);
  }

  on(type: string, listener: StyleListener | ((event: unknown) => void)) {
    if (type === "style.load") this.styleListeners.add(listener as StyleListener);
    if (type === "idle") this.idleListeners.add(listener as StyleListener);
    if (type === "render") this.renderListeners.add(listener as StyleListener);
    if (type === "error") this.errorListeners.add(listener as (event: unknown) => void);
    if (type === "webglcontextlost") this.contextLostListeners.add(listener as StyleListener);
    if (type === "webglcontextrestored")
      this.contextRestoredListeners.add(listener as StyleListener);
  }

  off(type: string, listener: StyleListener | ((event: unknown) => void)) {
    if (type === "style.load") this.styleListeners.delete(listener as StyleListener);
    if (type === "idle") this.idleListeners.delete(listener as StyleListener);
    if (type === "render") this.renderListeners.delete(listener as StyleListener);
    if (type === "error") this.errorListeners.delete(listener as (event: unknown) => void);
    if (type === "webglcontextlost") this.contextLostListeners.delete(listener as StyleListener);
    if (type === "webglcontextrestored")
      this.contextRestoredListeners.delete(listener as StyleListener);
  }

  setStyle(style: string) {
    if (this.rejectStyleChanges) {
      if (this.emitStyleLoadInsideSetStyle) {
        this.mutationSafe = true;
        for (const listener of [...this.styleListeners]) listener();
      }
      if (this.emitRenderBeforeRejectedSetStyle) {
        this.reportedStyle = style;
        this.usableStyleFrame = true;
        this.canvas.context.black = false;
        for (const listener of [...this.renderListeners]) listener();
      }
      throw new Error("style rejected");
    }
    this.reportedStyle = style;
    this.styleLoaded = false;
    this.usableStyleFrame = false;
    this.canvas.context.black = true;
    this.mutationSafe = false;
    this.routeSourcePresent = false;
    this.routeLayerPresent = false;
    this.canvas.context.routeOnlyPixel = false;
    if (this.emitRenderInsideSetStyle) {
      this.usableStyleFrame = true;
      this.canvas.context.black = false;
      for (const listener of [...this.renderListeners]) listener();
    }
    if (this.emitStyleLoadInsideSetStyle) {
      // Model Mapbox's documented edge: style.load makes style mutation safe,
      // while isStyleLoaded can still remain false until sources settle.
      this.mutationSafe = true;
      for (const listener of [...this.styleListeners]) listener();
    }
  }

  getStyle() {
    return {
      name: this.reportedStyle.includes("dark-v11") ? "Mapbox Dark" : "Mapbox Streets",
      layers: this.usableStyleFrame ? [{ id: "background", type: "background" }] : [],
    };
  }

  snapshotStyleListeners(): StyleListener[] {
    return [...this.styleListeners];
  }

  snapshotRenderListeners(): StyleListener[] {
    return [...this.renderListeners];
  }

  listenerCount(type: "style.load" | "idle" | "render") {
    if (type === "style.load") return this.styleListeners.size;
    if (type === "idle") return this.idleListeners.size;
    return this.renderListeners.size;
  }

  setStyleLoaded(loaded: boolean) {
    this.styleLoaded = loaded;
    this.mutationSafe = loaded;
  }

  setUsableStyleFrame(usable: boolean) {
    this.usableStyleFrame = usable;
    this.canvas.context.black = !usable;
  }

  setBlackFrame(black: boolean) {
    this.canvas.context.black = black;
  }

  setFrameProbeMode(
    mode:
      | "visible"
      | "black"
      | "transparent"
      | "read-noop"
      | "read-throw"
      | "context-unavailable"
      | "gl-error"
      | "zero-buffer"
  ) {
    const context = this.canvas.context;
    this.canvas.contextAvailable = mode !== "context-unavailable";
    this.canvas.throwOnContextAccess = mode === "gl-error";
    context.black = mode === "black";
    context.transparent = mode === "transparent";
    context.leaveReadTargetUntouched = mode === "read-noop";
    context.throwOnRead = mode === "read-throw";
    context.drawingBufferWidth = mode === "zero-buffer" ? 0 : 320;
    context.drawingBufferHeight = mode === "zero-buffer" ? 0 : 240;
  }

  setContextType(type: "webgl2" | "webgl") {
    this.canvas.contextType = type;
  }

  setEmitStyleLoadInsideSetStyle(emit: boolean) {
    this.emitStyleLoadInsideSetStyle = emit;
  }

  setEmitRenderInsideSetStyle(emit: boolean) {
    this.emitRenderInsideSetStyle = emit;
  }

  setEmitRenderBeforeRejectedSetStyle(emit: boolean) {
    this.emitRenderBeforeRejectedSetStyle = emit;
  }

  setRejectStyleChanges(reject: boolean) {
    this.rejectStyleChanges = reject;
  }

  emitStyleLoad() {
    this.styleLoaded = true;
    this.mutationSafe = true;
    for (const listener of [...this.styleListeners]) listener();
    this.setUsableStyleFrame(true);
    this.emitRender();
  }

  emitStyleLoadBeforeTilesSettle() {
    this.styleLoaded = false;
    this.mutationSafe = true;
    for (const listener of [...this.styleListeners]) listener();
    this.setUsableStyleFrame(true);
    this.emitRender();
  }

  emitBlackStyleLoad() {
    this.styleLoaded = true;
    this.mutationSafe = true;
    this.setBlackFrame(true);
    for (const listener of [...this.styleListeners]) listener();
    this.emitRender();
  }

  emitIdle() {
    for (const listener of [...this.idleListeners]) listener();
  }

  emitRender() {
    for (const listener of [...this.renderListeners]) listener();
  }

  emitBlackRender() {
    this.setBlackFrame(true);
    this.emitRender();
  }

  loseContext() {
    this.canvas.context.lost = true;
    for (const listener of [...this.contextLostListeners]) listener();
  }

  restoreContext(black = false) {
    this.canvas.context.lost = false;
    this.canvas.context.black = black;
    for (const listener of [...this.contextRestoredListeners]) listener();
  }

  snapshotContextLostListeners(): StyleListener[] {
    return [...this.contextLostListeners];
  }

  snapshotErrorListeners(): ((event: unknown) => void)[] {
    return [...this.errorListeners];
  }

  emitError(message: string) {
    for (const listener of [...this.errorListeners]) {
      listener({ error: { message } });
    }
  }

  totalLifecycleListenerCount() {
    return (
      this.styleListeners.size +
      this.idleListeners.size +
      this.renderListeners.size +
      this.errorListeners.size +
      this.contextLostListeners.size +
      this.contextRestoredListeners.size
    );
  }

  // Real Mapbox schedules work; the call itself is not a render acknowledgement.
  triggerRepaint() {}

  easeTo(options: { center?: [number, number]; zoom?: number; bearing?: number; pitch?: number }) {
    if (options.center) {
      this.center = { lng: options.center[0], lat: options.center[1] };
    }
    if (options.zoom !== undefined) this.zoom = options.zoom;
    if (options.bearing !== undefined) this.bearing = options.bearing;
    if (options.pitch !== undefined) this.pitch = options.pitch;
  }
  flyTo(options: { center?: [number, number]; zoom?: number; bearing?: number; pitch?: number }) {
    this.easeTo(options);
  }
  fitBounds(_bounds: unknown, _options: unknown) {}
  project(_coordinate: unknown) {
    return { x: 0, y: 0 };
  }
  getCenter() {
    return { ...this.center };
  }
  getZoom() {
    return this.zoom;
  }
  getBearing() {
    return this.bearing;
  }
  getPitch() {
    return this.pitch;
  }
  getCanvas() {
    return this.canvas as unknown as HTMLCanvasElement;
  }
  isStyleLoaded() {
    return this.styleLoaded;
  }
  getSource(id: string) {
    if (id !== "wetindey-route" || !this.routeSourcePresent) return undefined;
    return { setData: (_data: unknown) => {} };
  }
  addSource(id: string, _source: unknown) {
    if (!this.mutationSafe) throw new Error("Style is not done loading");
    if (id === "wetindey-route") this.routeSourcePresent = true;
  }
  removeSource(id: string) {
    if (id === "wetindey-route") this.routeSourcePresent = false;
  }
  addLayer(layer: { id?: string }, _before?: string) {
    if (!this.mutationSafe) throw new Error("Style is not done loading");
    if (layer.id === "wetindey-route-line") {
      this.routeLayerPresent = true;
      this.routeReplayCount += 1;
      this.canvas.context.routeOnlyPixel = true;
    }
  }
  getLayer(id: string) {
    return id === "wetindey-route-line" && this.routeLayerPresent ? { id } : undefined;
  }
  removeLayer(id: string) {
    if (id === "wetindey-route-line") {
      this.routeLayerPresent = false;
      this.canvas.context.routeOnlyPixel = false;
    }
  }
  setPaintProperty(_layer: string, _name: string, _value: unknown) {
    if (!this.mutationSafe) throw new Error("Style is not done loading");
  }
  setLayoutProperty(_layer: string, _name: string, _value: unknown) {}
  setFilter(_layer: string, _filter: unknown) {}
  resize() {}
  remove() {
    if (this.rejectNextRemove) {
      this.rejectNextRemove = false;
      throw new Error("map removal rejected");
    }
    this.removed = true;
    this.onRemove?.();
    // Mapbox intentionally loses the context from remove(). Adapter listeners
    // must already be detached, so this event can never start recovery.
    this.loseContext();
  }

  wasRemoved() {
    return this.removed;
  }

  setOnRemove(callback: () => void) {
    this.onRemove = callback;
  }

  setRejectNextRemove(reject: boolean) {
    this.rejectNextRemove = reject;
  }

  getRouteReplayCount() {
    return this.routeReplayCount;
  }
}

class FakeMarker {
  readonly maps: FakeMap[] = [];
  removeCount = 0;

  setLngLat(_coordinate: [number, number]) {
    return this;
  }

  addTo(map: FakeMap) {
    this.maps.push(map);
    return this;
  }

  remove() {
    this.removeCount += 1;
  }
}

class FakePopup {
  readonly maps: FakeMap[] = [];
  open = true;

  addTo(map: FakeMap) {
    this.maps.push(map);
    this.open = true;
    return this;
  }

  isOpen() {
    return this.open;
  }
}

test("Canvas current readiness clears stale failure without admitting stale callbacks", () => {
  const overlayFor = (state: MapCanvasRuntimeState) =>
    mapCanvasOverlay(state.adapterReady, state.libraryFailed, state.style);
  const lifecycle = (
    status: MapStyleLifecycleState["status"],
    generation: number
  ): MapStyleLifecycleState =>
    status === "failed"
      ? {
          status,
          generation,
          theme: "light",
          attempt: 2,
          reason: "timeout",
        }
      : {
          status,
          generation,
          theme: "light",
          attempt: 1,
        };

  let state = reduceMapCanvasRuntimeState(INITIAL_MAP_CANVAS_RUNTIME_STATE, {
    type: "adapter-started",
    adapterEpoch: 7,
  });
  state = reduceMapCanvasRuntimeState(state, {
    type: "style-lifecycle",
    adapterEpoch: 7,
    lifecycle: lifecycle("failed", 4),
  });
  state = {
    ...state,
    adapterReady: true,
    libraryFailed: true,
  };
  assert.equal(overlayFor(state), "failed");

  const staleAdapter = reduceMapCanvasRuntimeState(state, {
    type: "style-lifecycle",
    adapterEpoch: 6,
    lifecycle: lifecycle("ready", 99),
  });
  assert.equal(staleAdapter, state);
  assert.equal(overlayFor(staleAdapter), "failed");

  const staleGeneration = reduceMapCanvasRuntimeState(state, {
    type: "style-lifecycle",
    adapterEpoch: 7,
    lifecycle: lifecycle("ready", 3),
  });
  assert.equal(staleGeneration, state);
  assert.equal(overlayFor(staleGeneration), "failed");

  state = reduceMapCanvasRuntimeState(state, {
    type: "style-lifecycle",
    adapterEpoch: 7,
    lifecycle: lifecycle("ready", 4),
  });
  assert.equal(state.adapterReady, true);
  assert.equal(state.libraryFailed, false);
  assert.equal(overlayFor(state), null);

  const lateFailure = reduceMapCanvasRuntimeState(state, {
    type: "style-lifecycle",
    adapterEpoch: 7,
    lifecycle: lifecycle("failed", 4),
  });
  assert.equal(lateFailure, state);
  assert.equal(overlayFor(lateFailure), null);

  state = reduceMapCanvasRuntimeState(state, {
    type: "library-failed",
    adapterEpoch: 7,
  });
  assert.equal(overlayFor(state), "failed");
  state = reduceMapCanvasRuntimeState(state, {
    type: "retry-library",
    adapterEpoch: 7,
  });
  assert.equal(overlayFor(state), "loading");
  assert.equal(state.adapterReady, false);
  assert.equal(state.libraryFailed, false);

  state = reduceMapCanvasRuntimeState(state, {
    type: "adapter-started",
    adapterEpoch: 8,
  });
  state = reduceMapCanvasRuntimeState(state, {
    type: "style-lifecycle",
    adapterEpoch: 8,
    lifecycle: lifecycle("ready", 1),
  });
  assert.equal(overlayFor(state), null);

  const supersededReady = reduceMapCanvasRuntimeState(state, {
    type: "style-lifecycle",
    adapterEpoch: 7,
    lifecycle: lifecycle("ready", 100),
  });
  assert.equal(supersededReady, state);
  assert.equal(overlayFor(supersededReady), null);
});

test("style lifecycle clears stale failures only for ready current generations", () => {
  const host = globalThis as unknown as {
    window?: Window;
    document?: Document;
    getComputedStyle?: typeof getComputedStyle;
  };
  const previousWindow = host.window;
  const previousDocument = host.document;
  const previousGetComputedStyle = host.getComputedStyle;
  const timers = new Map<number, () => void>();
  let nextTimer = 1;
  const runNextTimer = () => {
    const next = [...timers.entries()].sort(([left], [right]) => left - right)[0];
    assert.ok(next);
    timers.delete(next[0]);
    next[1]();
  };
  const fakeWindow = {
    setTimeout: (callback: () => void) => {
      const id = nextTimer++;
      timers.set(id, callback);
      return id;
    },
    clearTimeout: (id: number) => {
      timers.delete(id);
    },
    mapboxgl: {
      accessToken: "",
      Map: FakeMap,
      Marker: class {},
      Popup: class {},
    },
  };
  host.window = fakeWindow as unknown as Window;
  host.document = { documentElement: {} } as unknown as Document;
  host.getComputedStyle = (() => ({
    getPropertyValue: () => "#007aff",
  })) as unknown as typeof getComputedStyle;

  try {
    const states: MapStyleLifecycleState[] = [];
    let canvasState: MapCanvasStyleState = INITIAL_MAP_CANVAS_STYLE_STATE;
    const adapter = new MapboxAdapter("test-token");
    adapter.setStyleLifecycleListener((state) => {
      states.push(state);
      canvasState = reduceMapCanvasStyleState(canvasState, state);
    });
    adapter.initialize({} as HTMLDivElement, { lat: 6.5, lng: 3.4 }, 14, "dark");
    const map = FakeMap.latest;
    assert.ok(map);
    assert.equal(map.listenerCount("style.load"), 1);
    assert.equal(map.listenerCount("idle"), 1);
    assert.equal(map.listenerCount("render"), 1);
    map.emitStyleLoad();
    assert.equal(states.at(-1)?.status, "ready");
    assert.equal(states.at(-1)?.theme, "dark");
    assert.equal(mapCanvasOverlay(true, false, canvasState), null);
    assert.equal(map.listenerCount("style.load"), 0);
    assert.equal(map.listenerCount("idle"), 0);
    assert.equal(map.listenerCount("render"), 0);

    adapter.setTheme("light");
    map.emitStyleLoad();
    assert.equal(states.at(-1)?.status, "ready");
    assert.equal(states.at(-1)?.theme, "light");

    adapter.setTheme("dark");
    const staleDarkListener = map.snapshotStyleListeners()[0];
    const staleDarkErrorListener = map.snapshotErrorListeners()[0];
    adapter.setTheme("light");
    staleDarkListener?.();
    assert.equal(states.at(-1)?.status, "loading");
    assert.equal(states.at(-1)?.theme, "light");
    const timersBeforeStaleError = timers.size;
    staleDarkErrorListener?.({ error: { message: "shader compile failed" } });
    assert.equal(
      timers.size,
      timersBeforeStaleError,
      "a queued old-theme error cannot arm recovery for the current generation"
    );
    map.emitError("shader compile failed");
    assert.equal(
      timers.size,
      timersBeforeStaleError + 1,
      "the current generation retains bounded renderer-error authority"
    );
    map.emitStyleLoad();
    assert.equal(states.at(-1)?.status, "ready");
    assert.equal(states.at(-1)?.theme, "light");

    adapter.setTheme("dark");
    map.emitStyleLoad();
    assert.equal(states.at(-1)?.status, "ready");
    assert.equal(states.at(-1)?.theme, "dark");
    adapter.setRoute([
      [3.3, 6.4],
      [3.4, 6.5],
    ]);
    assert.equal(map.getRouteReplayCount(), 1);

    // A failed light generation is replaced, and the successful dark
    // generation removes the old failure state.
    adapter.setTheme("light");
    map.setUsableStyleFrame(true);
    map.emitRender();
    assert.equal(
      states.at(-1)?.status,
      "loading",
      "a black painter pass with serialized layers is not a usable basemap"
    );
    runNextTimer();
    assert.equal(states.at(-1)?.status, "loading");
    map.setUsableStyleFrame(true);
    map.emitRender();
    assert.equal(states.at(-1)?.status, "loading");
    runNextTimer();
    assert.equal(states.at(-1)?.status, "failed");
    assert.equal(states.at(-1)?.theme, "light");
    assert.equal(mapCanvasOverlay(true, false, canvasState), "failed");
    adapter.setTheme("dark");
    assert.equal(states.at(-1)?.status, "loading");
    assert.equal(states.at(-1)?.theme, "dark");
    assert.equal(mapCanvasOverlay(true, false, canvasState), "loading");
    // Production Safari emitted render with a populated style while the
    // basemap remained solid black. That frame must not release Canvas's
    // fail-visible overlay; a mutation-safe current-style signal must.
    map.setStyleLoaded(false);
    map.setUsableStyleFrame(true);
    map.emitRender();
    assert.equal(states.at(-1)?.status, "loading");
    assert.equal(states.at(-1)?.theme, "dark");
    assert.equal(mapCanvasOverlay(true, false, canvasState), "loading");
    assert.equal(
      map.getRouteReplayCount(),
      1,
      "black render must not mutate a style that is not ready"
    );
    map.emitStyleLoad();
    assert.equal(states.at(-1)?.status, "ready");
    assert.equal(mapCanvasOverlay(true, false, canvasState), null);
    assert.equal(
      map.getRouteReplayCount(),
      2,
      "stored route replays when the retained mutation-safe listener fires"
    );

    // A late style.load from the final bounded generation remains recoverable.
    adapter.setTheme("light");
    runNextTimer();
    runNextTimer();
    assert.equal(states.at(-1)?.status, "failed");
    map.emitStyleLoad();
    assert.equal(states.at(-1)?.status, "ready");
    assert.equal(states.at(-1)?.theme, "light");

    // If the current style became loaded without its event being observed, the
    // timeout probe recognizes it before retrying or exposing failure.
    adapter.setTheme("dark");
    map.setStyleLoaded(true);
    runNextTimer();
    assert.equal(states.at(-1)?.status, "loading");
    map.setUsableStyleFrame(true);
    map.emitRender();
    assert.equal(states.at(-1)?.status, "ready");
    assert.equal(states.at(-1)?.theme, "dark");
    assert.equal(states.at(-1)?.attempt, 1);

    // A render is only ready once Mapbox's current-style probe agrees.
    adapter.setTheme("light");
    map.emitRender();
    assert.equal(states.at(-1)?.status, "loading");
    map.setStyleLoaded(true);
    map.setUsableStyleFrame(true);
    map.emitRender();
    assert.equal(states.at(-1)?.status, "ready");
    assert.equal(states.at(-1)?.theme, "light");

    // style.load is sufficient for a usable background and safe style
    // mutation even while normal slow tiles keep isStyleLoaded() false.
    const replayCountBeforeSlowTiles = map.getRouteReplayCount();
    adapter.setTheme("dark");
    map.emitStyleLoadBeforeTilesSettle();
    assert.equal(map.isStyleLoaded(), false);
    assert.equal(states.at(-1)?.status, "ready");
    assert.equal(states.at(-1)?.theme, "dark");
    assert.equal(mapCanvasOverlay(true, false, canvasState), null);
    assert.equal(
      map.getRouteReplayCount(),
      replayCountBeforeSlowTiles + 1,
      "normal slow tiles must not create a false style failure"
    );
    adapter.setTheme("light");
    map.emitStyleLoad();

    // Even an already-queued callback from a superseded generation cannot
    // clear the current generation's failure.
    adapter.setTheme("dark");
    const staleReadyListener = map.snapshotStyleListeners()[0];
    adapter.setTheme("light");
    runNextTimer();
    runNextTimer();
    assert.equal(states.at(-1)?.status, "failed");
    staleReadyListener?.();
    assert.equal(states.at(-1)?.status, "failed");
    assert.equal(states.at(-1)?.theme, "light");

    // Even mutation-safe and render events observed inside a setStyle call that
    // then throws have no installation authority. The latch and listeners must
    // be cleared before bounded retry and may never cover the failure.
    map.emitStyleLoad();
    map.setEmitStyleLoadInsideSetStyle(true);
    map.setEmitRenderBeforeRejectedSetStyle(true);
    map.setRejectStyleChanges(true);
    const statesBeforeRejectedInstall = states.length;
    adapter.setTheme("dark");
    const rejectedState = states.at(-1);
    assert.equal(rejectedState?.status, "failed");
    assert.equal(rejectedState.theme, "dark");
    assert.equal(rejectedState.attempt, 2);
    assert.equal(rejectedState.reason, "error");
    assert.equal(
      states.slice(statesBeforeRejectedInstall).some((state) => state.status === "ready"),
      false,
      "an event from a setStyle call that throws must never become ready"
    );
    assert.equal(map.listenerCount("style.load"), 0);
    assert.equal(map.listenerCount("idle"), 0);
    assert.equal(map.listenerCount("render"), 0);
    map.setEmitStyleLoadInsideSetStyle(false);
    map.setEmitRenderBeforeRejectedSetStyle(false);
    map.setRejectStyleChanges(false);
    adapter.retryStyle();
    assert.equal(states.at(-1)?.status, "loading");
    map.emitStyleLoad();
    assert.equal(states.at(-1)?.status, "ready");
    assert.equal(states.at(-1)?.theme, "dark");

    // A synchronous style.load emitted inside the active setStyle call is
    // causally owned by that replacement. Latch it, then consume it only after
    // setStyle returns successfully and authorizes mutation.
    map.setEmitStyleLoadInsideSetStyle(true);
    const replayCountBeforeSynchronousLoad = map.getRouteReplayCount();
    adapter.setTheme("light");
    assert.equal(states.at(-1)?.status, "loading");
    map.setUsableStyleFrame(true);
    map.emitRender();
    assert.equal(states.at(-1)?.status, "ready");
    assert.equal(states.at(-1)?.theme, "light");
    assert.equal(map.isStyleLoaded(), false);
    assert.equal(
      map.getRouteReplayCount(),
      replayCountBeforeSynchronousLoad + 1,
      "synchronous style.load must replay only after successful installation"
    );
    map.setEmitStyleLoadInsideSetStyle(false);

    // A synchronous or later render is non-authoritative when the current
    // style probe remains false, even if getStyle reports layers.
    const replayCountBeforeSynchronousRender = map.getRouteReplayCount();
    map.setEmitRenderInsideSetStyle(true);
    adapter.setTheme("dark");
    assert.equal(states.at(-1)?.status, "loading");
    assert.equal(states.at(-1)?.theme, "dark");
    assert.equal(map.isStyleLoaded(), false);
    map.setEmitRenderInsideSetStyle(false);
    map.emitRender();
    assert.equal(states.at(-1)?.status, "loading");
    assert.equal(states.at(-1)?.theme, "dark");
    assert.equal(mapCanvasOverlay(true, false, canvasState), "loading");
    assert.equal(
      map.getRouteReplayCount(),
      replayCountBeforeSynchronousRender,
      "render without mutation-safe readiness must not replay the route"
    );
    map.emitStyleLoad();
    assert.equal(states.at(-1)?.status, "ready");
    assert.equal(mapCanvasOverlay(true, false, canvasState), null);
    assert.equal(
      map.getRouteReplayCount(),
      replayCountBeforeSynchronousRender + 1,
      "mutation-safe style.load must still replay the retained route"
    );

    // Serialized layer presence is not an authority. A current render remains
    // pending until Mapbox confirms the current style is mutation-safe.
    adapter.setTheme("light");
    const currentLightRenderListener = map.snapshotRenderListeners()[0];
    map.setUsableStyleFrame(true);
    currentLightRenderListener?.();
    assert.equal(states.at(-1)?.status, "loading");
    assert.equal(states.at(-1)?.theme, "light");
    map.setStyleLoaded(true);
    currentLightRenderListener?.();
    assert.equal(states.at(-1)?.status, "ready");

    // An already-queued render closure from a superseded generation cannot
    // clear the replacement generation.
    adapter.setTheme("dark");
    const staleDarkRenderListener = map.snapshotRenderListeners()[0];
    adapter.setTheme("light");
    map.setUsableStyleFrame(true);
    staleDarkRenderListener?.();
    assert.equal(states.at(-1)?.status, "loading");
    assert.equal(states.at(-1)?.theme, "light");
    map.snapshotRenderListeners()[0]?.();
    assert.equal(states.at(-1)?.status, "loading");
    map.setStyleLoaded(true);
    map.snapshotRenderListeners()[0]?.();
    assert.equal(states.at(-1)?.status, "ready");
    assert.equal(states.at(-1)?.theme, "light");

    // Canvas rejects stale generations independently of Adapter cleanup, and a
    // same-generation late timeout cannot cover a proven usable frame.
    const currentGeneration = canvasState.generation;
    canvasState = reduceMapCanvasStyleState(canvasState, {
      status: "failed",
      generation: currentGeneration - 1,
      theme: "light",
      attempt: 2,
      reason: "timeout",
    });
    assert.equal(mapCanvasOverlay(true, false, canvasState), null);
    canvasState = reduceMapCanvasStyleState(canvasState, {
      status: "failed",
      generation: currentGeneration,
      theme: "dark",
      attempt: 2,
      reason: "timeout",
    });
    assert.equal(mapCanvasOverlay(true, false, canvasState), null);
    adapter.destroy();
  } finally {
    host.window = previousWindow;
    host.document = previousDocument;
    host.getComputedStyle = previousGetComputedStyle;
  }
});

test("confirmed WebGL failures reconstruct once, preserve state, and then fail visibly", () => {
  const host = globalThis as unknown as {
    window?: Window;
    document?: Document;
    getComputedStyle?: typeof getComputedStyle;
  };
  const previousWindow = host.window;
  const previousDocument = host.document;
  const previousGetComputedStyle = host.getComputedStyle;
  const timers = new Map<number, () => void>();
  let nextTimer = 1;
  const runNextTimer = () => {
    const next = [...timers.entries()].sort(([left], [right]) => left - right)[0];
    assert.ok(next, "expected a bounded lifecycle timer");
    timers.delete(next[0]);
    next[1]();
  };
  const fakeWindow = {
    setTimeout: (callback: () => void) => {
      const id = nextTimer++;
      timers.set(id, callback);
      return id;
    },
    clearTimeout: (id: number) => {
      timers.delete(id);
    },
    mapboxgl: {
      accessToken: "",
      Map: FakeMap,
      Marker: class {},
      Popup: class {},
    },
  };
  host.window = fakeWindow as unknown as Window;
  host.document = { documentElement: {} } as unknown as Document;
  host.getComputedStyle = (() => ({
    getPropertyValue: () => "#007aff",
  })) as unknown as typeof getComputedStyle;
  FakeMap.instances = [];
  FakeMap.latest = null;

  try {
    const states: MapStyleLifecycleState[] = [];
    let canvasState: MapCanvasStyleState = INITIAL_MAP_CANVAS_STYLE_STATE;
    const diagnostics = new Map<string, string>();
    const container = {
      setAttribute: (name: string, value: string) => diagnostics.set(name, value),
      removeAttribute: (name: string) => diagnostics.delete(name),
    };
    const adapter = new MapboxAdapter("test-token");
    adapter.setStyleLifecycleListener((state) => {
      states.push(state);
      canvasState = reduceMapCanvasStyleState(canvasState, state);
    });
    adapter.initialize(container as unknown as HTMLDivElement, { lat: 6.5, lng: 3.4 }, 14, "dark", {
      top: 12,
      right: 8,
      bottom: 120,
      left: 16,
    });
    const first = FakeMap.latest as FakeMap | null;
    assert.ok(first);
    adapter.setRoute([
      [3.4, 6.5],
      [3.5, 6.6],
    ]);

    // Slow tiles are not a false failure: mutation safety plus the subsequent
    // render makes the current generation usable before every tile settles.
    first.emitStyleLoadBeforeTilesSettle();
    assert.equal(first.isStyleLoaded(), false);
    assert.equal(states.at(-1)?.status, "ready");
    assert.equal(first.getRouteReplayCount(), 1);
    assert.equal(diagnostics.get("data-map-frame-evidence"), "visible");

    // WebGL1 fallback uses the context Mapbox already established instead of
    // treating a failed WebGL2 lookup as a missing renderer.
    adapter.setTheme("light");
    first.setContextType("webgl");
    first.emitStyleLoad();
    assert.equal(states.at(-1)?.status, "ready");
    assert.equal(states.at(-1)?.theme, "light");
    assert.equal(diagnostics.get("data-map-frame-evidence"), "visible");
    first.setContextType("webgl2");

    // Transparent, untouched and throwing readback remain read-error, never
    // black. A current render may still uncover the map because Safari's
    // default framebuffer is not preserved for diagnostic reads.
    const instancesBeforeAmbiguousReadback = FakeMap.instances.length;
    adapter.setTheme("dark");
    first.setFrameProbeMode("transparent");
    first.emitStyleLoad();
    assert.equal(states.at(-1)?.status, "ready");
    assert.equal(diagnostics.get("data-map-frame-evidence"), "read-error");

    adapter.setTheme("light");
    first.setFrameProbeMode("read-noop");
    first.emitStyleLoad();
    assert.equal(states.at(-1)?.status, "ready");
    assert.equal(diagnostics.get("data-map-frame-evidence"), "read-error");

    adapter.setTheme("dark");
    first.setFrameProbeMode("read-throw");
    first.emitStyleLoad();
    assert.equal(states.at(-1)?.status, "ready");
    assert.equal(diagnostics.get("data-map-frame-evidence"), "read-error");
    assert.equal(FakeMap.instances.length, instancesBeforeAmbiguousReadback);

    // A zero buffer cannot become usable from this render callback, but may be
    // transient layout state, so it fails recoverably without spending the
    // reconstruction.
    adapter.setTheme("light");
    first.setFrameProbeMode("zero-buffer");
    first.emitStyleLoad();
    assert.equal(states.at(-1)?.status, "loading");
    runNextTimer();
    const zeroBufferFailure = states.at(-1);
    assert.equal(zeroBufferFailure?.status, "failed");
    assert.equal(zeroBufferFailure?.status === "failed" ? zeroBufferFailure.reason : null, "probe");
    assert.equal(diagnostics.get("data-map-frame-evidence"), "zero-buffer");
    assert.equal(FakeMap.instances.length, instancesBeforeAmbiguousReadback);

    // Missing/throwing context inspection is categorical but never inferred as
    // black and cannot spend the single automatic reconstruction.
    adapter.retryStyle();
    first.setFrameProbeMode("context-unavailable");
    first.emitStyleLoad();
    runNextTimer();
    assert.equal(states.at(-1)?.status, "failed");
    assert.equal(diagnostics.get("data-map-frame-evidence"), "context-unavailable");
    assert.equal(FakeMap.instances.length, instancesBeforeAmbiguousReadback);

    adapter.retryStyle();
    first.setFrameProbeMode("gl-error");
    first.emitStyleLoad();
    runNextTimer();
    assert.equal(states.at(-1)?.status, "failed");
    assert.equal(diagnostics.get("data-map-frame-evidence"), "gl-error");
    assert.equal(FakeMap.instances.length, instancesBeforeAmbiguousReadback);

    adapter.retryStyle();
    first.setFrameProbeMode("visible");
    first.emitStyleLoad();
    assert.equal(states.at(-1)?.status, "ready");
    assert.equal(diagnostics.get("data-map-frame-evidence"), "visible");
    assert.equal(diagnostics.has("data-map-failure-reason"), false);

    // A restored context still needs a current rendered frame before recovery.
    const instanceCountBeforeRestore = FakeMap.instances.length;
    const routeReplaysBeforeRestore = first.getRouteReplayCount();
    first.loseContext();
    assert.equal(states.at(-1)?.status, "loading");
    first.restoreContext(false);
    assert.equal(states.at(-1)?.status, "loading");
    first.emitRender();
    assert.equal(states.at(-1)?.status, "ready");
    assert.equal(first.getRouteReplayCount(), routeReplaysBeforeRestore + 1);
    assert.equal(FakeMap.instances.length, instanceCountBeforeRestore);

    adapter.setCenter(6.55, 3.45);
    const placeMarker = new FakeMarker();
    const sharedMarker = new FakeMarker();
    const userMarker = new FakeMarker();
    const popup = new FakePopup();
    const internals = adapter as unknown as {
      markersMap: Map<string, FakeMarker>;
      sharedUserMarkers: Map<string, FakeMarker>;
      userMarker: FakeMarker | null;
      activeUserPopup: FakePopup | null;
    };
    internals.markersMap.set("place", placeMarker);
    internals.sharedUserMarkers.set("shared", sharedMarker);
    internals.userMarker = userMarker;
    internals.activeUserPopup = popup;
    first.setOnRemove(() => {
      // Model Mapbox Popup's close callback during old-Map teardown.
      internals.activeUserPopup = null;
    });

    // Two black renders from the same current generation corroborate a
    // genuinely black frame and consume the one bounded reconstruction.
    const routeReplayCountBeforeFailure = first.getRouteReplayCount();
    adapter.setTheme("dark");
    const staleRender = first.snapshotRenderListeners()[0];
    const staleContextLost = first.snapshotContextLostListeners()[0];
    first.setFrameProbeMode("black");
    first.emitBlackStyleLoad();
    assert.equal(states.at(-1)?.status, "loading");
    assert.equal(mapCanvasOverlay(true, false, canvasState), "loading");
    assert.equal(diagnostics.get("data-map-frame-evidence"), "pending");
    adapter.retryStyle();
    staleRender?.();
    assert.equal(
      diagnostics.get("data-map-frame-evidence"),
      "pending",
      "a stale generation cannot contribute black-frame corroboration"
    );
    first.emitBlackStyleLoad();
    assert.equal(
      diagnostics.get("data-map-frame-evidence"),
      "pending",
      "explicit retry resets black-frame corroboration"
    );
    first.emitBlackRender();
    assert.equal(diagnostics.get("data-map-frame-evidence"), "genuinely-black");
    assert.equal(
      first.getRouteReplayCount(),
      routeReplayCountBeforeFailure,
      "a retained route must wait for a subsequent usable render"
    );
    runNextTimer();
    const replacement = FakeMap.latest as FakeMap | null;
    assert.ok(replacement);
    assert.notEqual(replacement, first);
    assert.equal(first.wasRemoved(), true);
    assert.equal(first.totalLifecycleListenerCount(), 0);
    assert.deepEqual(replacement.getCenter(), { lng: 3.45, lat: 6.55 });
    assert.equal(replacement.getZoom(), 14);
    assert.equal(placeMarker.maps.at(-1), replacement);
    assert.equal(sharedMarker.maps.at(-1), replacement);
    assert.equal(userMarker.maps.at(-1), replacement);
    assert.equal(popup.maps.at(-1), replacement);
    assert.equal(internals.activeUserPopup, popup);
    const statesAfterReplacement = states.length;
    const evidenceAfterReplacement = diagnostics.get("data-map-frame-evidence");
    staleRender?.();
    staleContextLost?.();
    assert.equal(
      states.length,
      statesAfterReplacement,
      "removed-map callbacks cannot mutate the replacement generation"
    );
    assert.equal(
      diagnostics.get("data-map-frame-evidence"),
      evidenceAfterReplacement,
      "removed-map callbacks cannot overwrite current diagnostic evidence"
    );
    replacement.emitStyleLoad();
    assert.equal(states.at(-1)?.status, "ready");
    assert.equal(replacement.getRouteReplayCount(), 1);

    // A fresh theme episode gets one automatic reconstruction. If its
    // replacement also has a confirmed renderer failure, failure is visible
    // and there is no loop.
    adapter.setTheme("light");
    replacement.setFrameProbeMode("black");
    replacement.emitBlackStyleLoad();
    replacement.emitBlackRender();
    runNextTimer();
    const secondReplacement = FakeMap.latest as FakeMap | null;
    assert.ok(secondReplacement);
    assert.notEqual(secondReplacement, replacement);
    const countBeforeSecondFailure = FakeMap.instances.length;
    secondReplacement.setFrameProbeMode("black");
    secondReplacement.emitBlackStyleLoad();
    secondReplacement.emitBlackRender();
    runNextTimer();
    const failedState = states.at(-1);
    assert.equal(failedState?.status, "failed");
    assert.equal(failedState?.status === "failed" ? failedState.reason : null, "renderer");
    assert.equal(mapCanvasOverlay(true, false, canvasState), "failed");
    assert.equal(FakeMap.instances.length, countBeforeSecondFailure);
    // Explicit Retry starts a fresh bounded episode and therefore replaces the
    // failed WebGL context. A good replacement clears the visible failure.
    adapter.retryStyle();
    const retryReplacement = FakeMap.latest as FakeMap | null;
    assert.ok(retryReplacement);
    assert.notEqual(retryReplacement, secondReplacement);
    retryReplacement.emitStyleLoad();
    assert.equal(states.at(-1)?.status, "ready");
    assert.equal(mapCanvasOverlay(true, false, canvasState), null);

    // A lost context that never restores also consumes one bounded
    // reconstruction, rather than waiting forever.
    retryReplacement.loseContext();
    assert.equal(states.at(-1)?.status, "loading");
    runNextTimer();
    const lossReplacement = FakeMap.latest as FakeMap | null;
    assert.ok(lossReplacement);
    assert.notEqual(lossReplacement, retryReplacement);
    lossReplacement.emitStyleLoad();
    assert.equal(states.at(-1)?.status, "ready");

    const stateCountBeforeDestroy = states.length;
    adapter.destroy();
    assert.equal(lossReplacement.totalLifecycleListenerCount(), 0);
    assert.equal(timers.size, 0);
    assert.equal(diagnostics.has("data-map-frame-evidence"), false);
    assert.equal(diagnostics.has("data-map-failure-reason"), false);
    assert.equal(diagnostics.has("data-map-lifecycle"), false);
    lossReplacement.emitRender();
    lossReplacement.loseContext();
    assert.equal(states.length, stateCountBeforeDestroy);

    // A replacement constructor may itself fail while Safari is tearing down a
    // context. That failure is visible and bounded, but the preserved snapshot
    // lets an explicit Retry create a new Map without inventing camera state.
    const constructorStates: MapStyleLifecycleState[] = [];
    const constructorAdapter = new MapboxAdapter("test-token");
    constructorAdapter.setStyleLifecycleListener((state) => constructorStates.push(state));
    constructorAdapter.initialize({} as HTMLDivElement, { lat: 6.51, lng: 3.41 }, 13, "dark");
    const constructorMap = FakeMap.latest as FakeMap | null;
    assert.ok(constructorMap);
    constructorMap.loseContext();
    FakeMap.rejectNextConstruction = true;
    const countBeforeRejectedReplacement = FakeMap.instances.length;
    runNextTimer();
    assert.equal(constructorStates.at(-1)?.status, "failed");
    assert.equal(FakeMap.instances.length, countBeforeRejectedReplacement);
    assert.equal(timers.size, 0);

    constructorAdapter.retryStyle();
    const recoveredAfterConstructorFailure = FakeMap.latest as FakeMap | null;
    assert.ok(recoveredAfterConstructorFailure);
    assert.notEqual(recoveredAfterConstructorFailure, constructorMap);
    assert.equal(FakeMap.instances.length, countBeforeRejectedReplacement + 1);
    recoveredAfterConstructorFailure.emitStyleLoad();
    assert.equal(constructorStates.at(-1)?.status, "ready");
    constructorAdapter.destroy();
    assert.equal(timers.size, 0);

    // A synchronous remove failure must retain ownership of the old Map. Retry
    // tears that exact Map down before constructing a replacement, preventing
    // duplicate canvases and keeping destroy able to find the provider object.
    const removalStates: MapStyleLifecycleState[] = [];
    const removalAdapter = new MapboxAdapter("test-token");
    removalAdapter.setStyleLifecycleListener((state) => removalStates.push(state));
    removalAdapter.initialize({} as HTMLDivElement, { lat: 6.52, lng: 3.42 }, 12, "light");
    const removalMap = FakeMap.latest as FakeMap | null;
    assert.ok(removalMap);
    removalMap.loseContext();
    removalMap.setRejectNextRemove(true);
    const countBeforeRejectedRemoval = FakeMap.instances.length;
    runNextTimer();
    assert.equal(removalStates.at(-1)?.status, "failed");
    assert.equal(removalMap.wasRemoved(), false);
    assert.equal(FakeMap.instances.length, countBeforeRejectedRemoval);

    removalAdapter.retryStyle();
    const recoveredAfterRemovalFailure = FakeMap.latest as FakeMap | null;
    assert.ok(recoveredAfterRemovalFailure);
    assert.notEqual(recoveredAfterRemovalFailure, removalMap);
    assert.equal(removalMap.wasRemoved(), true);
    assert.equal(FakeMap.instances.length, countBeforeRejectedRemoval + 1);
    recoveredAfterRemovalFailure.emitStyleLoad();
    assert.equal(removalStates.at(-1)?.status, "ready");
    removalAdapter.destroy();
    assert.equal(timers.size, 0);
  } finally {
    host.window = previousWindow;
    host.document = previousDocument;
    host.getComputedStyle = previousGetComputedStyle;
  }
});

test("renderer readiness is render-bound, categorically diagnosed, epoch-bound and bounded", () => {
  const adapterSource = sources["src/integrations/maps/MapboxAdapter.ts"];
  const mutationBody =
    adapterSource.match(/private completeMutationSafeStyleAttempt[\s\S]*?\n  }\n\n  \/\*\*/)?.[0] ??
    "";
  const usableBody =
    adapterSource.match(/private completeUsableFrame[\s\S]*?\n  }\n\n  \/\*\*/)?.[0] ?? "";
  const frameTimeoutBody =
    adapterSource.match(/private handleStyleFrameTimeout[\s\S]*?\n  }\n\n  private/)?.[0] ?? "";
  assert.match(mutationBody, /this\.styleReady = true/);
  assert.doesNotMatch(mutationBody, /this\.styleUsable = true/);
  assert.match(mutationBody, /this\.applyCartography\(\)/);
  assert.doesNotMatch(mutationBody, /this\.applyRoute\(\)/);
  assert.match(mutationBody, /this\.armStyleFrameTimer/);
  assert.match(adapterSource, /private inspectFrameEvidence/);
  assert.match(adapterSource, /FRAME_READ_SENTINEL/);
  assert.match(adapterSource, /map\.getCanvas\(\)/);
  assert.match(adapterSource, /getContext\("webgl2"\)/);
  assert.match(adapterSource, /getContext\("webgl"\)/);
  assert.match(adapterSource, /gl\.isContextLost\(\)/);
  assert.match(adapterSource, /gl\.readPixels/);
  assert.match(adapterSource, /BLACK_FRAME_CORROBORATION_SAMPLES = 2/);
  assert.match(adapterSource, /STYLE_LOAD_TIMEOUT_MS = 5_000/);
  assert.match(adapterSource, /STYLE_LOAD_MAX_ATTEMPTS = 2/);
  assert.match(adapterSource, /"genuinely-black"/);
  assert.match(adapterSource, /"gl-error"/);
  assert.match(usableBody, /this\.recordFrameEvidence\(evidence\)/);
  assert.match(usableBody, /evidence === "pending"/);
  assert.match(usableBody, /evidence === "genuinely-black"/);
  assert.match(usableBody, /evidence === "context-unavailable"/);
  assert.match(usableBody, /evidence === "context-lost"/);
  assert.match(usableBody, /evidence === "zero-buffer"/);
  assert.match(usableBody, /this\.styleUsable = true;[\s\S]*this\.applyRoute\(\)/);
  assert.match(adapterSource, /data-map-frame-evidence/);
  assert.match(adapterSource, /data-map-failure-reason/);
  assert.doesNotMatch(adapterSource, /preserveDrawingBuffer\s*:\s*true/);
  assert.match(adapterSource, /map\.on\("webglcontextlost"/);
  assert.match(adapterSource, /map\.on\("webglcontextrestored"/);
  assert.match(adapterSource, /this\.currentMapIs\(map, epoch\)/);
  assert.match(adapterSource, /MAX_AUTOMATIC_MAP_RECONSTRUCTIONS = 1/);
  assert.match(frameTimeoutBody, /this\.contextLost/);
  assert.match(frameTimeoutBody, /this\.frameEvidence === "context-lost"/);
  assert.match(frameTimeoutBody, /this\.frameEvidence === "genuinely-black"/);
  assert.doesNotMatch(
    frameTimeoutBody.match(/const hasReconstructionEvidence[\s\S]*?;\n/)?.[0] ?? "",
    /context-unavailable|read-error|gl-error/
  );
  assert.match(adapterSource, /private reconstructMap/);
  assert.match(
    adapterSource,
    /this\.detachMapLifecycleListeners\(\);[\s\S]*map\.remove\(\);[\s\S]*this\.mapInstance = null/
  );
  assert.match(adapterSource, /marker\.addTo\(replacement\)/);
  assert.match(adapterSource, /snapshot\.popup\.addTo\(replacement\)/);
  assert.match(adapterSource, /bearing: snapshot\.camera\.bearing/);
  assert.match(adapterSource, /pitch: snapshot\.camera\.pitch/);
  assert.match(adapterSource, /this\.beginStyleAttempt\(theme, 1, false\)/);
  assert.match(adapterSource, /: "probe"/);
  assert.match(adapterSource, /handleStyleLoadTimeout\(generation, false\)/);
  assert.match(
    sources["src/design-system/components/MapboxCanvas.tsx"],
    /adapterRef\.current === adapter[\s\S]*type: "style-lifecycle"[\s\S]*adapterEpoch/
  );
  assert.match(
    sources["src/design-system/components/MapboxCanvas.tsx"],
    /event\.adapterEpoch !== current\.adapterEpoch[\s\S]*reduceMapCanvasStyleState/
  );
});
