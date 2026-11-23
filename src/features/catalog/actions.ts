"use server";

import { and, asc, eq, inArray, max, sql } from "drizzle-orm";
import type { AppDatabase } from "@/db";
import { dessertComboItemsTable, dessertCombosTable, dessertsTable } from "@/db/schema";
import { staffAction } from "@/features/access/action";
import { moveInSellOrder, sequencesFor } from "@/features/catalog/dessert-order";
import { removedFromCatalog } from "@/features/catalog/rules";
import {
	type ComboInput,
	comboIdSchema,
	comboInputSchema,
	type DessertInput,
	type DessertKind,
	dessertIdSchema,
	dessertInputSchema,
	listingSchema,
	type MoveDirection,
	moveDessertSchema,
} from "@/features/catalog/schemas";
import { COMBO_TAGS, DESSERT_TAGS } from "@/features/catalog/tags";
import { causeChain, UserFacingError } from "@/lib/errors";
import { formatList } from "@/lib/format";
import { stripMarkup } from "@/lib/sanitize";
import { writeAndRefresh } from "@/server/effect/write-and-refresh";

const UNIQUE_VIOLATION = "23505";

async function withUniqueDessertName<A>(run: () => Promise<A>): Promise<A> {
	try {
		return await run();
	} catch (error) {
		for (const link of causeChain(error)) {
			if ((link as { code?: unknown }).code === UNIQUE_VIOLATION) {
				throw new UserFacingError("A dessert with this name already exists");
			}
		}
		throw error;
	}
}

type Updater = Pick<AppDatabase, "update">;

/** Changes a dessert still in the catalog; a deleted one is reported, not changed. */
async function updateLiveDessert(db: Updater, id: number, changes: Partial<typeof dessertsTable.$inferInsert>) {
	const updated = await db
		.update(dessertsTable)
		.set(changes)
		.where(and(eq(dessertsTable.id, id), eq(dessertsTable.isDeleted, false)))
		.returning({ id: dessertsTable.id });
	if (updated.length === 0) throw new UserFacingError("This dessert has been deleted");
}

/** Changes a combo still in the catalog; a deleted one is reported, not changed. */
async function updateLiveCombo(db: Updater, id: number, changes: Partial<typeof dessertCombosTable.$inferInsert>) {
	const updated = await db
		.update(dessertCombosTable)
		.set({ ...changes, updatedAt: new Date() })
		.where(and(eq(dessertCombosTable.id, id), eq(dessertCombosTable.isDeleted, false)))
		.returning({ id: dessertCombosTable.id });
	if (updated.length === 0) throw new UserFacingError("This combo has been deleted");
}

/** A dessert as stored. Unlimited stock never runs out, so it clears "out of stock". */
function dessertValues(input: DessertInput) {
	const { description, ...fields } = dessertInputSchema.parse(input);
	return {
		...fields,
		isOutOfStock: fields.isOutOfStock && !fields.hasUnlimitedStock,
		description: description ? stripMarkup(description) : null,
	};
}

/**
 * Refuses to make a dessert `kind` while a combo on sale needs it as the other kind (a combo's
 * base must be a dessert, its add-ons add-ons), since that would quietly take the combo off sale.
 */
async function refuseKindChangeUnderListedCombos(
	tx: Pick<AppDatabase, "select" | "selectDistinct">,
	dessertId: number,
	kind: DessertKind,
) {
	const listed = and(eq(dessertCombosTable.enabled, true), eq(dessertCombosTable.isDeleted, false));
	const combos =
		kind === "base"
			? await tx
					.selectDistinct({ name: dessertCombosTable.name })
					.from(dessertComboItemsTable)
					.innerJoin(dessertCombosTable, eq(dessertComboItemsTable.comboId, dessertCombosTable.id))
					.where(and(listed, eq(dessertComboItemsTable.dessertId, dessertId)))
			: await tx
					.select({ name: dessertCombosTable.name })
					.from(dessertCombosTable)
					.where(and(listed, eq(dessertCombosTable.baseDessertId, dessertId)));
	if (combos.length === 0) return;
	const one = combos.length === 1;
	throw new UserFacingError(
		`${formatList(combos.map(({ name }) => name))} ${one ? "is a combo" : "are combos"} on sale using this dessert, so its type can't change. Hide ${one ? "it" : "them"} first.`,
	);
}

