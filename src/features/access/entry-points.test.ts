import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Every server action and every API route is reachable by anyone with the URL, so each must
 * check the session (or, for a route called from outside the app, a shared secret) before it
 * does anything. This calls all of them signed out, and the data reads pages call too.
 */

const databaseReads = vi.hoisted(() => ({ count: 0 }));

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
	headers: async () => new Headers(),
	cookies: async () => ({ get: () => undefined }),
}));
vi.mock("next/cache", () => ({
	unstable_cache: (read: unknown) => read,
	updateTag: vi.fn(),
	revalidateTag: vi.fn(),
	revalidatePath: vi.fn(),
}));
vi.mock("@/features/access/auth", () => ({ auth: { api: { getSession: async () => null } } }));
vi.mock("@/db", () => ({
	db: new Proxy(
		{},
		{
			get() {
				databaseReads.count += 1;
				throw new Error("Database read before the session check");
			},
		},
	),
}));

const SRC = join(__dirname, "..", "..");
/** Better Auth's own endpoints, which it guards itself. */
const SELF_GUARDED_ROUTES = new Set(["app/api/auth/[...all]/route.ts"]);
/** Routes the analytics job calls with `REVALIDATE_SECRET` instead of a session (see revalidate-endpoint.test.ts). */
const SECRET_GUARDED_ROUTES = new Set(["app/api/revalidate/route.ts"]);

function sourceFiles(dir: string): string[] {
	return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
		const path = join(dir, entry.name);
		if (entry.isDirectory()) return sourceFiles(path);
		return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [path] : [];
	});
}

const files = sourceFiles(SRC);
const actionModules = files.filter((file) => /^\s*["']use server["']/.test(readFileSync(file, "utf8")));
const routeModules = files.filter(
	(file) =>
		file.endsWith("route.ts") &&
		file.includes(`${join("app", "api")}`) &&
		!SELF_GUARDED_ROUTES.has(relative(SRC, file)),
);
const sessionRoutes = routeModules.filter((file) => !SECRET_GUARDED_ROUTES.has(relative(SRC, file)));
const secretRoutes = routeModules.filter((file) => SECRET_GUARDED_ROUTES.has(relative(SRC, file)));

beforeEach(() => {
	databaseReads.count = 0;
});

describe("server actions", () => {
	it("are all found", () => {
		expect(actionModules.length).toBeGreaterThan(0);
	});

	describe.each(actionModules.map((file) => [relative(SRC, file), file]))("%s", (_name, file) => {
		it("refuses every action to anyone signed out, before reading the database", async () => {
			const actions = Object.entries(await import(file));
			expect(actions.length).toBeGreaterThan(0);
			for (const [name, action] of actions) {
				expect(typeof action, name).toBe("function");
				await expect((action as () => Promise<unknown>)(), name).resolves.toEqual({
					ok: false,
					error: "Your session has ended. Sign in again.",
				});
			}
			expect(databaseReads.count).toBe(0);
		});
	});
});

async function answersSignedOut(file: string) {
	const handlers = Object.entries(await import(file)).filter(([name]) =>
		["GET", "POST", "PUT", "PATCH", "DELETE"].includes(name),
	);
	expect(handlers.length).toBeGreaterThan(0);
	return Promise.all(
		handlers.map(async ([method, handler]) => {
			const response = await (handler as (request: Request) => Promise<Response>)(
				new Request("http://localhost/api", { method, body: method === "GET" ? undefined : "{}" }),
			);
			return [method, response.status] as const;
		}),
	);
}

describe("API routes", () => {
	it("are all found", () => {
		expect(sessionRoutes.length).toBeGreaterThan(0);
		expect(secretRoutes).toHaveLength(SECRET_GUARDED_ROUTES.size);
	});

	describe.each(sessionRoutes.map((file) => [relative(SRC, file), file]))("%s", (_name, file) => {
		it("answers 401 to anyone signed out, before reading the database", async () => {
			for (const [method, status] of await answersSignedOut(file)) expect(status, method).toBe(401);
			expect(databaseReads.count).toBe(0);
		});
	});

	describe.each(secretRoutes.map((file) => [relative(SRC, file), file]))("%s", (_name, file) => {
		it("answers 401 to a request without the shared secret, before reading the database", async () => {
			vi.stubEnv("REVALIDATE_SECRET", "server-secret");
			for (const [method, status] of await answersSignedOut(file)) expect(status, method).toBe(401);
			expect(databaseReads.count).toBe(0);
			vi.unstubAllEnvs();
		});
	});
});

describe("data reads pages call", () => {
	const inventory = () => import("@/features/inventory/daily-inventory");
	const orders = () => import("@/features/orders/queries");
	const reporting = () => import("@/features/insights/reporting");

	it.each<[string, () => Promise<unknown>]>([
		["today's stock", async () => (await inventory()).getTodayInventory()],
		["a day's orders", async () => (await orders()).getDayOrders("2026-05-31")],
		["Insights › Day", async () => (await reporting()).getDashboardReport("2026-05-31")],
		["Business Weeks", async () => (await reporting()).getBusinessWeekRevenue("2026-05")],
		["the analytics overview", async () => (await reporting()).getAnalyticsOverview()],
		["dessert sales", async () => (await reporting()).getDessertSales("2026-05")],
	])("refuse %s to anyone signed out, before reading the database", async (_name, read) => {
		await expect(read()).rejects.toThrow("Your session has ended");
		expect(databaseReads.count).toBe(0);
	});
});
