import { Context, Effect, Layer } from "effect";
import type { AppDatabase } from "@/db";
import { UserFacingError } from "@/lib/errors";
import { BackendDatabaseError } from "@/server/effect/errors";

type DatabaseShape = {
	readonly attempt: <A>(
		operation: string,
		run: (db: AppDatabase) => Promise<A>,
	) => Effect.Effect<A, BackendDatabaseError | UserFacingError>;
};

/** The Database service over a given Drizzle client. */
export function databaseService(db: AppDatabase): DatabaseShape {
	return {
		attempt: (operation, run) =>
			Effect.tryPromise({
				try: () => run(db),
				catch: (cause) => (cause instanceof UserFacingError ? cause : new BackendDatabaseError({ operation, cause })),
			}),
	};
}

export class Database extends Context.Service<Database, DatabaseShape>()("Database") {
	// `@/db` throws at import time without DATABASE_URL, so it loads only when the layer is built.
	static readonly Live = Layer.effect(
		this,
		Effect.promise(async () => databaseService((await import("@/db")).db)),
	);
}
