// src/app/sw.ts
var CACHE_VERSION = "v2";
var STATIC_CACHE = `static-${CACHE_VERSION}`;
var IMAGE_CACHE = `images-${CACHE_VERSION}`;
var HEAVY_LIBS_CACHE = "heavy-libs-v1";
var STATIC_ASSETS = [
  "/icon-192x192.png",
  "/icon-512x512.png",
  "/favicon.png",
  "/bg-grid.svg"
];
self.addEventListener("install", (event) => {
  console.log("[SW] Installing service worker...");
  event.waitUntil((async () => {
    const cache = await caches.open(STATIC_CACHE);
    await cache.addAll(STATIC_ASSETS);
    await self.skipWaiting();
  })());
});
self.addEventListener("activate", (event) => {
  console.log("[SW] Activating service worker...");
  event.waitUntil((async () => {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.filter((name) => name !== STATIC_CACHE && name !== IMAGE_CACHE && name !== HEAVY_LIBS_CACHE).map((name) => {
      console.log("[SW] Deleting old cache:", name);
      return caches.delete(name);
    }));
    await self.clients.claim();
  })());
});
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== "GET") {
    return;
  }
  if (!url.protocol.startsWith("http")) {
    return;
  }
  event.respondWith((async () => {
    try {
      if (request.mode === "navigate" || url.pathname.startsWith("/api/") || request.headers.get("accept")?.includes("text/html")) {
        return await fetch(request);
      }
      if (request.destination === "image" || /\.(jpg|jpeg|png|gif|svg|webp|ico)$/i.test(url.pathname)) {
        return await cacheFirstStrategy(request, IMAGE_CACHE);
      }
      if (request.destination === "script" || request.destination === "style" || request.destination === "font" || /\.(js|css|woff|woff2|ttf|eot)$/i.test(url.pathname)) {
        return await cacheFirstStrategy(request, STATIC_CACHE);
      }
      return await fetch(request);
    } catch (error) {
      console.error("[SW] Fetch error:", error);
      const cachedResponse = await caches.match(request);
      if (cachedResponse) {
        return cachedResponse;
      }
      throw error;
    }
  })());
});
async function cacheFirstStrategy(request, cacheName) {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(cacheName);
      const responseToCache = networkResponse.clone();
      await cache.put(request, responseToCache);
    }
    return networkResponse;
  } catch (error) {
    console.error("[SW] Cache-first strategy failed:", error);
    throw error;
  }
}
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
  if (event.data && event.data.type === "CLEAR_CACHE") {
    event.waitUntil((async () => {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map((name) => caches.delete(name)));
    })());
  }
  if (event.data && event.data.type === "PRELOAD_HEAVY_LIBS") {
    console.log("[SW] Preloading heavy libraries...");
    event.waitUntil((async () => {
      try {
        const cache = await caches.open(STATIC_CACHE);
        const requests = await cache.keys();
        const heavyLibUrls = [];
        for (const request of requests) {
          const url = new URL(request.url);
          if (url.pathname.includes("framer-motion") || url.pathname.includes("pdfkit") || url.pathname.includes("blob-stream")) {
            heavyLibUrls.push(request.url);
          }
        }
        if (heavyLibUrls.length === 0) {
          console.log("[SW] No heavy library chunks found yet");
          return;
        }
        const heavyCache = await caches.open(HEAVY_LIBS_CACHE);
        await Promise.all(heavyLibUrls.map(async (url) => {
          try {
            const response = await fetch(url);
            if (response.ok) {
              await heavyCache.put(url, response);
              console.log("[SW] Cached heavy lib:", url);
            }
          } catch (error) {
            console.error("[SW] Failed to cache:", url, error);
          }
        }));
        console.log(`[SW] Preloaded ${heavyLibUrls.length} heavy library chunks`);
      } catch (error) {
        console.error("[SW] Preload failed:", error);
      }
    })());
  }
});
