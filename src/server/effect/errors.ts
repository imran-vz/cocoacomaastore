import { Data } from "effect";

export class BackendDatabaseError extends Data.TaggedError("BackendDatabaseError")<{
	readonly operation: string;
	readonly cause: unknown;
}> {}
