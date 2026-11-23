import { describe, expect, it } from "vitest";
import { createSafeDiagnostic } from "@/lib/safe-diagnostics";

const sentinels = [
	"sentinel-message",
	"sentinel-detail",
	"sentinel-hint",
	"sentinel-where",
	"sentinel-query",
	"sentinel-token",
	"sentinel-customer",
];

function postgresLikeError() {
	return {
		message: sentinels[0],
		detail: sentinels[1],
		hint: sentinels[2],
		where: sentinels[3],
		query: sentinels[4],
		stack: sentinels[5],
		cause: {
			message: sentinels[6],
			code: "23505",
			status: 503,
		},
	};
}

describe("safe diagnostics", () => {
	it("copies only allowlisted metadata from nested failures", () => {
		const diagnostic = createSafeDiagnostic({
			operation: "create order",
			error: postgresLikeError(),
			status: "error",
			durationMs: 12.345,
			paramsCount: 2,
		});

		expect(diagnostic).toEqual({
			operation: "create order",
			code: "23505",
			status: "error",
			durationMs: 12.3,
			paramsCount: 2,
		});
		const serialized = JSON.stringify(diagnostic);
		for (const sentinel of sentinels) expect(serialized).not.toContain(sentinel);
	});

	it("does not copy malformed error codes or invalid numeric metadata", () => {
		expect(
			createSafeDiagnostic({
				operation: "query",
				error: { code: `unsafe ${sentinels[0]}` },
				durationMs: Number.NaN,
				paramsCount: -1,
			}),
		).toEqual({ operation: "query" });
	});
});
