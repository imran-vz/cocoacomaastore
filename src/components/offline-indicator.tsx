"use client";

import { Wifi, WifiOff } from "lucide-react";
import { useEffect, useState } from "react";

export function OfflineIndicator() {
	const [isOnline, setIsOnline] = useState(true);
	const [showNotification, setShowNotification] = useState(false);

	useEffect(() => {
		// Initial state
		setIsOnline(navigator.onLine);

		function handleOnline() {
			setIsOnline(true);
			setShowNotification(true);
			setTimeout(() => setShowNotification(false), 3000);
		}

		function handleOffline() {
			setIsOnline(false);
			setShowNotification(true);
		}

		window.addEventListener("online", handleOnline);
		window.addEventListener("offline", handleOffline);

		return () => {
			window.removeEventListener("online", handleOnline);
			window.removeEventListener("offline", handleOffline);
		};
	}, []);

	// Don't show anything if online and no notification needed
	if (isOnline && !showNotification) {
		return null;
	}

	return (
		<div
			className={`fixed top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg shadow-lg transition-all duration-300 ${
				showNotification
					? "translate-y-0 opacity-100"
					: "-translate-y-full opacity-0"
			} ${isOnline ? "bg-green-500 text-white" : "bg-orange-500 text-white"}`}
		>
			<div className="flex items-center gap-2">
				{isOnline ? (
					<>
						<Wifi className="h-4 w-4" />
						<span className="text-sm font-medium">Back online</span>
					</>
				) : (
					<>
						<WifiOff className="h-4 w-4" />
						<span className="text-sm font-medium">
							Offline - Some features may be limited
						</span>
					</>
				)}
			</div>
		</div>
	);
}
