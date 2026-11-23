import "server-only";

import { createHash } from "node:crypto";
import { and, asc, eq, inArray } from "drizzle-orm";
import type { AppDatabase, Transaction } from "@/db";
import {
	dessertComboItemsTable,
	dessertCombosTable,
	dessertsTable,
	orderItemModifiersTable,
	orderItemsTable,
	ordersTable,
} from "@/db/schema";
import type { Dessert } from "@/features/catalog/queries";
import { comboUnitPrice, isComboOnSale, isDessertOnSale } from "@/features/catalog/rules";
import { returnOrderStock, takeOrderStock } from "@/features/inventory/stock-ledger";
import {
	type CreateOrderAck,
	type CreateOrderRequest,
	canCancelOn,
	cancellationNote,
	MAX_ORDER_TOTAL_CENTS,
	MAX_UNIT_PRICE,
	type OrderRequestLine,
	serializeOrderSubmission,
} from "@/features/orders/contract";
import { ORDER_STATUS } from "@/features/orders/sale";
import { orderChangeTags } from "@/features/orders/tags";
import { UserFacingError } from "@/lib/errors";
import { centsToDecimal, toCents } from "@/lib/money";
import { dayKeyOf } from "@/lib/shop-calendar";
import { writeAndRefresh } from "@/server/effect/write-and-refresh";

type CatalogDessert = Pick<
	Dessert,
	"enabled" | "hasUnlimitedStock" | "id" | "isDeleted" | "isOutOfStock" | "kind" | "name" | "price"
>;

type CatalogCombo = {
	id: number;
	name: string;
	baseDessertId: number;
	overridePrice: number | null;
	enabled: boolean;
	isDeleted: boolean;
};

type CatalogComboItem = { comboId: number; dessertId: number; quantity: number };

type ResolvedOrderLine = {
	baseDessertId: number;
	baseDessertName: string;
	comboId: number | null;
	comboName: string | null;
	hasUnlimitedStock: boolean;
	modifiers: { dessertId: number; dessertName: string; quantity: number }[];
	quantity: number;
	unitPrice: number;
};

/** A line's identity within one order: its base dessert plus its combo, or a direct sale. */
function lineReference(dessertId: number, comboId: number | null | undefined) {
	return `${dessertId}:${comboId ?? "direct"}`;
}

function assertSupportedUnitPrice(unitPrice: number) {
	if (!Number.isSafeInteger(unitPrice) || unitPrice < 0 || unitPrice > MAX_UNIT_PRICE) {
		throw new UserFacingError("An item's price is more than an order can hold");
	}
}

/** Prices each requested line from the current catalog, refusing anything that is not on sale. */
function resolveOrderLines(
	lines: readonly OrderRequestLine[],
	desserts: readonly CatalogDessert[],
	combos: readonly CatalogCombo[],
	comboItems: readonly CatalogComboItem[],
): ResolvedOrderLine[] {
	const dessertById = new Map(desserts.map((dessert) => [dessert.id, dessert]));
	const comboById = new Map(combos.map((combo) => [combo.id, combo]));
	const itemsByComboId = Map.groupBy(comboItems, (item) => item.comboId);

	const references = new Set<string>();
	return lines.map((line) => {
		const reference = lineReference(line.baseDessertId, line.comboId);
		if (references.has(reference)) throw new UserFacingError("The order lists the same item twice");
		references.add(reference);

		const base = dessertById.get(line.baseDessertId);
		if (!base || base.kind !== "base") throw new UserFacingError("A dessert in this order no longer exists");
		const direct = {
			baseDessertId: base.id,
			baseDessertName: base.name,
			hasUnlimitedStock: base.hasUnlimitedStock,
			quantity: line.quantity,
		};

		if (line.comboId === undefined) {
			if (!isDessertOnSale(base)) throw new UserFacingError(`${base.name} is not on sale right now`);
			assertSupportedUnitPrice(base.price);
			return { ...direct, comboId: null, comboName: null, modifiers: [], unitPrice: base.price };
		}

		const combo = comboById.get(line.comboId);
		if (!combo || combo.baseDessertId !== base.id) {
			throw new UserFacingError("A combo in this order no longer exists");
		}
		const addOns = (itemsByComboId.get(combo.id) ?? []).map((item) => {
			const dessert = dessertById.get(item.dessertId);
			return dessert ? { dessert, quantity: item.quantity } : undefined;
		});
		if (
			!addOns.every((addOn) => addOn !== undefined) ||
			!isComboOnSale(
				combo,
				base,
				addOns.map((addOn) => addOn.dessert),
			)
		) {
			throw new UserFacingError(`${combo.name} is not on sale right now`);
		}

		const modifiers = addOns.map(({ dessert, quantity }) => {
			assertSupportedUnitPrice(dessert.price);
			return { dessertId: dessert.id, dessertName: dessert.name, quantity, price: dessert.price };
		});
		assertSupportedUnitPrice(base.price);
		const unitPrice = comboUnitPrice(combo.overridePrice, base.price, modifiers);
		assertSupportedUnitPrice(unitPrice);

		return {
			...direct,
			comboId: combo.id,
			comboName: combo.name,
			modifiers: modifiers.map(({ price: _, ...modifier }) => modifier),
			unitPrice,
		};
	});
}

