"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { ensureLiveRegions, FeedbackStore } from "@/components/ui/feedback";

/** A feedback store owned by the calling component, which re-renders on every transition. */
export function useFeedbackStore(): FeedbackStore {
	const [store] = useState(() => new FeedbackStore());
	useEffect(() => {
		ensureLiveRegions();
		return () => store.dispose();
	}, [store]);
	useSyncExternalStore(store.subscribe, store.getVersion, store.getVersion);
	return store;
}
