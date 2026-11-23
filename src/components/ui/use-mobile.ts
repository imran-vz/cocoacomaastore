import * as React from "react";

/** Tailwind's `md` breakpoint (48rem): below it is a phone. */
const PHONE_QUERY = "(width < 48rem)";

function subscribe(onChange: () => void) {
	const query = window.matchMedia(PHONE_QUERY);
	query.addEventListener("change", onChange);
	return () => query.removeEventListener("change", onChange);
}

/**
 * Whether the viewport is below `md`, for the few choices CSS can't make (which component
 * renders). The server and hydration render as not-a-phone; client renders after that read the
 * real width from the first render.
 */
export function useIsMobile() {
	return React.useSyncExternalStore(
		subscribe,
		() => window.matchMedia(PHONE_QUERY).matches,
		() => false,
	);
}
