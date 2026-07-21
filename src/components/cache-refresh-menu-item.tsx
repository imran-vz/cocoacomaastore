"use client";

import { IconCheck, IconRefresh } from "@tabler/icons-react";
import { revalidateAllCaches } from "@/app/cache/actions";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { type ReactiveButtonComponent, useReactiveButton } from "@/components/ui/reactive-button";

export function useCacheRefreshController() {
	const [button, RefreshButton] = useReactiveButton({
		label: "Refresh Data",
		icon: IconRefresh,
		loading: { label: "Refreshing..." },
		success: { label: "Refreshed", icon: IconCheck, duration: 900 },
		error: { label: "Refresh failed" },
		feedbackStyle: "neutral",
	});

	const refresh = async () => {
		if (button.status !== "idle") return;

		const token = button.setLoading();
		try {
			await revalidateAllCaches();
			button.setSuccess(undefined, { token });
		} catch (error) {
			console.error("Failed to refresh cache:", error);
			button.setError(undefined, { token });
		}
	};

	return { RefreshButton, refresh };
}

export function CacheRefreshMenuItem({
	button: RefreshButton,
	onRefresh,
}: {
	button: ReactiveButtonComponent;
	onRefresh: () => void | Promise<void>;
}) {
	return (
		<RefreshButton onClick={onRefresh} render={<DropdownMenuItem closeOnClick={false} className="cursor-pointer" />} />
	);
}
