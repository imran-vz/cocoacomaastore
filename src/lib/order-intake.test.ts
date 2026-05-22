import { Effect, Layer } from "effect";
import { describe, expect, test } from "vitest";
import {
	getCartLineInventoryDeductions,
	ORDER_MUTATION_TAGS,
	refreshOrderMutationViewsEffect,
} from "@/lib/order-intake";
import type { BackendDatabaseError } from "@/server/effect/errors";
import { Database } from "@/server/effect/services/db";
import { NextCache } from "@/server/effect/services/next-cache";

describe("order-intake", () => {
	describe("inventory deductions", () => {
		test("aggregates cart-line base dessert quantities and ignores unlimited stock", () => {
			expect(
				getCartLineInventoryDeductions([
					{
						cartLineId: "1",
						baseDessertId: 10,
						baseDessertName: "Classic Box",
						baseDessertPrice: 100,
						quantity: 2,
						unitPrice: 100,
						hasUnlimitedStock: false,
						modifiers: [],
					},
					{
						cartLineId: "2",
						baseDessertId: 10,
						baseDessertName: "Classic Box",
						baseDessertPrice: 100,
						quantity: 4,
						unitPrice: 100,
						hasUnlimitedStock: false,
						modifiers: [],
					},
					{
						cartLineId: "3",
						baseDessertId: 11,
						baseDessertName: "Bag",
						baseDessertPrice: 0,
						quantity: 8,
						unitPrice: 0,
						hasUnlimitedStock: true,
						modifiers: [],
					},
				]),
			).toEqual([{ dessertId: 10, quantity: 6, name: "Classic Box" }]);
		});
	});

	test("refreshes order mutation views without running monthly analytics in the request path", async () => {
		const operations: string[] = [];
		const updatedTags: Array<readonly string[]> = [];
		const DatabaseTest = Layer.succeed(Database, {
			db: {} as never,
			attempt: <A>(operation: string): Effect.Effect<A, BackendDatabaseError> =>
				Effect.sync(() => {
					operations.push(operation);
					return undefined as A;
				}),
		});
		const NextCacheTest = Layer.succeed(NextCache, {
			revalidatePaths: () => Effect.void,
			revalidateTags: () => Effect.void,
			updateTags: (tags) =>
				Effect.sync(() => {
					updatedTags.push(tags);
				}),
		});

		await Effect.runPromise(
			refreshOrderMutationViewsEffect(new Date("2026-05-21T12:00:00.000Z")).pipe(
				Effect.provide(Layer.mergeAll(DatabaseTest, NextCacheTest)),
			),
		);

		expect(operations).toEqual([
			"recompute daily revenue",
			"recompute daily dessert revenue",
			"recompute daily end-of-day stock",
		]);
		expect(updatedTags).toEqual([ORDER_MUTATION_TAGS]);
	});
});
