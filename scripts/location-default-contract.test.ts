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
import {
  PRIMARY_LOCATION,
  SW_LAGOS_AREAS,
  SW_LAGOS_PLACES,
} from "../src/db/lagosSouthWest";
import {
  MapboxAdapter,
  type MapStyleLifecycleState,
} from "../src/integrations/maps/MapboxAdapter";
import {
  INITIAL_MAP_CANVAS_STYLE_STATE,
  mapCanvasOverlay,
  reduceMapCanvasStyleState,
  type MapCanvasStyleState,
} from "../src/design-system/components/MapboxCanvas";
import {
  disclosedRouteOrigin,
  isDisclosedRouteOriginAdmissible,
} from "../src/lib/directions";

function test(name: string, run: () => void) {
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
  assert.deepEqual(
    { lat: PRIMARY_LOCATION.lat, lng: PRIMARY_LOCATION.lng },
    festac.center
  );
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

for (const provenance of ["manual", "simulated", "device"] as const) {
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
    const merged = mergePersistedLocationState(
      migrated,
      useLocationStore.getState()
    );
    assert.deepEqual(merged.browsingLocation, legacy.position);
    assert.equal(merged.deviceLocation, null);
  });
}

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
  assert.equal(
    isDisclosedRouteOriginAdmissible(
      disclosed,
      now + ROUTE_ORIGIN_FRESH_MS + 1
    ),
    false
  );
  assert.equal(
    disclosedRouteOrigin(
      { ...location, capturedAt: now - ROUTE_ORIGIN_FRESH_MS - 1 },
      now
    ),
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
  const stalls = SW_LAGOS_PLACES.find(
    (place) => place.slug === "festac-24-road-stalls"
  );
  assert.ok(stalls);
  assert.deepEqual(stalls.location, { lat: 6.46408, lng: 3.27525 });
  assert.equal(stalls.verified, false);
});

const sources = Object.fromEntries(
  [
    "src/core/state/locationStore.ts",
    "src/core/state/globalStore.ts",
    "src/app/_components/LocationSheet.tsx",
    "src/app/page.tsx",
    "src/design-system/components/MapboxCanvas.tsx",
    "src/integrations/maps/MapboxAdapter.ts",
    "src/app/_components/GetItSheet.tsx",
    "src/lib/directions.ts",
    "src/app/actions.ts",
  ].map((path) => [path, readFileSync(join(process.cwd(), path), "utf8")])
);

