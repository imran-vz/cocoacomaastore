/// <reference lib="webworker" />
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
const CACHE_VERSION = "v2";
const STATIC_CACHE = `static-${CACHE_VERSION}`;
const IMAGE_CACHE = `images-${CACHE_VERSION}`;
const HEAVY_LIBS_CACHE = "heavy-libs-v1";
// Static assets to cache on install
const STATIC_ASSETS = [
    "/icon-192x192.png",
    "/icon-512x512.png",
    "/favicon.svg",
    "/bg-grid.svg",
];
// Install event - cache static assets
self.addEventListener("install", (event) => {
    console.log("[SW] Installing service worker...");
    event.waitUntil((() => __awaiter(void 0, void 0, void 0, function* () {
        const cache = yield caches.open(STATIC_CACHE);
        yield cache.addAll(STATIC_ASSETS);
        // Skip waiting to activate immediately
        yield self.skipWaiting();
    }))());
});
// Activate event - clean up old caches
self.addEventListener("activate", (event) => {
    console.log("[SW] Activating service worker...");
    event.waitUntil((() => __awaiter(void 0, void 0, void 0, function* () {
        const cacheNames = yield caches.keys();
        yield Promise.all(cacheNames
            .filter((name) => name !== STATIC_CACHE &&
            name !== IMAGE_CACHE &&
            name !== HEAVY_LIBS_CACHE)
            .map((name) => {
            console.log("[SW] Deleting old cache:", name);
            return caches.delete(name);
        }));
        // Take control of all clients immediately
        yield self.clients.claim();
    }))());
});
// Fetch event - implement caching strategies
self.addEventListener("fetch", (event) => {
    const { request } = event;
    const url = new URL(request.url);
    // Skip non-GET requests
    if (request.method !== "GET") {
        return;
    }
    // Skip chrome-extension and other non-http(s) requests
    if (!url.protocol.startsWith("http")) {
        return;
    }
    event.respondWith((() => __awaiter(void 0, void 0, void 0, function* () {
        var _a;
        try {
            // Strategy 1: Network-Only for HTML pages and API requests (no caching)
            if (request.mode === "navigate" ||
                url.pathname.startsWith("/api/") ||
                ((_a = request.headers.get("accept")) === null || _a === void 0 ? void 0 : _a.includes("text/html"))) {
                return yield fetch(request);
            }
            // Strategy 2: Cache-First for images
            if (request.destination === "image" ||
                /\.(jpg|jpeg|png|gif|svg|webp|ico)$/i.test(url.pathname)) {
                return yield cacheFirstStrategy(request, IMAGE_CACHE);
            }
            // Strategy 3: Cache-First for static assets (JS, CSS, fonts)
            if (request.destination === "script" ||
                request.destination === "style" ||
                request.destination === "font" ||
                /\.(js|css|woff|woff2|ttf|eot)$/i.test(url.pathname)) {
                return yield cacheFirstStrategy(request, STATIC_CACHE);
            }
            // Default: Network-Only (no caching for data)
            return yield fetch(request);
        }
        catch (error) {
            console.error("[SW] Fetch error:", error);
            // For assets, try cache as fallback
            const cachedResponse = yield caches.match(request);
            if (cachedResponse) {
                return cachedResponse;
            }
            // No cache available
            throw error;
        }
    }))());
});
// Cache-First Strategy: Check cache, fall back to network
function cacheFirstStrategy(request, cacheName) {
    return __awaiter(this, void 0, void 0, function* () {
        // Try cache first
        const cachedResponse = yield caches.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }
        // Cache miss, fetch from network
        try {
            const networkResponse = yield fetch(request);
            // Cache the response for future use
            if (networkResponse.ok) {
                const cache = yield caches.open(cacheName);
                const responseToCache = networkResponse.clone();
                yield cache.put(request, responseToCache);
            }
            return networkResponse;
        }
        catch (error) {
            console.error("[SW] Cache-first strategy failed:", error);
            throw error;
        }
    });
}
// Listen for messages from clients
self.addEventListener("message", (event) => {
    if (event.data && event.data.type === "SKIP_WAITING") {
        self.skipWaiting();
    }
    if (event.data && event.data.type === "CLEAR_CACHE") {
        event.waitUntil((() => __awaiter(void 0, void 0, void 0, function* () {
            const cacheNames = yield caches.keys();
            yield Promise.all(cacheNames.map((name) => caches.delete(name)));
        }))());
    }
    if (event.data && event.data.type === "PRELOAD_HEAVY_LIBS") {
        console.log("[SW] Preloading heavy libraries...");
        event.waitUntil((() => __awaiter(void 0, void 0, void 0, function* () {
            try {
                // Get all cached JS files from STATIC_CACHE
                const cache = yield caches.open(STATIC_CACHE);
                const requests = yield cache.keys();
                // Find heavy library chunks
                const heavyLibUrls = [];
                for (const request of requests) {
                    const url = new URL(request.url);
                    // Match chunk filenames containing our heavy libraries
                    if (url.pathname.includes("framer-motion") ||
                        url.pathname.includes("pdfkit") ||
                        url.pathname.includes("blob-stream")) {
                        heavyLibUrls.push(request.url);
                    }
                }
                if (heavyLibUrls.length === 0) {
                    console.log("[SW] No heavy library chunks found yet");
                    return;
                }
                // Cache heavy library chunks
                const heavyCache = yield caches.open(HEAVY_LIBS_CACHE);
                yield Promise.all(heavyLibUrls.map((url) => __awaiter(void 0, void 0, void 0, function* () {
                    try {
                        const response = yield fetch(url);
                        if (response.ok) {
                            yield heavyCache.put(url, response);
                            console.log("[SW] Cached heavy lib:", url);
                        }
                    }
                    catch (error) {
                        console.error("[SW] Failed to cache:", url, error);
                    }
                })));
                console.log(`[SW] Preloaded ${heavyLibUrls.length} heavy library chunks`);
            }
            catch (error) {
                console.error("[SW] Preload failed:", error);
            }
        }))());
    }
});
export {};