/** Adds a dessert on sale, at the end of the Sell-screen order. */
export const createDessert = staffAction(async (_user, input: DessertInput) => {
	const values = dessertValues(input);
	await writeAndRefresh("create dessert", DESSERT_TAGS, (db) =>
		withUniqueDessertName(() =>
			db.transaction(async (tx) => {
				const [last] = await tx
					.select({ sequence: max(dessertsTable.sequence) })
					.from(dessertsTable)
					.where(eq(dessertsTable.isDeleted, false));
				await tx.insert(dessertsTable).values({ ...values, enabled: true, sequence: (last?.sequence ?? -1) + 1 });
			}),
		),
	);
});

export const updateDessert = staffAction(async (_user, id: number, input: DessertInput) => {
	const dessertId = dessertIdSchema.parse(id);
	const values = dessertValues(input);
	await writeAndRefresh("update dessert", DESSERT_TAGS, (db) =>
		withUniqueDessertName(() =>
			db.transaction(async (tx) => {
				const [current] = await tx
					.select({ kind: dessertsTable.kind })
					.from(dessertsTable)
					.where(eq(dessertsTable.id, dessertId))
					.for("update");
				if (current && current.kind !== values.kind) {
					await refuseKindChangeUnderListedCombos(tx, dessertId, values.kind);
				}
				await updateLiveDessert(tx, dessertId, values);
			}),
		),
	);
});

/** Removes a dessert from the catalog. Its name is free to reuse: names are unique among undeleted desserts only. */
export const deleteDessert = staffAction(async (_user, id: number) => {
	const dessertId = dessertIdSchema.parse(id);
	await writeAndRefresh("delete dessert", DESSERT_TAGS, (db) => updateLiveDessert(db, dessertId, { isDeleted: true }));
});

/** Puts a dessert on the Sell screen or takes it off. Putting it back on also clears "out of stock". */
export const setDessertListed = staffAction(async (_user, id: number, enabled: boolean) => {
	const listing = listingSchema.parse({ id, enabled });
	await writeAndRefresh("list dessert", DESSERT_TAGS, (db) =>
		updateLiveDessert(db, listing.id, {
			enabled: listing.enabled,
			...(listing.enabled ? { isOutOfStock: false } : {}),
		}),
	);
});

export const restockDessert = staffAction(async (_user, id: number) => {
	const dessertId = dessertIdSchema.parse(id);
	await writeAndRefresh("restock dessert", DESSERT_TAGS, (db) =>
		updateLiveDessert(db, dessertId, { isOutOfStock: false }),
	);
});

export const hideAllDesserts = staffAction(async () => {
	await writeAndRefresh("hide all desserts", DESSERT_TAGS, (db) =>
		db.update(dessertsTable).set({ enabled: false }).where(eq(dessertsTable.isDeleted, false)),
	);
});

/** Moves a dessert on sale up, down, to the top or to the bottom of the Sell-screen order. */
export const moveDessert = staffAction(async (_user, id: number, direction: MoveDirection) => {
	const move = moveDessertSchema.parse({ id, direction });
	await writeAndRefresh("move dessert", DESSERT_TAGS, (db) =>
		db.transaction(async (tx) => {
			const listed = await tx
				.select({ id: dessertsTable.id, enabled: dessertsTable.enabled, sequence: dessertsTable.sequence })
				.from(dessertsTable)
				.where(eq(dessertsTable.isDeleted, false))
				.orderBy(asc(dessertsTable.sequence), asc(dessertsTable.id))
				.for("update");

			const moved = moveInSellOrder(listed, move.id, move.direction);
			if (!moved) throw new UserFacingError("Only desserts on sale can be reordered");

			const renumbered = sequencesFor(moved).filter((dessert, index) => dessert !== moved[index]);
			if (renumbered.length === 0) return;
			const cases = renumbered.map(({ id, sequence }) => sql`WHEN ${id} THEN ${sequence}::integer`);
			await tx
				.update(dessertsTable)
				.set({ sequence: sql`CASE ${dessertsTable.id} ${sql.join(cases, sql` `)} END` })
				.where(
					inArray(
						dessertsTable.id,
						renumbered.map((dessert) => dessert.id),
					),
				);
		}),
	);
});

