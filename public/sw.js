// Hand-rolled service worker. Dependency-free (AGENTS §1).
//
// Caching strategy (the important part): NETWORK-FIRST for navigations / HTML, CACHE-FIRST
// for everything else. The previous version was cache-first for index.html too, which meant a
// returning visitor was served the first-cached HTML forever — and that HTML points at the
// OLD content-hashed JS bundle, so new deploys never appeared. HTML must come from the network
// so each deploy is picked up; the cached copy is only the OFFLINE fallback. Hashed assets
// (index-<hash>.js etc.) are immutable — their URL changes when content changes — so caching
// them first is both safe and fast. Bump CACHE on any strategy change to purge stale clients.

const CACHE = "timetable-studio-v2";
const SHELL = ["./", "./index.html", "./manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const isNavigation =
    req.mode === "navigate" || (req.headers.get("accept") || "").includes("text/html");

  if (isNavigation) {
    // Network-first: always try the live HTML so a new deploy loads; refresh the offline
    // fallback on success; fall back to the cached shell only when the network is unavailable.
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put("./index.html", copy));
          return res;
        })
        .catch(() => caches.match(req).then((c) => c || caches.match("./index.html"))),
    );
    return;
  }

  // Everything else (content-hashed assets, manifest): cache-first + runtime caching.
  event.respondWith(
    caches.match(req).then(
      (cached) =>
        cached ||
        fetch(req)
          .then((res) => {
            if (res && res.status === 200 && res.type === "basic") {
              const copy = res.clone();
              caches.open(CACHE).then((c) => c.put(req, copy));
            }
            return res;
          })
          .catch(() => undefined),
    ),
  );
});