/** Reads and share-locks the catalog rows the order refers to, so concurrent catalog edits wait for it. */
async function resolveAndLockOrderLines(tx: Transaction, lines: readonly OrderRequestLine[]) {
	const comboIds = [...new Set(lines.flatMap((line) => (line.comboId === undefined ? [] : [line.comboId])))].sort(
		(a, b) => a - b,
	);
	const [combos, comboItems] =
		comboIds.length === 0
			? [[], []]
			: await Promise.all([
					tx
						.select({
							id: dessertCombosTable.id,
							name: dessertCombosTable.name,
							baseDessertId: dessertCombosTable.baseDessertId,
							overridePrice: dessertCombosTable.overridePrice,
							enabled: dessertCombosTable.enabled,
							isDeleted: dessertCombosTable.isDeleted,
						})
						.from(dessertCombosTable)
						.where(inArray(dessertCombosTable.id, comboIds))
						.orderBy(asc(dessertCombosTable.id))
						.for("no key update"),
					tx
						.select({
							comboId: dessertComboItemsTable.comboId,
							dessertId: dessertComboItemsTable.dessertId,
							quantity: dessertComboItemsTable.quantity,
						})
						.from(dessertComboItemsTable)
						.where(inArray(dessertComboItemsTable.comboId, comboIds))
						.orderBy(asc(dessertComboItemsTable.comboId), asc(dessertComboItemsTable.dessertId))
						.for("no key update"),
				]);

	const dessertIds = [
		...new Set([...lines.map((line) => line.baseDessertId), ...comboItems.map((item) => item.dessertId)]),
	].sort((a, b) => a - b);
	const desserts = await tx
		.select({
			id: dessertsTable.id,
			name: dessertsTable.name,
			price: dessertsTable.price,
			kind: dessertsTable.kind,
			enabled: dessertsTable.enabled,
			isDeleted: dessertsTable.isDeleted,
			isOutOfStock: dessertsTable.isOutOfStock,
			hasUnlimitedStock: dessertsTable.hasUnlimitedStock,
		})
		.from(dessertsTable)
		.where(inArray(dessertsTable.id, dessertIds))
		.orderBy(asc(dessertsTable.id))
		.for("no key update");

	return resolveOrderLines(lines, desserts, combos, comboItems);
}

function orderTotalCents(lines: readonly ResolvedOrderLine[], deliveryCost: string) {
	const totalCents = lines.reduce((total, line) => total + line.quantity * line.unitPrice * 100, toCents(deliveryCost));
	if (!Number.isSafeInteger(totalCents) || totalCents > MAX_ORDER_TOTAL_CENTS) {
		throw new UserFacingError("The order total is more than an order can hold");
	}
	return totalCents;
}

function fingerprint(request: CreateOrderRequest) {
	return createHash("sha256").update(serializeOrderSubmission(request)).digest("hex");
}

/**
 * Saves the order, its items and their modifiers, and takes its stock, in one transaction. A
 * submission id that is already saved replays that order instead, provided the request matches.
 */
