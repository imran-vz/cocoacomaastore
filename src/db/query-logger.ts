type QueryLike = Promise<unknown> & {
	values?: (...args: unknown[]) => Promise<unknown>;
};

type TimedClient = {
	unsafe: (query: string, params?: never[], options?: unknown) => QueryLike;
	begin?: (
		optionsOrCallback: string | ((sql: TimedClient) => unknown),
		callback?: (sql: TimedClient) => unknown,
	) => Promise<unknown>;
	savepoint?: (
		optionsOrCallback: string | ((sql: TimedClient) => unknown),
		callback?: (sql: TimedClient) => unknown,
	) => Promise<unknown>;
};

type QueryLogStatus = "ok" | "error";

const DEFAULT_SLOW_QUERY_MS = 100;
const timedClients = new WeakSet<object>();

export function isQueryTimingEnabled() {
	return process.env.DB_QUERY_TIMING === "1" || process.env.DB_QUERY_TIMING === "true";
}

function getSlowQueryMs() {
	const value = Number.parseInt(process.env.DB_SLOW_QUERY_MS ?? "", 10);
	return Number.isFinite(value) && value >= 0 ? value : DEFAULT_SLOW_QUERY_MS;
}

function normalizeQuery(query: string) {
	return query.replace(/\s+/g, " ").trim();
}

function shouldLogQuery(durationMs: number, status: QueryLogStatus) {
	return status === "error" || durationMs >= getSlowQueryMs();
}

function logQueryTiming({
	query,
	params,
	durationMs,
	status,
	error,
}: {
	query: string;
	params: unknown[];
	durationMs: number;
	status: QueryLogStatus;
	error?: unknown;
}) {
	if (!shouldLogQuery(durationMs, status)) return;

	const message = `[db] ${status} ${durationMs.toFixed(1)}ms ${normalizeQuery(query)}`;
	const details = {
		paramsCount: params.length,
	};

	if (status === "error") {
		console.error(message, { ...details, error });
		return;
	}

	console.log(message, details);
}

function observeQuery<T>(
	promise: Promise<T>,
	{
		query,
		params,
		start,
	}: {
		query: string;
		params: unknown[];
		start: number;
	},
) {
	return promise.then(
		(result) => {
			logQueryTiming({
				query,
				params,
				durationMs: performance.now() - start,
				status: "ok",
			});
			return result;
		},
		(error) => {
			logQueryTiming({
				query,
				params,
				durationMs: performance.now() - start,
				status: "error",
				error,
			});
			throw error;
		},
	);
}

function wrapQuery<TQuery extends QueryLike>(
	queryResult: TQuery,
	query: string,
	params: unknown[],
	start: number,
): TQuery {
	if (!isQueryTimingEnabled()) return queryResult;

	return new Proxy(queryResult, {
		get(target, property, receiver) {
			if (property === "values" && typeof target.values === "function") {
				return (...args: unknown[]) =>
					observeQuery(target.values?.(...args) ?? Promise.resolve([]), { query, params, start });
			}

			if (property === "then") {
				return (onFulfilled: unknown, onRejected: unknown) =>
					observeQuery(target, { query, params, start }).then(
						onFulfilled as Parameters<Promise<unknown>["then"]>[0],
						onRejected as Parameters<Promise<unknown>["then"]>[1],
					);
			}

			if (property === "catch") {
				return (onRejected: unknown) =>
					observeQuery(target, { query, params, start }).catch(onRejected as Parameters<Promise<unknown>["catch"]>[0]);
			}

			if (property === "finally") {
				return (onFinally: unknown) =>
					observeQuery(target, { query, params, start }).finally(
						onFinally as Parameters<Promise<unknown>["finally"]>[0],
					);
			}

			return Reflect.get(target, property, receiver);
		},
	}) as TQuery;
}

function wrapScopedClientMethod(
	client: TimedClient,
	methodName: "begin" | "savepoint",
	originalMethod: NonNullable<TimedClient["begin"]>,
) {
	client[methodName] = ((
		optionsOrCallback: string | ((sql: TimedClient) => unknown),
		callback?: (sql: TimedClient) => unknown,
	) => {
		if (typeof optionsOrCallback === "function") {
			return originalMethod((scopedClient) => optionsOrCallback(withQueryTiming(scopedClient)));
		}

		if (!callback) {
			return originalMethod(optionsOrCallback);
		}

		return originalMethod(optionsOrCallback, (scopedClient) => callback(withQueryTiming(scopedClient)));
	}) as TimedClient["begin"];
}

export function withQueryTiming<TClient extends object>(client: TClient): TClient {
	if (!isQueryTimingEnabled()) return client;
	if (timedClients.has(client)) return client;
	timedClients.add(client);

	const timedClient = client as TClient & TimedClient;
	const originalUnsafe = timedClient.unsafe.bind(timedClient);

	timedClient.unsafe = ((query: string, params: unknown[] = [], options?: unknown) => {
		const start = performance.now();
		return wrapQuery(originalUnsafe(query, params as never[], options), query, params, start);
	}) as TimedClient["unsafe"];

	if (timedClient.begin) {
		wrapScopedClientMethod(
			timedClient,
			"begin",
			timedClient.begin.bind(timedClient) as NonNullable<TimedClient["begin"]>,
		);
	}

	if (timedClient.savepoint) {
		wrapScopedClientMethod(
			timedClient,
			"savepoint",
			timedClient.savepoint.bind(timedClient) as NonNullable<TimedClient["savepoint"]>,
		);
	}

	return client;
}