test("the truthful vertical keeps concepts and persistence separate", () => {
  const store = sources["src/core/state/locationStore.ts"];
  const camera = sources["src/core/state/globalStore.ts"];
  const page = sources["src/app/page.tsx"];
  assert.match(store, /browsingLocation:\s*state\.browsingLocation/);
  assert.doesNotMatch(store, /deviceLocation:\s*state\.deviceLocation/);
  assert.match(store, /version:\s*3/);
  assert.match(camera, /cameraCenter:/);
  assert.doesNotMatch(camera, /\bmapCenter:/);
  assert.match(page, /sharedUsers=\{\[\]\}/);
  assert.match(page, /routeOrigin === null/);
  assert.doesNotMatch(page, /<GetItSheet[\s\S]{0,300}origin=\{/);
  assert.match(
    page,
    /setUserProfile\(null\);[\s\S]*if \(!cancelled\) setUserProfile\(profile\)/
  );
  assert.match(page, /return \(\) => \{\s*cancelled = true;/);
});

test("device identity, accuracy halo and route disclosure remain explicit", () => {
  const canvas = sources["src/design-system/components/MapboxCanvas.tsx"];
  const adapter = sources["src/integrations/maps/MapboxAdapter.ts"];
  const locationSheet = sources["src/app/_components/LocationSheet.tsx"];
  const page = sources["src/app/page.tsx"];
  const sheet = sources["src/app/_components/GetItSheet.tsx"];
  const directions = sources["src/lib/directions.ts"];
  assert.match(canvas, /useFreshDeviceLocation\(\)/);
  assert.match(locationSheet, /const freshDeviceLocation = useFreshDeviceLocation\(\)/);
  assert.doesNotMatch(locationSheet, /\bdeviceCoords\b/);
  assert.match(canvas, /adapter\.setUserPosition\(null\)/);
  assert.match(adapter, /const halo = document\.createElement\("span"\)/);
  assert.match(adapter, /const orb = document\.createElement\("span"\)/);
  assert.match(adapter, /image\.onload = \(\) => fallback\.remove\(\)/);
  assert.match(adapter, /image\.onerror = \(\) => image\.remove\(\)/);
  assert.match(adapter, /identityName === "Me" \? "Me"/);
  assert.ok(
    locationSheet.indexOf("recordDeviceLocation(deviceLocation)") <
      locationSheet.indexOf("await getCoverageForPoint"),
    "outside-coverage fixes must be retained before coverage lookup"
  );
  assert.match(
    page,
    /onLocate=\{\(deviceLocation\) => \{[\s\S]*recordDeviceLocation\(deviceLocation\)[\s\S]*setCameraCenter/
  );
  assert.doesNotMatch(
    page,
    /onLocate=\{\(deviceLocation\) => \{[\s\S]{0,500}setDeviceBrowsingLocation/
  );
  assert.match(sheet, /Choose what leaves WetinDey/);
  assert.match(sheet, /maximumAgeMs:\s*0/);
  assert.match(sheet, /handoff\(null\)/);
  assert.match(sheet, /onOriginDisclosed\?\.\(origin\)/);
  assert.match(
    sheet,
    /origin && isDisclosedRouteOriginAdmissible\(origin\) \? origin : null/
  );
  assert.match(
    directions,
    /!isDisclosedRouteOriginAdmissible\(origin\)/
  );
});

test("coordinate failures never interpolate precise values", () => {
  const actions = sources["src/app/actions.ts"];
  const getIt = sources["src/app/_components/GetItSheet.tsx"];
  assert.doesNotMatch(actions, /invalid search origin \$\{/);
  assert.doesNotMatch(actions, /Invalid coordinate: lat=/);
  assert.doesNotMatch(getIt, /invalid coordinate.*lat=\$\{/);
});

test("nearest coverage tie-breaks prefer neighbourhood then slug deterministically", () => {
  const actions = sources["src/app/actions.ts"];
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
        Number(right.type === "neighborhood") -
          Number(left.type === "neighborhood") ||
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

class FakeMap {
  static latest: FakeMap | null = null;
  private reportedStyle: string;
  private styleLoaded = false;
  private styleListeners = new Set<StyleListener>();
  private idleListeners = new Set<StyleListener>();
  private renderListeners = new Set<StyleListener>();
  private errorListeners = new Set<(event: unknown) => void>();
  private rejectStyleChanges = false;
  private usableStyleFrame = false;
  private emitStyleLoadInsideSetStyle = false;
  private mutationSafe = false;
  private routeSourcePresent = false;
  private routeLayerPresent = false;
  private routeReplayCount = 0;

  constructor(options: { style: string }) {
    this.reportedStyle = options.style;
    FakeMap.latest = this;
  }

  on(type: string, listener: StyleListener | ((event: unknown) => void)) {
    if (type === "style.load") this.styleListeners.add(listener as StyleListener);
    if (type === "idle") this.idleListeners.add(listener as StyleListener);
    if (type === "render") this.renderListeners.add(listener as StyleListener);
    if (type === "error")
      this.errorListeners.add(listener as (event: unknown) => void);
  }

  off(type: string, listener: StyleListener | ((event: unknown) => void)) {
    if (type === "style.load") this.styleListeners.delete(listener as StyleListener);
    if (type === "idle") this.idleListeners.delete(listener as StyleListener);
    if (type === "render") this.renderListeners.delete(listener as StyleListener);
    if (type === "error")
      this.errorListeners.delete(listener as (event: unknown) => void);
  }

  setStyle(style: string) {
    if (this.rejectStyleChanges) throw new Error("style rejected");
    this.reportedStyle = style;
    this.styleLoaded = false;
    this.usableStyleFrame = false;
    this.mutationSafe = false;
    this.routeSourcePresent = false;
    this.routeLayerPresent = false;
    if (this.emitStyleLoadInsideSetStyle) {
      // Model Mapbox's documented edge: style.load makes style mutation safe,
      // while isStyleLoaded can still remain false until sources settle.
      this.mutationSafe = true;
      for (const listener of [...this.styleListeners]) listener();
    }
  }

  getStyle() {
    return {
      name: this.reportedStyle.includes("dark-v11")
        ? "Mapbox Dark"
        : "Mapbox Streets",
      layers: this.usableStyleFrame
        ? [{ id: "background", type: "background" }]
        : [],
    };
  }

  snapshotStyleListeners(): StyleListener[] {
    return [...this.styleListeners];
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
  }

  setReportedTheme(theme: "light" | "dark") {
    this.reportedStyle = MapboxAdapter.styleFor(theme);
  }

  setEmitStyleLoadInsideSetStyle(emit: boolean) {
    this.emitStyleLoadInsideSetStyle = emit;
  }

  setRejectStyleChanges(reject: boolean) {
    this.rejectStyleChanges = reject;
  }

  emitStyleLoad() {
    this.styleLoaded = true;
    this.mutationSafe = true;
    for (const listener of [...this.styleListeners]) listener();
  }

  emitIdle() {
    for (const listener of [...this.idleListeners]) listener();
  }

  emitRender() {
    for (const listener of [...this.renderListeners]) listener();
  }

  triggerRepaint() {
    this.emitRender();
  }

  easeTo(_options: unknown) {}
  flyTo(_options: unknown) {}
  fitBounds(_bounds: unknown, _options: unknown) {}
  project(_coordinate: unknown) {
    return { x: 0, y: 0 };
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
    }
  }
  getLayer(id: string) {
    return id === "wetindey-route-line" && this.routeLayerPresent
      ? { id }
      : undefined;
  }
  removeLayer(id: string) {
    if (id === "wetindey-route-line") this.routeLayerPresent = false;
  }
  setPaintProperty(_layer: string, _name: string, _value: unknown) {
    if (!this.mutationSafe) throw new Error("Style is not done loading");
  }
  setLayoutProperty(_layer: string, _name: string, _value: unknown) {}
  setFilter(_layer: string, _filter: unknown) {}
  resize() {}
  remove() {}

  getRouteReplayCount() {
    return this.routeReplayCount;
  }
}

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
    adapter.initialize(
      {} as HTMLDivElement,
      { lat: 6.5, lng: 3.4 },
      14,
      "dark"
    );
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
    adapter.setTheme("light");
    staleDarkListener?.();
    assert.equal(states.at(-1)?.status, "loading");
    assert.equal(states.at(-1)?.theme, "light");
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
    runNextTimer();
    assert.equal(states.at(-1)?.status, "loading");
    runNextTimer();
    assert.equal(states.at(-1)?.status, "failed");
    assert.equal(states.at(-1)?.theme, "light");
    assert.equal(mapCanvasOverlay(true, false, canvasState), "failed");
    adapter.setTheme("dark");
    assert.equal(states.at(-1)?.status, "loading");
    assert.equal(states.at(-1)?.theme, "dark");
    assert.equal(mapCanvasOverlay(true, false, canvasState), "loading");
    const currentDarkListener = map.snapshotStyleListeners()[0];
    map.setReportedTheme("light");
    map.setStyleLoaded(true);
    currentDarkListener?.();
    assert.equal(states.at(-1)?.status, "loading");
    assert.equal(mapCanvasOverlay(true, false, canvasState), "loading");
    // Production Safari can render a valid current style while
    // isStyleLoaded() remains false. A populated current-generation frame must
    // release Canvas's stale failure overlay across the real callback reducer.
    map.setReportedTheme("dark");
    map.setStyleLoaded(false);
    map.setUsableStyleFrame(true);
    map.emitRender();
    assert.equal(states.at(-1)?.status, "ready");
    assert.equal(states.at(-1)?.theme, "dark");
    assert.equal(mapCanvasOverlay(true, false, canvasState), null);
    assert.equal(
      map.getRouteReplayCount(),
      1,
      "usable render must not mutate a style that is not ready"
    );
    map.emitStyleLoad();
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
    assert.equal(states.at(-1)?.status, "ready");
    assert.equal(states.at(-1)?.theme, "dark");
    assert.equal(states.at(-1)?.attempt, 1);

    // A render is only ready once Mapbox's current-style probe agrees.
    adapter.setTheme("light");
    map.emitRender();
    assert.equal(states.at(-1)?.status, "loading");
    map.setStyleLoaded(true);
    map.emitRender();
    assert.equal(states.at(-1)?.status, "ready");
    assert.equal(states.at(-1)?.theme, "light");

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

    // A synchronous rejection leaves the previous light style loaded. It must
    // still exhaust the requested dark generation's attempts rather than
    // mistaking the old style for a successful dark swap.
    map.emitStyleLoad();
    map.setRejectStyleChanges(true);
    adapter.setTheme("dark");
    const rejectedState = states.at(-1);
    assert.equal(rejectedState?.status, "failed");
    assert.equal(rejectedState.theme, "dark");
    assert.equal(rejectedState.attempt, 2);
    assert.equal(rejectedState.reason, "error");
    map.setRejectStyleChanges(false);
    adapter.retryStyle();
    assert.equal(states.at(-1)?.status, "loading");
    map.emitStyleLoad();
    assert.equal(states.at(-1)?.status, "ready");
    assert.equal(states.at(-1)?.theme, "dark");

    // Listeners exist before setStyle. A cached style may emit synchronously
    // while the install call is still on the stack; the event itself is gated,
    // latched, then consumed only after the successful return.
    map.setEmitStyleLoadInsideSetStyle(true);
    const replayCountBeforeSynchronousLoad = map.getRouteReplayCount();
    adapter.setTheme("light");
    assert.equal(states.at(-1)?.status, "ready");
    assert.equal(states.at(-1)?.theme, "light");
    assert.equal(mapCanvasOverlay(true, false, canvasState), null);
    assert.equal(map.isStyleLoaded(), false);
    assert.equal(
      map.getRouteReplayCount(),
      replayCountBeforeSynchronousLoad + 1,
      "synchronous mutation-safe event must replay route after successful return"
    );
    map.setEmitStyleLoadInsideSetStyle(false);

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

test("a valid final style generation can recover after bounded failure", () => {
  const adapterSource = sources["src/integrations/maps/MapboxAdapter.ts"];
  const timeoutBody =
    adapterSource.match(
      /private handleStyleLoadTimeout[\s\S]*?\n  }\n\n  \/\*\*/
    )?.[0] ?? "";
  assert.match(timeoutBody, /this\.recognizeLoadedStyle\([\s\S]*STYLE_LOAD_MAX_ATTEMPTS/);
  assert.match(adapterSource, /handleStyleLoadTimeout\(generation, false\)/);
  assert.match(timeoutBody, /this\.clearStyleReadinessListeners\(\);[\s\S]*beginStyleAttempt/);
  assert.doesNotMatch(
    timeoutBody,
    /this\.clearStyleReadinessListeners\(\);\s*\n\s*this\.emitStyleLifecycle/
  );
  assert.match(adapterSource, /generation !== this\.styleGeneration/);
  assert.match(adapterSource, /map\.on\("idle", readyListener\)/);
  assert.match(adapterSource, /map\.on\("render", renderListener\)/);
  assert.match(adapterSource, /recognizeUsableStyleFrame\(generation, theme, attempt\)/);
  assert.match(adapterSource, /this\.styleInstalledGeneration === generation/);
  assert.match(adapterSource, /this\.styleMatchesTheme\(theme\)/);
  assert.match(adapterSource, /this\.pendingMutationSafeGeneration = generation/);
  assert.match(
    adapterSource,
    /this\.pendingMutationSafeGeneration === generation[\s\S]*completeMutationSafeStyleAttempt/
  );
  assert.match(
    adapterSource,
    /map\.on\("style\.load", readyListener\)[\s\S]*map\.setStyle/
  );
  assert.match(
    sources["src/design-system/components/MapboxCanvas.tsx"],
    /setStyleState\(\(current\) =>[\s\S]*reduceMapCanvasStyleState\(current, state\)/
  );
  assert.match(adapterSource, /private styleMatchesTheme/);
});
