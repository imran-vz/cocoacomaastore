import { Context, Data, Effect, Layer } from "effect";
import { REVALIDATE_ENDPOINT, type RevalidateRequest } from "@/features/insights/revalidate-request";

/** The job cannot reach the app's revalidation endpoint, so freshly compiled reports would stay hidden behind cached ones. */
export class RevalidationNotConfiguredError extends Data.TaggedError("RevalidationNotConfiguredError")<{
	readonly message: string;
}> {}

/** The app refused or never answered a revalidation request. */
export class RevalidationRequestError extends Data.TaggedError("RevalidationRequestError")<{
	readonly status?: number;
	readonly cause?: unknown;
}> {}

function requestRevalidation(appUrl: string, request: RevalidateRequest) {
	return Effect.tryPromise({
		try: async () => {
			const response = await fetch(new URL(REVALIDATE_ENDPOINT, appUrl), {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify(request),
			});
			if (!response.ok) throw new RevalidationRequestError({ status: response.status });
		},
		catch: (cause) => (cause instanceof RevalidationRequestError ? cause : new RevalidationRequestError({ cause })),
	});
}

/**
 * Refreshes the running app's compiled-analytics caches over HTTP: the analytics jobs run
 * outside Next.js, so they cannot call `next/cache` themselves. Building the layer fails when
 * the app URL or secret is missing, so a job stops before it compiles anything.
 */
export class CacheRevalidator extends Context.Service<
	CacheRevalidator,
	{ readonly revalidateCompiledAnalytics: () => Effect.Effect<void, RevalidationRequestError> }
>()("CacheRevalidator") {
	static readonly Live = Layer.effect(
		this,
		Effect.gen(function* () {
			const appUrl = process.env.NEXT_PUBLIC_APP_URL;
			const secret = process.env.REVALIDATE_SECRET;
			if (!appUrl || !secret) {
				return yield* new RevalidationNotConfiguredError({
					message: "NEXT_PUBLIC_APP_URL and REVALIDATE_SECRET must be set for analytics jobs",
				});
			}
			return {
				revalidateCompiledAnalytics: () => requestRevalidation(appUrl, { secret }),
			};
		}),
	);
}
