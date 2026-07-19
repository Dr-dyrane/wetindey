/**
 * WetinDey service worker.
 *
 * This app is for Lagos. The network is the product's operating condition, not
 * an error path, so every branch below is written against a connection that is
 * slow, intermittent, or attached-but-dead — not against "online vs offline".
 *
 * Cache strategy is per asset class, because the classes have genuinely
 * different invalidation rules:
 *
 *   documents        network-first, 8s timeout, cache fallback  (see below)
 *   /_next/static    cache-first, immutable  (content-addressed by Next)
 *   shell assets     cache-first  (icons, manifest, offline page)
 *   item photos      cache-first, immutable  (Wikimedia Commons, cross-origin)
 *   mapbox library   cache-first, immutable  (version-pinned URL)
 *   mapbox style     cache-first with a 30-day ceiling  (style/sprite/glyphs)
 *   mapbox /v4/      NOT touched — mapbox-gl caches its own tiles, see below
 *   /api/, non-GET   never touched  (server actions must reach the server)
 */

const VERSION = "v5";

// Everything we create is namespaced, because Cache Storage is shared per
// origin and mapbox-gl-js keeps its own bucket here. The activate sweep uses
// this prefix to know what is ours to delete.
const CACHE_PREFIX = "wetindey-";

// Split by lifetime, not by convenience. Bumping VERSION must not evict the
// photos and map data that are still perfectly valid — that would be the worst
// possible thing to do to a metered connection.
const SHELL_CACHE = `${CACHE_PREFIX}shell-${VERSION}`;
const STATIC_CACHE = `${CACHE_PREFIX}static-${VERSION}`;
const PHOTO_CACHE = `${CACHE_PREFIX}photos-v1`;
const MAP_CACHE = `${CACHE_PREFIX}map-v1`;
// The mapbox library is kept apart from map data on purpose: MAP_CACHE is
// trimmed FIFO, and the one asset that must never be evicted by a minute of
// panning is the code that draws the map.
const LIB_CACHE = `${CACHE_PREFIX}lib-v1`;

const KEEP_CACHES = [SHELL_CACHE, STATIC_CACHE, PHOTO_CACHE, MAP_CACHE, LIB_CACHE];

const OFFLINE_URL = "/offline.html";

// The HTML shell is deliberately NOT in this list — see the fetch handler.
const SHELL_ASSETS = [
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/manifest.webmanifest",
  OFFLINE_URL
];

// Entry ceilings. Cache Storage eviction is all-or-nothing per origin when the
// browser decides quota is tight, so staying well under it is how the photos
// survive. Trimming is FIFO over cache.keys(), which is insertion order — after
// a deploy that evicts the previous build's chunks first, which is what we want.
const LIMITS = {
  [STATIC_CACHE]: 160,
  [PHOTO_CACHE]: 80,
  // Style, sprites and glyph ranges only — tiles belong to mapbox-gl's own
  // cache, so this stays small and does not grow as the user pans.
  [MAP_CACHE]: 60
};

// Mapbox's terms permit temporary local caching of map content but not
// indefinite retention. 30 days is the ceiling enforced here.
const MAP_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const CACHED_AT_HEADER = "x-wetindey-cached-at";

const NAVIGATION_TIMEOUT_MS = 8000;

const MAPBOX_HOST = "api.mapbox.com";
const PHOTO_HOST = "upload.wikimedia.org";

// -----------------------------------------------------------------------------
// Lifecycle
// -----------------------------------------------------------------------------

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names.map((n) => {
            /**
             * Delete only caches that are ours to delete.
             *
             * The origin's Cache Storage is shared. mapbox-gl-js keeps its tile
             * cache here too, under "mapbox-tiles" — a blanket
             * "delete everything not in KEEP_CACHES" silently wiped the map
             * library's own cache on every worker update, forcing a full tile
             * re-download on exactly the connection we are trying to protect.
             * Namespace the sweep instead of assuming we are alone.
             */
            if (!n.startsWith(CACHE_PREFIX)) return undefined;
            return KEEP_CACHES.includes(n) ? undefined : caches.delete(n);
          })
        )
      )
      .then(() => self.clients.claim())
  );
});

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

/**
 * Keep a cache under its ceiling, oldest-inserted first.
 */
async function trim(cacheName) {
  const limit = LIMITS[cacheName];
  if (!limit) return;
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length <= limit) return;
  await Promise.all(keys.slice(0, keys.length - limit).map((k) => cache.delete(k)));
}

async function putAndTrim(cacheName, request, response) {
  const cache = await caches.open(cacheName);
  await cache.put(request, response);
  await trim(cacheName);
}

