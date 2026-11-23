import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { COMPILED_TAGS } from "@/features/insights/tags";

const revalidateTag = vi.hoisted(() => vi.fn());
vi.mock("next/cache", () => ({ revalidateTag }));

const { POST } = await import("@/app/api/revalidate/route");

function post(body: unknown) {
	return POST(
		new Request("http://localhost/api/revalidate", {
			method: "POST",
			body: typeof body === "string" ? body : JSON.stringify(body),
		}),
	);
}

beforeEach(() => {
	vi.stubEnv("REVALIDATE_SECRET", "server-secret");
	revalidateTag.mockClear();
});
afterEach(() => {
	vi.unstubAllEnvs();
});

describe("POST /api/revalidate", () => {
	it("expires every compiled-analytics tag at once for the analytics job", async () => {
		const response = await post({ secret: "server-secret" });

		expect(response.status).toBe(200);
		expect(revalidateTag.mock.calls).toEqual(COMPILED_TAGS.map((tag) => [tag, { expire: 0 }]));
	});

	it.each([
		["a wrong secret", { secret: "guess" }],
		["no secret", {}],
		["a body that isn't JSON", "not json"],
	])("answers 401 to %s", async (_name, body) => {
		expect((await post(body)).status).toBe(401);
		expect(revalidateTag).not.toHaveBeenCalled();
	});

	it("answers 401 to every secret when the server has none configured", async () => {
		vi.stubEnv("REVALIDATE_SECRET", "");

		expect((await post({ secret: "" })).status).toBe(401);
		expect(revalidateTag).not.toHaveBeenCalled();
	});
});
