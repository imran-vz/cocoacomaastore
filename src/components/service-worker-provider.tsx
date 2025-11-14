"use client";

import { useEffect } from "react";

export function ServiceWorkerProvider({
	children,
}: {
	children: React.ReactNode;
}) {
	useEffect(() => {
		if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
			return;
		}

		// Register service worker
		navigator.serviceWorker
			.register("/sw.js")
			.then((registration) => {
				console.log("SW registered:", registration);

				// Check if running as installed PWA (standalone mode)
				const isStandalone = window.matchMedia(
					"(display-mode: standalone)",
				).matches;

				if (isStandalone && registration.active) {
					// Defer preload until browser is idle
					if ("requestIdleCallback" in window) {
						requestIdleCallback(() => {
							registration.active?.postMessage({
								type: "PRELOAD_HEAVY_LIBS",
							});
						});
					} else {
						// Fallback for browsers without requestIdleCallback
						setTimeout(() => {
							registration.active?.postMessage({
								type: "PRELOAD_HEAVY_LIBS",
							});
						}, 1000);
					}
				}
			})
			.catch((error) => {
				console.error("SW registration failed:", error);
			});
	}, []);

	return <>{children}</>;
}