function saveOrder(db: AppDatabase, request: CreateOrderRequest, userId: string, now: Date): Promise<CreateOrderAck> {
	const requestFingerprint = fingerprint(request);
	return db.transaction(async (tx) => {
		// The submission id is claimed first, with a zero total until the lines are priced, so a
		// concurrent retry of the same request waits here.
		const [claimed] = await tx
			.insert(ordersTable)
			.values({
				submissionId: request.submissionId,
				requestFingerprint,
				customerName: request.customerName,
				createdAt: now,
				status: ORDER_STATUS.completed,
				total: "0.00",
				deliveryCost: request.deliveryCost,
			})
			.onConflictDoNothing({ target: ordersTable.submissionId })
			.returning({ id: ordersTable.id });

		if (!claimed) {
			const [saved] = await tx
				.select({
					id: ordersTable.id,
					createdAt: ordersTable.createdAt,
					requestFingerprint: ordersTable.requestFingerprint,
				})
				.from(ordersTable)
				.where(eq(ordersTable.submissionId, request.submissionId));
			if (!saved) throw new Error("Order submission winner was not visible");
			if (saved.requestFingerprint !== requestFingerprint) {
				throw new UserFacingError("This order submission was already used for different order details.");
			}
			return { orderId: saved.id, day: dayKeyOf(saved.createdAt), replayed: true };
		}

		const day = dayKeyOf(now);
		const lines = await resolveAndLockOrderLines(tx, request.lines);
		const total = centsToDecimal(orderTotalCents(lines, request.deliveryCost));
		// Independent statements on one connection pipeline into a single roundtrip.
		const [, insertedItems] = await Promise.all([
			tx.update(ordersTable).set({ total }).where(eq(ordersTable.id, claimed.id)),
			tx
				.insert(orderItemsTable)
				.values(
					lines.map((line) => ({
						orderId: claimed.id,
						dessertId: line.baseDessertId,
						baseDessertName: line.baseDessertName,
						inventoryDeducted: !line.hasUnlimitedStock,
						quantity: line.quantity,
						unitPrice: centsToDecimal(line.unitPrice * 100),
						comboId: line.comboId,
						comboName: line.comboName,
					})),
				)
				.returning({
					id: orderItemsTable.id,
					dessertId: orderItemsTable.dessertId,
					comboId: orderItemsTable.comboId,
				}),
		]);

		const itemIdByReference = new Map(
			insertedItems.map((item) => [lineReference(item.dessertId, item.comboId), item.id]),
		);
		const modifierRows = lines.flatMap((line) => {
			const orderItemId = itemIdByReference.get(lineReference(line.baseDessertId, line.comboId));
			if (orderItemId === undefined) throw new Error("Inserted order item could not be matched to its line");
			return line.modifiers.map((modifier) => ({ orderItemId, ...modifier }));
		});

		await Promise.all([
			modifierRows.length > 0 ? tx.insert(orderItemModifiersTable).values(modifierRows) : undefined,
			takeOrderStock(
				tx,
				{ orderId: claimed.id, userId, dayKey: day, now },
				lines
					.filter((line) => !line.hasUnlimitedStock)
					.map((line) => ({ dessertId: line.baseDessertId, quantity: line.quantity, name: line.baseDessertName })),
			),
		]);

		return { orderId: claimed.id, day, replayed: false };
	});
}

export function createCompletedOrder(request: CreateOrderRequest, userId: string): Promise<CreateOrderAck> {
	return writeAndRefresh(
		"create completed order",
		(ack) => orderChangeTags(ack.day),
		(db) => saveOrder(db, request, userId, new Date()),
	);
}

/** Cancels an order placed today and puts its stock back. Cancelling is the only way to reverse an order. */
export async function cancelCompletedOrder(orderId: number, userId: string, reason?: string): Promise<void> {
	const now = new Date();
	await writeAndRefresh("cancel order", orderChangeTags, (db) =>
		db.transaction(async (tx) => {
			const [order] = await tx
				.select({ status: ordersTable.status, isDeleted: ordersTable.isDeleted, createdAt: ordersTable.createdAt })
				.from(ordersTable)
				.where(eq(ordersTable.id, orderId))
				.for("update");

			if (!order || order.isDeleted) throw new UserFacingError("Order not found");
			if (order.status === ORDER_STATUS.cancelled) throw new UserFacingError("Order is already cancelled");
			const orderDay = dayKeyOf(order.createdAt);
			if (!canCancelOn(orderDay, dayKeyOf(now))) {
				throw new UserFacingError("Orders can only be cancelled on the day they were placed");
			}

			const [, deducted] = await Promise.all([
				tx.update(ordersTable).set({ status: ORDER_STATUS.cancelled }).where(eq(ordersTable.id, orderId)),
				tx
					.select({ dessertId: orderItemsTable.dessertId })
					.from(orderItemsTable)
					.where(and(eq(orderItemsTable.orderId, orderId), eq(orderItemsTable.inventoryDeducted, true))),
			]);
			await returnOrderStock(
				tx,
				{ orderId, userId, dayKey: orderDay, now, note: cancellationNote(reason) },
				deducted.map(({ dessertId }) => dessertId),
			);
			return orderDay;
		}),
	);
}
