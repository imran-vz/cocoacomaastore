function getErrorCode(error: unknown): string | undefined {
	if (!error || typeof error !== "object") return undefined;

	const code = (error as { code?: unknown }).code;
	return typeof code === "string" ? code : undefined;
}

function getErrorMessage(error: unknown): string {
	if (error instanceof Error) return error.message;
	if (typeof error === "string") return error;
	if (error && typeof error === "object") {
		const message = (error as { message?: unknown }).message;
		if (typeof message === "string") return message;
	}
	return "";
}

function getNestedErrorMessage(error: unknown): string {
	if (!error || typeof error !== "object") return "";

	const cause = (error as { cause?: unknown }).cause;
	return getErrorMessage(cause);
}

export class DatabaseUnavailableError extends Error {
	override name = "DatabaseUnavailableError";

	constructor(message = "Database unavailable", options?: { cause?: unknown }) {
		super(message, options);
	}
}

export function isDatabaseUnavailableError(error: unknown): boolean {
	if (error instanceof DatabaseUnavailableError) return true;

	const code = getErrorCode(error);
	if (
		code &&
		[
			"ECONNREFUSED",
			"ETIMEDOUT",
			"ENOTFOUND",
			"EHOSTUNREACH",
			"57P01", // admin_shutdown
			"57P02", // crash_shutdown
			"57P03", // cannot_connect_now
		].includes(code)
	) {
		return true;
	}

	const message = `${getErrorMessage(error)}\n${getNestedErrorMessage(error)}`
		.toLowerCase()
		.trim();

	return [
		"database_url is not set",
		"econnrefused",
		"connect etimedout",
		"getaddrinfo enotfound",
		"connection terminated unexpectedly",
		"terminating connection due to administrator command",
		"the database system is starting up",
		"remaining connection slots are reserved",
	].some((needle) => message.includes(needle));
}
