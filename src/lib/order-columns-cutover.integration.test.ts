import { readFile } from "node:fs/promises";
import path from "node:path";
import postgres from "postgres";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetIntegrationData } from "@/test/integration/database";
import { ORDER_COLUMNS_ACKNOWLEDGEMENT, runOrderColumnsCutoverCommand } from "../../scripts/order-columns-cutover";
import { parseTestDatabaseUrl } from "../../scripts/test-database-url";

const ROLLBACK_SENTINEL = "ROLLBACK_ORDER_COLUMNS_CUTOVER_INTEGRATION_TEST";

beforeEach(resetIntegrationData);

describe("order columns cutover SQL", () => {
	it("backfills a legacy schema atomically and is a final-state no-op", async () => {
		const { targetUrl } = parseTestDatabaseUrl(process.env.TEST_DATABASE_URL);
		const cutoverSql = await readFile(
			path.resolve(import.meta.dirname, "../../scripts/sql/order-columns-cutover.sql"),
			"utf8",
		);
		const sql = postgres(targetUrl, { max: 1, prepare: false });
		let verified = false;

		try {
			await sql.begin(async (transaction) => {
				await transaction.unsafe(`
					ALTER TABLE public.orders DROP COLUMN "submissionId";
					ALTER TABLE public.orders DROP COLUMN "requestFingerprint";
					ALTER TABLE public.order_items DROP COLUMN "baseDessertName";
					ALTER TABLE public.order_items DROP COLUMN "inventoryDeducted";
					ALTER TABLE public.order_item_modifiers DROP COLUMN "dessertName";
				`);

				const [finiteDessert] = await transaction.unsafe<Array<{ id: number }>>(`
					INSERT INTO public.desserts (name, price, kind, "hasUnlimitedStock")
					VALUES ('Finite legacy dessert', 120, 'base', false)
					RETURNING id
				`);
				const [modifierDessert] = await transaction.unsafe<Array<{ id: number }>>(`
					INSERT INTO public.desserts (name, price, kind, "hasUnlimitedStock")
					VALUES ('Legacy modifier', 20, 'modifier', true)
					RETURNING id
				`);
				const [unlimitedDessert] = await transaction.unsafe<Array<{ id: number }>>(`
					INSERT INTO public.desserts (name, price, kind, "hasUnlimitedStock")
					VALUES ('Unlimited legacy dessert', 100, 'base', true)
					RETURNING id
				`);
				const [order] = await transaction.unsafe<Array<{ id: number }>>(`
					INSERT INTO public.orders ("customerName", "createdAt", "deliveryCost", total, status, "isDeleted")
					VALUES ('Legacy customer', '2026-07-17 10:00:00', '0.00', '360.00', 'completed', false)
					RETURNING id
				`);
				if (!finiteDessert || !modifierDessert || !unlimitedDessert || !order) {
					throw new Error("Failed to create legacy cutover fixtures");
				}

				const itemRows = await transaction.unsafe<Array<{ id: number; dessert_id: number }>>(
					`
						INSERT INTO public.order_items ("orderId", "dessertId", quantity, "unitPrice")
						VALUES ($1, $2, 1, '120.00'), ($1, $2, 2, '120.00'), ($1, $3, 1, '100.00')
						RETURNING id, "dessertId" AS dessert_id
					`,
					[order.id, finiteDessert.id, unlimitedDessert.id],
				);
				const finiteItem = itemRows.find((item) => item.dessert_id === finiteDessert.id);
				if (!finiteItem) throw new Error("Failed to create finite legacy item fixture");

				await transaction.unsafe(
					`
						INSERT INTO public.order_item_modifiers ("orderItemId", "dessertId", quantity)
						VALUES ($1, $2, 1)
					`,
					[finiteItem.id, modifierDessert.id],
				);
				await transaction.unsafe(
					`
						INSERT INTO public.inventory_audit_log
						  (day, "dessertId", action, "previousQuantity", "newQuantity", "orderId")
						VALUES ('2026-07-17 00:00:00', $1, 'order_deducted', 10, 7, $2)
					`,
					[finiteDessert.id, order.id],
				);

				await transaction.unsafe(
					"UPDATE public.inventory_audit_log SET day = '2026-07-16 00:00:00' WHERE \"orderId\" = $1",
					[order.id],
				);
				await expect(transaction.savepoint((savepoint) => savepoint.unsafe(cutoverSql))).rejects.toThrow(
					"deduction-audit operating days",
				);
				await transaction.unsafe(
					'UPDATE public.inventory_audit_log SET day = \'2026-07-17 00:00:00\', "dessertId" = NULL WHERE "orderId" = $1',
					[order.id],
				);
				await expect(transaction.savepoint((savepoint) => savepoint.unsafe(cutoverSql))).rejects.toThrow(
					"invalid deduction audits",
				);
				await transaction.unsafe('UPDATE public.inventory_audit_log SET "dessertId" = $1 WHERE "orderId" = $2', [
					finiteDessert.id,
					order.id,
				]);

				await transaction.unsafe(cutoverSql);
				const [migratedOrder] = await transaction.unsafe<Array<{ submission_id: string; request_fingerprint: string }>>(
					`SELECT "submissionId" AS submission_id, "requestFingerprint" AS request_fingerprint
					 FROM public.orders WHERE id = $1`,
					[order.id],
				);
				expect(migratedOrder).toEqual({
					submission_id: `legacy-order:${order.id}`,
					request_fingerprint: `legacy-order:${order.id}`,
				});

				const migratedItems = await transaction.unsafe<
					Array<{ dessert_id: number; name: string; inventory_deducted: boolean }>
				>(
					`SELECT "dessertId" AS dessert_id, "baseDessertName" AS name,
					        "inventoryDeducted" AS inventory_deducted
					 FROM public.order_items WHERE "orderId" = $1 ORDER BY id`,
					[order.id],
				);
				expect(migratedItems.filter((item) => item.dessert_id === finiteDessert.id)).toEqual([
					{ dessert_id: finiteDessert.id, name: "Finite legacy dessert", inventory_deducted: true },
					{ dessert_id: finiteDessert.id, name: "Finite legacy dessert", inventory_deducted: true },
				]);
				expect(migratedItems.find((item) => item.dessert_id === unlimitedDessert.id)).toEqual({
					dessert_id: unlimitedDessert.id,
					name: "Unlimited legacy dessert",
					inventory_deducted: false,
				});

				const [migratedModifier] = await transaction.unsafe<Array<{ name: string }>>(
					`SELECT "dessertName" AS name FROM public.order_item_modifiers WHERE "orderItemId" = $1`,
					[finiteItem.id],
				);
				expect(migratedModifier?.name).toBe("Legacy modifier");

				const [finalShape] = await transaction.unsafe<
					Array<{ nullable_columns: number; immediate_unique_index: boolean }>
				>(`
					SELECT
					  (SELECT count(*) FROM information_schema.columns
					   WHERE table_schema = 'public' AND is_nullable = 'YES'
					     AND (table_name, column_name) IN (
					       ('orders', 'submissionId'), ('orders', 'requestFingerprint'),
					       ('order_items', 'baseDessertName'), ('order_items', 'inventoryDeducted'),
					       ('order_item_modifiers', 'dessertName')
					     ))::integer AS nullable_columns,
					  (SELECT index_data.indisunique AND index_data.indisvalid
					          AND index_data.indisready AND index_data.indimmediate
					   FROM pg_index index_data
					   WHERE index_data.indexrelid = 'public.orders_submission_id_unique'::regclass)
					   AS immediate_unique_index
				`);
				expect(finalShape).toEqual({ nullable_columns: 0, immediate_unique_index: true });

				await transaction.unsafe(
					'CREATE INDEX orders_submission_lower_unexpected ON public.orders ((lower("submissionId")))',
				);
				await expect(transaction.savepoint((savepoint) => savepoint.unsafe(cutoverSql))).rejects.toThrow(
					"unexpected indexes reference cutover columns",
				);
				await transaction.unsafe("DROP INDEX public.orders_submission_lower_unexpected");

				await transaction.unsafe("DROP INDEX public.orders_submission_id_unique");
				await transaction.unsafe(
					'CREATE UNIQUE INDEX orders_submission_id_unique ON public.orders ("submissionId") INCLUDE (id)',
				);
				await expect(transaction.savepoint((savepoint) => savepoint.unsafe(cutoverSql))).rejects.toThrow(
					"orders_submission_id_unique has an unexpected definition",
				);
				await transaction.unsafe("DROP INDEX public.orders_submission_id_unique");
				await transaction.unsafe(
					'CREATE UNIQUE INDEX orders_submission_id_unique ON public.orders USING btree ("submissionId")',
				);

				await transaction.unsafe('ALTER TABLE public.orders ALTER COLUMN "requestFingerprint" DROP NOT NULL');
				await transaction.unsafe('UPDATE public.orders SET "requestFingerprint" = NULL WHERE id = $1', [order.id]);
				await expect(transaction.savepoint((savepoint) => savepoint.unsafe(cutoverSql))).rejects.toThrow(
					"invalid or incomplete identity pairs",
				);
				await transaction.unsafe('UPDATE public.orders SET "requestFingerprint" = "submissionId" WHERE id = $1', [
					order.id,
				]);
				await transaction.unsafe('ALTER TABLE public.orders ALTER COLUMN "requestFingerprint" SET NOT NULL');

				await transaction.unsafe(cutoverSql);
				const [rerunOrder] = await transaction.unsafe<Array<{ submission_id: string; request_fingerprint: string }>>(
					`SELECT "submissionId" AS submission_id, "requestFingerprint" AS request_fingerprint
					 FROM public.orders WHERE id = $1`,
					[order.id],
				);
				expect(rerunOrder).toEqual(migratedOrder);
				verified = true;
				throw new Error(ROLLBACK_SENTINEL);
			});
		} catch (error) {
			if (!(error instanceof Error) || error.message !== ROLLBACK_SENTINEL) throw error;
		} finally {
			await sql.end({ timeout: 5 });
		}

		expect(verified).toBe(true);
	});

	it("runs legacy inspect, stale-token rejection, apply, and verify through the real PostgreSQL adapter", async () => {
		const { targetUrl } = parseTestDatabaseUrl(process.env.TEST_DATABASE_URL);
		const setupSql = postgres(targetUrl, { max: 1, prepare: false });
		try {
			await setupSql.unsafe(`
				ALTER TABLE public.orders DROP COLUMN "submissionId";
				ALTER TABLE public.orders DROP COLUMN "requestFingerprint";
				ALTER TABLE public.order_items DROP COLUMN "baseDessertName";
				ALTER TABLE public.order_items DROP COLUMN "inventoryDeducted";
				ALTER TABLE public.order_item_modifiers DROP COLUMN "dessertName";
				INSERT INTO public.orders (id, "customerName", total, status) OVERRIDING SYSTEM VALUE
				VALUES (92003, 'Before adapter inspection', '10.00', 'completed');
			`);

			const inspect = async () => {
				const log = vi.fn();
				await expect(
					runOrderColumnsCutoverCommand({
						args: ["inspect"],
						environment: { NODE_ENV: "test", ORDER_COLUMNS_DATABASE_URL: targetUrl },
						log,
					}),
				).resolves.toBe(0);
				const token = log.mock.calls
					.flat()
					.join("\n")
					.match(/Confirmation token: ([a-f0-9]{64})/)?.[1];
				expect(token).toBeDefined();
				return token as string;
			};

			const staleToken = await inspect();
			await setupSql.unsafe("UPDATE public.orders SET \"customerName\" = 'After adapter inspection' WHERE id = 92003");
			const staleError = vi.fn();
			await expect(
				runOrderColumnsCutoverCommand({
					args: ["apply"],
					environment: {
						NODE_ENV: "test",
						ORDER_COLUMNS_DATABASE_URL: targetUrl,
						ORDER_COLUMNS_CONFIRMATION_TOKEN: staleToken,
						COCOACOMAA_ORDER_COLUMNS_ACKNOWLEDGEMENT: ORDER_COLUMNS_ACKNOWLEDGEMENT,
					},
					error: staleError,
				}),
			).resolves.toBe(1);
			expect(staleError.mock.calls.flat().join(" ")).toContain("target or preflight state changed");

			const currentToken = await inspect();
			await expect(
				runOrderColumnsCutoverCommand({
					args: ["apply"],
					environment: {
						NODE_ENV: "test",
						ORDER_COLUMNS_DATABASE_URL: targetUrl,
						ORDER_COLUMNS_CONFIRMATION_TOKEN: currentToken,
						COCOACOMAA_ORDER_COLUMNS_ACKNOWLEDGEMENT: ORDER_COLUMNS_ACKNOWLEDGEMENT,
					},
					log: vi.fn(),
				}),
			).resolves.toBe(0);

			await expect(
				runOrderColumnsCutoverCommand({
					args: ["verify"],
					environment: { NODE_ENV: "test", ORDER_COLUMNS_DATABASE_URL: targetUrl },
					log: vi.fn(),
				}),
			).resolves.toBe(0);
			const [migrated] = await setupSql.unsafe<Array<{ submission_id: string; request_fingerprint: string }>>(
				`SELECT "submissionId" AS submission_id, "requestFingerprint" AS request_fingerprint
				 FROM public.orders WHERE id = 92003`,
			);
			expect(migrated).toEqual({
				submission_id: "legacy-order:92003",
				request_fingerprint: "legacy-order:92003",
			});
		} finally {
			await setupSql.end({ timeout: 5 });
		}
	});
});
