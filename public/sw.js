// Bump to invalidate everything from the previous strategy.
const CACHE_NAME = "wetindey-cache-v3";
const OFFLINE_URL = "/offline.html";

// Only assets that are safe to serve stale. The HTML shell is deliberately NOT
// in this list — see the fetch handler.
const ASSETS_TO_CACHE = [
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/manifest.webmanifest",
  OFFLINE_URL
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_TO_CACHE))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(names.map((n) => (n !== CACHE_NAME ? caches.delete(n) : undefined)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  // Next.js fingerprints these filenames, so they are immutable and safe to
  // cache forever. Let the browser's own HTTP cache handle them.
  if (url.pathname.startsWith("/_next/static/")) return;

  /**
   * NAVIGATIONS ARE NETWORK-FIRST. This is load-bearing, not a preference.
   *
   * The HTML shell embeds the hashed URLs of the JS chunks for the build that
   * produced it. Serving that HTML from cache after a new deploy hands the
   * browser a document pointing at chunk filenames that no longer exist: every
   * script 404s and the app renders as a blank page, with no error, until the
   * cache happens to be invalidated. The previous version of this worker was
   * cache-first for all GETs and did exactly that.
   *
   * So: always try the network for a document, and fall back to the cache only
   * when the network genuinely cannot be reached — which is the case the
   * offline shell exists for.
   */
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(event.request);
          return cached || caches.match(OFFLINE_URL);
        })
    );
    return;
  }

  // Everything else (icons, manifest, images): cache-first is fine — these are
  // content-addressed or change rarely, and none of them can strand the app.
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((response) => {
          if (response && response.status === 200 && response.type === "basic") {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => Promise.reject(new Error("Offline and not cached")));
    })
  );
});