/** Creates or updates a combo together with its add-ons; returns its id. */
export const saveCombo = staffAction(async (_user, input: ComboInput) => {
	const combo = comboInputSchema.parse(input);
	return writeAndRefresh("save combo", COMBO_TAGS, (db) =>
		db.transaction(async (tx) => {
			// Order saves take the combo lock before locking its desserts.
			if (combo.id !== undefined) {
				const [current] = await tx
					.select({ id: dessertCombosTable.id })
					.from(dessertCombosTable)
					.where(and(eq(dessertCombosTable.id, combo.id), eq(dessertCombosTable.isDeleted, false)))
					.for("no key update");
				if (!current) throw new UserFacingError("This combo has been deleted");
			}

			const dessertIds = [combo.baseDessertId, ...combo.addOns.map(({ dessertId }) => dessertId)];
			const desserts = await tx
				.select({
					id: dessertsTable.id,
					name: dessertsTable.name,
					kind: dessertsTable.kind,
					isDeleted: dessertsTable.isDeleted,
				})
				.from(dessertsTable)
				.where(inArray(dessertsTable.id, dessertIds))
				.orderBy(asc(dessertsTable.id))
				.for("share");
			const byId = new Map(desserts.map((dessert) => [dessert.id, dessert]));
			const removed = dessertIds.flatMap((id) => {
				const dessert = byId.get(id);
				return dessert && !dessert.isDeleted ? [] : [dessert?.name ?? `Dessert #${id}`];
			});
			if (removed.length > 0) {
				const fix =
					removed.length === 1
						? "Pick another dessert or take it out of the combo."
						: "Pick other desserts or take them out of the combo.";
				throw new UserFacingError(`${removedFromCatalog(removed)}. ${fix}`);
			}
			if (byId.get(combo.baseDessertId)?.kind !== "base") {
				throw new UserFacingError("The base must be a dessert, not an add-on");
			}
			if (combo.addOns.some(({ dessertId }) => byId.get(dessertId)?.kind !== "modifier")) {
				throw new UserFacingError("Every add-on must be a dessert of the Add-on type");
			}

			const fields = {
				name: combo.name,
				baseDessertId: combo.baseDessertId,
				overridePrice: combo.overridePrice,
				enabled: combo.enabled,
			};
			let comboId: number;
			if (combo.id === undefined) {
				const [created] = await tx
					.insert(dessertCombosTable)
					.values({ ...fields, updatedAt: new Date() })
					.returning({ id: dessertCombosTable.id });
				comboId = created.id;
			} else {
				comboId = combo.id;
				await updateLiveCombo(tx, comboId, fields);
				await tx.delete(dessertComboItemsTable).where(eq(dessertComboItemsTable.comboId, comboId));
			}
			await tx
				.insert(dessertComboItemsTable)
				.values(combo.addOns.map(({ dessertId, quantity }) => ({ comboId, dessertId, quantity })));
			return comboId;
		}),
	);
});

export const setComboListed = staffAction(async (_user, id: number, enabled: boolean) => {
	const listing = listingSchema.parse({ id, enabled });
	await writeAndRefresh("list combo", COMBO_TAGS, (db) =>
		updateLiveCombo(db, listing.id, { enabled: listing.enabled }),
	);
});

export const deleteCombo = staffAction(async (_user, id: number) => {
	const comboId = comboIdSchema.parse(id);
	await writeAndRefresh("delete combo", COMBO_TAGS, (db) => updateLiveCombo(db, comboId, { isDeleted: true }));
});
