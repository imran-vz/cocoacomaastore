import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { withQueryTiming } from "@/db/query-logger";

type FakeQuery<T> = Promise<T> & {
	values?: ReturnType<typeof vi.fn<() => Promise<T>>>;
};

type FakeClient = {
	unsafe: ReturnType<typeof vi.fn<(query: string, params?: unknown[]) => FakeQuery<unknown>>>;
	begin?: (callback: (client: FakeClient) => unknown) => Promise<unknown>;
	savepoint?: (callback: (client: FakeClient) => unknown) => Promise<unknown>;
};

function resolvedQuery<T>(result: T, valuesResult?: T): FakeQuery<T> {
	const query = Promise.resolve(result) as FakeQuery<T>;
	if (valuesResult !== undefined) query.values = vi.fn(() => Promise.resolve(valuesResult));
	return query;
}

function createClient(query: FakeQuery<unknown>): FakeClient {
	return { unsafe: vi.fn(() => query) };
}

function expectOkLog(paramsCount: number, ...sentinels: string[]) {
	expect(console.log).toHaveBeenCalledTimes(1);
	const [message, details] = vi.mocked(console.log).mock.calls[0];
	expect(message).toBe("[db] query timing");
	expect(details).toMatchObject({ operation: "query", status: "ok", paramsCount });
	expect(details).toHaveProperty("durationMs");
	const serialized = JSON.stringify(vi.mocked(console.log).mock.calls);
	for (const sentinel of sentinels) expect(serialized).not.toContain(sentinel);
	expect(console.error).not.toHaveBeenCalled();
}

describe("query timing parameter redaction", () => {
	beforeEach(() => {
		vi.stubEnv("DB_QUERY_TIMING", "1");
		vi.stubEnv("DB_SLOW_QUERY_MS", "0");
		vi.spyOn(console, "log").mockImplementation(() => undefined);
		vi.spyOn(console, "error").mockImplementation(() => undefined);
	});

	afterEach(() => {
		vi.restoreAllMocks();
		vi.unstubAllEnvs();
	});

	it("redacts successful direct Promise query parameters", async () => {
		vi.stubEnv("DB_QUERY_TIMING", "true");
		const sentinels = ["not-a-real-session-token", "not-a-real-email"];
		const client = withQueryTiming(createClient(resolvedQuery("unchanged-result")));

		await expect(client.unsafe("select   *  from sessions", sentinels)).resolves.toBe("unchanged-result");

		expectOkLog(2, ...sentinels, "select   *  from sessions");
	});

	it("redacts parameters from projected values queries", async () => {
		const sentinel = "not-a-real-customer-name";
		const rows = [{ id: 1 }];
		const query = resolvedQuery([], rows);
		const client = withQueryTiming(createClient(query));

		await expect(client.unsafe("select id from orders", [sentinel]).values?.()).resolves.toEqual(rows);

		expect(query.values).toHaveBeenCalledTimes(1);
		expectOkLog(1, sentinel, "select id from orders");
	});

	it("redacts failed query text, parameters, and PostgreSQL error fields while rethrowing the same error", async () => {
		const sentinels = {
			parameter: "not-a-real-password-hash",
			message: "not-a-real-email",
			detail: "not-a-real-customer-name",
			hint: "not-a-real-token",
			where: "not-a-real-session",
			cause: "not-a-real-credential",
		};
		const error = {
			code: "23505",
			message: sentinels.message,
			detail: sentinels.detail,
			hint: sentinels.hint,
			where: sentinels.where,
			cause: { message: sentinels.cause },
		};
		const query = "update users set password = $1";
		const client = withQueryTiming(createClient(Promise.reject(error) as FakeQuery<unknown>));

		await expect(client.unsafe(query, [sentinels.parameter])).rejects.toBe(error);

		expect(console.error).toHaveBeenCalledTimes(1);
		const [message, details] = vi.mocked(console.error).mock.calls[0];
		expect(message).toBe("[db] query timing");
		expect(details).toMatchObject({ operation: "query", code: "23505", status: "error", paramsCount: 1 });
		expect(details).toHaveProperty("durationMs");
		const serialized = JSON.stringify(vi.mocked(console.error).mock.calls);
		expect(serialized).not.toContain(query);
		for (const sentinel of Object.values(sentinels)) expect(serialized).not.toContain(sentinel);
		expect(console.log).not.toHaveBeenCalled();
	});

	it("redacts transaction-scoped query parameters", async () => {
		const sentinel = "not-a-real-access-token";
		const transaction = createClient(resolvedQuery("transaction-result"));
		const root: FakeClient = {
			...createClient(resolvedQuery(undefined)),
			begin: async (callback) => callback(transaction),
		};
		const client = withQueryTiming(root);

		await expect(client.begin?.((scoped) => scoped.unsafe("select 1", [sentinel]))).resolves.toBe("transaction-result");

		expectOkLog(1, sentinel, "select 1");
	});

	it("redacts nested-savepoint query parameters", async () => {
		const sentinel = "not-a-real-refresh-token";
		const nested = createClient(resolvedQuery("savepoint-result"));
		const transaction: FakeClient = {
			...createClient(resolvedQuery(undefined)),
			savepoint: async (callback) => callback(nested),
		};
		const root: FakeClient = {
			...createClient(resolvedQuery(undefined)),
			begin: async (callback) => callback(transaction),
		};
		const client = withQueryTiming(root);

		await expect(
			client.begin?.((scoped) => scoped.savepoint?.((savepoint) => savepoint.unsafe("select 2", [sentinel]))),
		).resolves.toBe("savepoint-result");

		expectOkLog(1, sentinel, "select 2");
	});
});
