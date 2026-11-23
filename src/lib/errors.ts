/** An error whose message is written for staff and is safe to show in the UI. */
export class UserFacingError extends Error {
	override name = "UserFacingError";
}

const DATABASE_UNAVAILABLE_MESSAGE = "Database is unavailable. Please try again.";

export class DatabaseUnavailableError extends UserFacingError {
	override name = "DatabaseUnavailableError";

	constructor(options?: { cause?: unknown }) {
		super(DATABASE_UNAVAILABLE_MESSAGE, options);
	}
}

const MAX_CAUSE_DEPTH = 6;

/** The error followed by its `cause`s, outermost first (at most six, in case a chain loops). */
export function* causeChain(error: unknown): Generator<object> {
	let current = error;
	for (let depth = 0; depth < MAX_CAUSE_DEPTH && current && typeof current === "object"; depth += 1) {
		yield current;
		current = (current as { cause?: unknown }).cause;
	}
}

function stringField(error: object, field: "code" | "message"): string | undefined {
	const value = (error as Record<string, unknown>)[field];
	return typeof value === "string" ? value : undefined;
}

// Connection-level failures from Node's socket layer and Postgres (SQLSTATE class 57P).
const UNAVAILABLE_CODES = new Set([
	"ECONNREFUSED",
	"ETIMEDOUT",
	"ENOTFOUND",
	"EHOSTUNREACH",
	"57P01",
	"57P02",
	"57P03",
]);
const UNAVAILABLE_MESSAGES = [
	"econnrefused",
	"connect etimedout",
	"getaddrinfo enotfound",
	"connection terminated unexpectedly",
	"terminating connection due to administrator command",
	"the database system is starting up",
	"remaining connection slots are reserved",
];

export function isDatabaseUnavailableError(error: unknown): boolean {
	for (const link of causeChain(error)) {
		if (link instanceof DatabaseUnavailableError) return true;
		const code = stringField(link, "code");
		if (code && UNAVAILABLE_CODES.has(code)) return true;
		const message = stringField(link, "message")?.toLowerCase() ?? "";
		if (UNAVAILABLE_MESSAGES.some((needle) => message.includes(needle))) return true;
	}
	return false;
}

/** The message staff should see for `error`, or `undefined` when it is an unexpected failure. */
export function userFacingMessage(error: unknown): string | undefined {
	if (isDatabaseUnavailableError(error)) return DATABASE_UNAVAILABLE_MESSAGE;
	for (const link of causeChain(error)) {
		if (link instanceof UserFacingError) return link.message;
	}
	return undefined;
}
