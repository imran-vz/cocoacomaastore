import { Data } from "effect";

export class BackendConfigError extends Data.TaggedError("BackendConfigError")<{
	readonly message: string;
	readonly cause?: unknown;
}> {}

export class BackendDatabaseError extends Data.TaggedError("BackendDatabaseError")<{
	readonly operation: string;
	readonly cause: unknown;
}> {}

export class BackendHttpError extends Data.TaggedError("BackendHttpError")<{
	readonly operation: string;
	readonly status?: number;
	readonly cause?: unknown;
}> {}
