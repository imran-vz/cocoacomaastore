/// <reference lib="webworker" />

declare const self: ServiceWorkerGlobalScope;

const CACHE_NAME = "app-cache-v1";

// Files to cache
const urlsToCache = ["/", "/icon-192x192.png", "/icon-512x512.png"];

self.addEventListener("install", (event) => {
	event.waitUntil(
		caches.open(CACHE_NAME).then((cache) => cache.addAll(urlsToCache)),
	);
});

self.addEventListener("fetch", (event) => {
	event.respondWith(
		caches
			.match(event.request)
			.then((response) => response || fetch(event.request)),
	);
});

export {};
