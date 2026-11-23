/** A non-2xx answer from one of the app's own API routes; `status` 401 means the session has ended. */
export class HttpError extends Error {
	constructor(
		readonly status: number,
		path: string,
	) {
		super(`GET ${path} failed (${status})`);
		this.name = "HttpError";
	}
}

/** GETs fresh JSON from one of the app's own API routes, throwing an `HttpError` on a non-2xx response. */
export async function fetchJson<T>(path: string, signal?: AbortSignal): Promise<T> {
	const response = await fetch(path, { cache: "no-store", signal });
	if (!response.ok) throw new HttpError(response.status, path);
	return response.json() as Promise<T>;
}
