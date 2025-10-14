"use client";

export async function registerServiceWorker() {
	if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
		console.log("[SW] Service Workers not supported");
		return;
	}

	try {
		// Check if service worker is already registered
		const registration = await navigator.serviceWorker.getRegistration();

		if (registration) {
			console.log("[SW] Service Worker already registered");

			// Update if needed
			await registration.update();

			// Listen for updates
			registration.addEventListener("updatefound", () => {
				const newWorker = registration.installing;
				if (!newWorker) return;

				newWorker.addEventListener("statechange", () => {
					if (
						newWorker.state === "installed" &&
						navigator.serviceWorker.controller
					) {
						console.log("[SW] New service worker available");
						// Optionally notify user about update
					}
				});
			});
		} else {
			// Register new service worker
			const reg = await navigator.serviceWorker.register("/sw.js", {
				scope: "/",
			});

			console.log("[SW] Service Worker registered:", reg.scope);

			// Listen for updates
			reg.addEventListener("updatefound", () => {
				const newWorker = reg.installing;
				if (!newWorker) return;

				newWorker.addEventListener("statechange", () => {
					if (
						newWorker.state === "installed" &&
						navigator.serviceWorker.controller
					) {
						console.log("[SW] New service worker available");
					}
				});
			});
		}

		// Listen for controller change (new SW activated)
		navigator.serviceWorker.addEventListener("controllerchange", () => {
			console.log("[SW] Controller changed, reloading page");
			window.location.reload();
		});
	} catch (error) {
		console.error("[SW] Registration failed:", error);
	}
}

// Helper to unregister service worker (for debugging)
export async function unregisterServiceWorker() {
	if ("serviceWorker" in navigator) {
		const registration = await navigator.serviceWorker.getRegistration();
		if (registration) {
			await registration.unregister();
			console.log("[SW] Service Worker unregistered");
		}
	}
}

// Helper to clear all caches (for debugging)
export async function clearAllCaches() {
	if ("caches" in window) {
		const cacheNames = await caches.keys();
		await Promise.all(cacheNames.map((name) => caches.delete(name)));
		console.log("[SW] All caches cleared");
	}
}
