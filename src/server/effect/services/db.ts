import { Context, Effect, Layer } from "effect";
import type { db as drizzleDb } from "@/db";
import { BackendDatabaseError } from "@/server/effect/errors";

type AppDatabase = typeof drizzleDb;

export class Database extends Context.Service<
	Database,
	{
		readonly db: AppDatabase;
		readonly attempt: <A>(
			operation: string,
			run: (db: AppDatabase) => Promise<A>,
		) => Effect.Effect<A, BackendDatabaseError>;
	}
>()("Database") {
	static readonly Live = Layer.effect(
		this,
		Effect.promise(async () => {
			const { db } = await import("@/db");

			return {
				db,
				attempt: (operation, run) =>
					Effect.tryPromise({
						try: () => run(db),
						catch: (cause) => new BackendDatabaseError({ operation, cause }),
					}),
			};
		}),
	);
}