/**
 * `caches.match(req, { cacheName })` rejects with NotFoundError when that cache
 * has not been created yet, which is the state every one of these is in on a
 * first run. Opening it first creates it and makes the miss an ordinary miss.
 */
async function matchIn(cacheName, request) {
  const cache = await caches.open(cacheName);
  return cache.match(request);
}

/**
 * A cached document is only an offline shell when the code that boots it is
 * cached with it.
 *
 * Next emits deployment-specific script and stylesheet URLs into the HTML.
 * The shell and static caches span deployments, so the presence of an HTML
 * response alone says nothing about whether those exact assets survived. A
 * timeout used to return that response unconditionally: Safari then painted an
 * empty document while its missing bootstrap chunks failed out of sight.
 *
 * Parse only literal script/link attributes. Those are the browser's critical
 * requests; escaped copies inside the RSC payload are data, not another asset
 * dependency. Fail closed unless the document names at least one script and
 * one stylesheet and every same-origin `/_next/static` URL is present.
 */
function criticalStaticAssets(html, documentUrl) {
  const urls = new Set();
  let hasScript = false;
  let hasStylesheet = false;
  const tagPattern = /<(script|link)\b[^>]*?\b(?:src|href)=["']([^"']+)["'][^>]*>/gi;

  for (const match of html.matchAll(tagPattern)) {
    let asset;
    try {
      asset = new URL(match[2], documentUrl);
    } catch {
      continue;
    }

    if (asset.origin !== documentUrl.origin) continue;
    if (!asset.pathname.startsWith("/_next/static/")) continue;

    if (asset.pathname.endsWith(".js")) hasScript = true;
    else if (asset.pathname.endsWith(".css")) hasStylesheet = true;
    else continue;

    urls.add(asset.href);
  }

  return {
    urls: Array.from(urls),
    hasScript,
    hasStylesheet
  };
}

async function isCompleteNavigation(response, requestUrl) {
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.toLowerCase().includes("text/html")) return false;

  const documentUrl = new URL(response.url || requestUrl);
  const assets = criticalStaticAssets(await response.clone().text(), documentUrl);
  if (!assets.hasScript || !assets.hasStylesheet) return false;

  const cache = await caches.open(STATIC_CACHE);
  const matches = await Promise.all(assets.urls.map((url) => cache.match(url)));
  return matches.every(Boolean);
}

async function matchCompleteNavigation(cache, request) {
  try {
    const candidates = [await cache.match(request), await cache.match("/")];

    for (const candidate of candidates) {
      if (candidate && (await isCompleteNavigation(candidate, request.url))) {
        return candidate;
      }
    }
  } catch {
    // A corrupt response or unavailable Cache Storage is not proof of a shell.
  }

  return undefined;
}

/**
 * Cache-first for same-origin content that cannot change under a given URL.
 * Same-origin responses are `basic`, so `.ok` is readable and an error never
 * gets stored.
 */
async function immutableFirst(event, cacheName) {
  const cached = await matchIn(cacheName, event.request);
  if (cached) return cached;

  const response = await fetch(event.request);
  if (response && response.ok) {
    event.waitUntil(putAndTrim(cacheName, event.request, response.clone()));
  }
  return response;
}

/**
 * Cache-first for cross-origin content that is immutable at its URL.
 *
 * The subtlety that makes this its own function: a browser-initiated
 * cross-origin subresource load — `<img src>`, `<script src>`, `<link
 * rel=stylesheet>` with no `crossorigin` attribute — is a `no-cors` request,
 * and its response is OPAQUE. An opaque response reports `status: 0`, so
 * `response.ok` is FALSE for a perfectly good 200, and a naive `if
 * (response.ok)` caches nothing at all while looking entirely correct. The
 * mirror-image trap is caching the opaque response blind, which stores a 404
 * forever because you cannot see that it was a 404.
 *
 * Both hosts we care about send `Access-Control-Allow-Origin: *`, so we re-issue
 * the request as CORS and get a real, readable status to decide on. A CORS
 * response satisfies a no-cors request, so the <img>/<script> is happy either
 * way. If the CORS attempt fails we fall back to the request as it arrived and
 * simply do not cache what we could not vet.
 */
async function immutableCrossOrigin(event, cacheName) {
  const cached = await matchIn(cacheName, event.request);
  if (cached) return cached;

  try {
    const corsRequest = new Request(event.request.url, {
      mode: "cors",
      credentials: "omit"
    });
    const response = await fetch(corsRequest);
    if (response && response.ok) {
      event.waitUntil(putAndTrim(cacheName, event.request, response.clone()));
      return response;
    }
    // A real, readable error — a 404 on a thumbnail width Wikimedia will not
    // render, say. Pass it through so the consumer's own error path fires
    // (ItemCard has one), and cache nothing.
    return response;
  } catch {
    try {
      return await fetch(event.request);
    } catch {
      return Response.error();
    }
  }
}

