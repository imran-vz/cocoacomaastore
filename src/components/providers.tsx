"use client";

import { QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MotionConfig } from "motion/react";
import { useState } from "react";
import { LOGIN_PATH } from "@/features/access/area";
import { HttpError } from "@/lib/fetch-json";

const RETRIES = 3;

/** Refused access (401 signed out, 403 not allowed) won't change on a retry. */
function isRefused(error: Error) {
	return error instanceof HttpError && (error.status === 401 || error.status === 403);
}

function createQueryClient() {
	return new QueryClient({
		queryCache: new QueryCache({
			onError: (error) => {
				// The session has ended (expired, or signed out on another device): sign in again.
				if (error instanceof HttpError && error.status === 401) window.location.assign(LOGIN_PATH);
			},
		}),
		defaultOptions: {
			queries: {
				refetchOnWindowFocus: false,
				staleTime: 60_000,
				gcTime: 10 * 60_000,
				retry: (failureCount, error) => !isRefused(error) && failureCount < RETRIES,
			},
		},
	});
}

export function Providers({ children }: { children: React.ReactNode }) {
	const [queryClient] = useState(createQueryClient);

	return (
		<QueryClientProvider client={queryClient}>
			{/* Motion-driven animation follows the visitor's reduced-motion setting, like the CSS `motion-reduce:` classes. */}
			<MotionConfig reducedMotion="user">{children}</MotionConfig>
		</QueryClientProvider>
	);
}
