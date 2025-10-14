/// <reference lib="webworker" />

declare const self: ServiceWorkerGlobalScope;

const CACHE_VERSION = "v2";
const STATIC_CACHE = `static-${CACHE_VERSION}`;
const IMAGE_CACHE = `images-${CACHE_VERSION}`;

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
	event.waitUntil(
		(async () => {
			const cache = await caches.open(STATIC_CACHE);
			await cache.addAll(STATIC_ASSETS);
			// Skip waiting to activate immediately
			await self.skipWaiting();
		})(),
	);
});

// Activate event - clean up old caches
self.addEventListener("activate", (event) => {
	console.log("[SW] Activating service worker...");
	event.waitUntil(
		(async () => {
			const cacheNames = await caches.keys();
			await Promise.all(
				cacheNames
					.filter(
						(name) => name !== STATIC_CACHE && name !== IMAGE_CACHE,
					)
					.map((name) => {
						console.log("[SW] Deleting old cache:", name);
						return caches.delete(name);
					}),
			);
			// Take control of all clients immediately
			await self.clients.claim();
		})(),
	);
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

	event.respondWith(
		(async () => {
			try {
				// Strategy 1: Network-Only for HTML pages and API requests (no caching)
				if (
					request.mode === "navigate" ||
					url.pathname.startsWith("/api/") ||
					request.headers.get("accept")?.includes("text/html")
				) {
					return await fetch(request);
				}

				// Strategy 2: Cache-First for images
				if (
					request.destination === "image" ||
					/\.(jpg|jpeg|png|gif|svg|webp|ico)$/i.test(url.pathname)
				) {
					return await cacheFirstStrategy(request, IMAGE_CACHE);
				}

				// Strategy 3: Cache-First for static assets (JS, CSS, fonts)
				if (
					request.destination === "script" ||
					request.destination === "style" ||
					request.destination === "font" ||
					/\.(js|css|woff|woff2|ttf|eot)$/i.test(url.pathname)
				) {
					return await cacheFirstStrategy(request, STATIC_CACHE);
				}

				// Default: Network-Only (no caching for data)
				return await fetch(request);
			} catch (error) {
				console.error("[SW] Fetch error:", error);
				// For assets, try cache as fallback
				const cachedResponse = await caches.match(request);
				if (cachedResponse) {
					return cachedResponse;
				}
				// No cache available
				throw error;
			}
		})(),
	);
});

// Cache-First Strategy: Check cache, fall back to network
async function cacheFirstStrategy(
	request: Request,
	cacheName: string,
): Promise<Response> {
	// Try cache first
	const cachedResponse = await caches.match(request);
	if (cachedResponse) {
		return cachedResponse;
	}

	// Cache miss, fetch from network
	try {
		const networkResponse = await fetch(request);

		// Cache the response for future use
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

// Listen for messages from clients
self.addEventListener("message", (event) => {
	if (event.data && event.data.type === "SKIP_WAITING") {
		self.skipWaiting();
	}

	if (event.data && event.data.type === "CLEAR_CACHE") {
		event.waitUntil(
			(async () => {
				const cacheNames = await caches.keys();
				await Promise.all(cacheNames.map((name) => caches.delete(name)));
			})(),
		);
	}
});

export {};
