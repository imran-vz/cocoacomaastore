const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

/**
 * Parses a PostgreSQL connection URL from the environment variable `name`. Error messages name
 * the variable but never repeat its value, which carries credentials.
 */
export function parsePostgresUrl(value: string | undefined, name: string): URL {
	if (value === undefined || value.trim() === "") throw new Error(`${name} is required`);

	let url: URL;
	try {
		url = new URL(value.trim());
	} catch {
		throw new Error(`${name} must be a valid PostgreSQL URL`);
	}
	if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") {
		throw new Error(`${name} must use the postgres or postgresql protocol`);
	}
	return url;
}

/** Whether the database runs on this machine (a local or throwaway one, never the shop's). */
export function isLoopbackHost(url: URL): boolean {
	return LOOPBACK_HOSTS.has(url.hostname);
}
