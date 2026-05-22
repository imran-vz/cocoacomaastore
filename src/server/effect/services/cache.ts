import { Context, Effect, Layer } from "effect";
import { type BackendConfigError, BackendHttpError } from "@/server/effect/errors";

type CacheRevalidationResult =
	| {
			readonly revalidated: true;
	  }
	| {
			readonly revalidated: false;
			readonly reason: string;
	  };

export class CacheRevalidator extends Context.Tag("CacheRevalidator")<
	CacheRevalidator,
	{
		readonly revalidateAnalyticsCaches: () => Effect.Effect<
			CacheRevalidationResult,
			BackendConfigError | BackendHttpError
		>;
	}
>() {
	static readonly Live = Layer.succeed(this, {
		revalidateAnalyticsCaches: () =>
			Effect.gen(function* () {
				const appUrl = process.env.NEXT_PUBLIC_APP_URL;
				const secret = process.env.REVALIDATE_SECRET;

				if (!appUrl || !secret) {
					return {
						revalidated: false,
						reason: "NEXT_PUBLIC_APP_URL or REVALIDATE_SECRET is not configured",
					} as const;
				}

				yield* Effect.forEach(
					["dashboard", "analytics"] as const,
					(tag) =>
						Effect.tryPromise({
							try: async () => {
								const response = await fetch(new URL("/api/revalidate", appUrl), {
									method: "POST",
									headers: {
										"content-type": "application/json",
									},
									body: JSON.stringify({ tag, secret }),
								});

								if (!response.ok) {
									throw new BackendHttpError({
										operation: `revalidate ${tag}`,
										status: response.status,
									});
								}
							},
							catch: (cause) =>
								cause instanceof BackendHttpError
									? cause
									: new BackendHttpError({
											operation: `revalidate ${tag}`,
											cause,
										}),
						}),
					{ concurrency: "unbounded" },
				);

				return { revalidated: true } as const;
			}),
	});
}