// -----------------------------------------------------------------------------
// Fetch
// -----------------------------------------------------------------------------

self.addEventListener("fetch", (event) => {
  // Server actions are POSTs. They must never be intercepted: a queued price
  // report replaying on reconnect has to reach the database, and the offline
  // queue in the app depends on the request genuinely failing when it fails.
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);

  if (url.origin === self.location.origin) {
    if (url.pathname.startsWith("/api/")) return;

    if (event.request.mode === "navigate") {
      event.respondWith(handleNavigate(event));
      return;
    }

    /**
     * Next fingerprints these filenames with a content hash, so a given URL's
     * bytes never change. Previously this was left to the browser's HTTP cache.
     * That is not good enough here: the HTTP cache is evictable and offers no
     * offline guarantee, so a user who went offline could get the cached HTML
     * shell whose chunks had been evicted — a blank page, the exact failure the
     * navigation rule below exists to prevent, arriving by another door.
     * Caching them explicitly means a cached shell always has the code it names.
     */
    if (url.pathname.startsWith("/_next/static/")) {
      /**
       * Except HMR payloads. `next dev` mints a throwaway
       * /_next/static/webpack/*.hot-update.js on every edit; each is fetched
       * exactly once and is worthless a second later. Storing them would let a
       * long dev session FIFO-evict the real chunks out from under the cache
       * ceiling — filling an offline cache with garbage that is never served.
       */
      if (url.pathname.startsWith("/_next/static/webpack/")) return;
      event.respondWith(immutableFirst(event, STATIC_CACHE));
      return;
    }

    event.respondWith(handleShellAsset(event));
    return;
  }

  // --- cross-origin ---------------------------------------------------------

  /**
   * Item photography: Wikimedia Commons thumbnails, ~53KB each, at a URL that
   * encodes the file revision and the rendered width. Immutable in practice.
   * ItemCard renders them unoptimized, so they do not pass through
   * /_next/image and arrive here as plain no-cors <img> loads.
   */
  if (url.hostname === PHOTO_HOST) {
    event.respondWith(immutableCrossOrigin(event, PHOTO_CACHE));
    return;
  }

  if (url.hostname === MAPBOX_HOST) {
    // The library is version-pinned in the URL (/mapbox-gl-js/v3.1.2/…), so it
    // is immutable — and at 1.27MB of JS plus 36KB of CSS it is the single
    // largest item on the cold-start critical path over a Lagos connection.
    if (url.pathname.startsWith("/mapbox-gl-js/")) {
      event.respondWith(immutableCrossOrigin(event, LIB_CACHE));
      return;
    }

    /**
     * Vector tiles are mapbox-gl's own business, and we must not touch them.
     *
     * mapbox-gl-js already caches every /v4/ tile in a Cache Storage bucket it
     * owns, named "mapbox-tiles", with expiry driven by the Cache-Control the
     * tile came with. Caching them here too was verified to produce a 100%
     * duplicate: four tiles on screen, the same four in both caches, every byte
     * stored twice on a phone that has no bytes to spare — and a second,
     * dumber expiry policy competing with the library's correct one.
     *
     * It also puts the retention question back where it belongs: tiles are
     * cached by Mapbox's own code under Mapbox's own terms, not by us.
     */
    if (url.pathname.startsWith("/v4/")) return;

    /**
     * Telemetry and billing session beacons. Never cache these: serving a
     * session endpoint from cache means suppressing a real request and
     * replaying a stale session, which corrupts usage accounting. It is not
     * ours to answer.
     */
    if (url.pathname.startsWith("/map-sessions/") || url.pathname.startsWith("/events/")) {
      return;
    }

    // What is left is what mapbox-gl does NOT cache and cannot draw without:
    // the style document, sprites, and glyph ranges. Small, bounded, and the
    // difference between a basemap and a grey rectangle on a dead link.
    event.respondWith(handleMapData(event));
    return;
  }

  // Anything else cross-origin (analytics, etc.) goes straight to the network.
});

/**
 * NAVIGATIONS ARE NETWORK-FIRST. This is load-bearing, not a preference.
 *
 * The HTML shell embeds the hashed URLs of the JS chunks for the build that
 * produced it. Serving that HTML from cache after a new deploy hands the
 * browser a document pointing at chunk filenames that no longer exist: every
 * script 404s and the app renders as a blank page, with no error, until the
 * cache happens to be invalidated. An older version of this worker was
 * cache-first for all GETs and did exactly that.
 *
 * So: always try the network for a document, and the network's answer always
 * wins if it arrives. Two things are added on top, neither of which weakens
 * that ordering:
 *
 *  1. A timeout. "Offline" in Lagos is usually not `fetch` rejecting — it is an
 *     attached interface with no throughput, where `fetch` simply never
 *     settles. Without a deadline the user gets a white screen for as long as
 *     they are willing to stare at it, and the fallback below never runs. The
 *     timeout only ever *falls back*; the network response is still awaited and
 *     still written to the cache for next time.
 *  2. Only OK responses are cached. Caching a 404 or a 502 body meant that once
 *     the origin hiccuped, the error page became the offline experience.
 */
async function handleNavigate(event) {
  const cachePromise = caches.open(SHELL_CACHE);
  const network = fetch(event.request);

  /**
   * Register the cache write while the fetch event is still active. Calling
   * `waitUntil` only after a late response arrives is too late when a complete
   * cached shell has already won the race and settled `respondWith`.
   */
  event.waitUntil(
    Promise.all([cachePromise, network])
      .then(([cache, response]) =>
        response && response.ok
          ? cache.put(event.request, response.clone())
          : undefined
      )
      .catch(() => undefined)
  );

  // Surface the failure to the race, but never as an unhandled rejection.
  const networkOrNull = network.catch(() => null);
  const cache = await cachePromise;

  let timer;
  const deadline = new Promise((resolve) => {
    timer = setTimeout(() => resolve("timeout"), NAVIGATION_TIMEOUT_MS);
  });

  try {
    const winner = await Promise.race([networkOrNull, deadline]);
    if (winner && winner !== "timeout") return winner;

    // Network was too slow or unreachable. A document is not a fallback unless
    // every same-origin Next script and stylesheet it names is also cached.
    const cached = await matchCompleteNavigation(cache, event.request);
    if (cached) return cached;

    if (winner === "timeout") {
      // No complete shell exists. The network is still in flight, so keep
      // waiting rather than returning HTML that cannot boot.
      const late = await networkOrNull;
      if (late) return late;
    }

    // A genuine network failure with no complete shell has one truthful answer.
    return (await cache.match(OFFLINE_URL)) || Response.error();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Icons, the manifest, the offline page. Cache-first: they change rarely and
 * none of them can strand the app the way a stale document can.
 */
async function handleShellAsset(event) {
  const cached = await matchIn(SHELL_CACHE, event.request);
  if (cached) return cached;

  try {
    const response = await fetch(event.request);
    if (response && response.ok && response.type === "basic") {
      event.waitUntil(putAndTrim(SHELL_CACHE, event.request, response.clone()));
    }
    return response;
  } catch {
    return Response.error();
  }
}

/**
 * Mapbox style documents, sprites and glyph ranges. NOT tiles — see the /v4/
 * bail-out in the fetch handler.
 *
 * Cache-first, because on a bad link a basemap that draws from cache is the
 * difference between a map and a grey rectangle, and these URLs are stable.
 * Bounded by MAP_MAX_AGE_MS, since Mapbox's terms allow temporary caching of
 * map content but not permanent retention.
 *
 * The age is stamped on the way in — Cache Storage keeps no insertion time of
 * its own, and Mapbox's own Cache-Control is about their CDN, not our ceiling.
 */
async function handleMapData(event) {
  const cached = await matchIn(MAP_CACHE, event.request);
  if (cached && !isExpired(cached)) return cached;

  try {
    const response = await fetch(event.request);
    if (response && response.ok) {
      event.waitUntil(
        stamp(response.clone()).then((stamped) =>
          putAndTrim(MAP_CACHE, event.request, stamped)
        )
      );
    }
    return response;
  } catch {
    // Past its ceiling but the network is gone: an old tile beats no tile, and
    // the ceiling is about retention, not about correctness of what we hold.
    if (cached) return cached;
    return Response.error();
  }
}

function isExpired(response) {
  const at = Number(response.headers.get(CACHED_AT_HEADER));
  if (!at) return false;
  return Date.now() - at > MAP_MAX_AGE_MS;
}

/**
 * Response headers are immutable once constructed, so recording the insertion
 * time means rebuilding the response around its own body.
 */
async function stamp(response) {
  const body = await response.blob();
  const headers = new Headers(response.headers);
  headers.set(CACHED_AT_HEADER, String(Date.now()));
  return new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}
