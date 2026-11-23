import { asc, eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { dessertComboItemsTable, dessertCombosTable, dessertsTable } from "@/db/schema";
import { COMBO_TAGS, DESSERT_TAGS } from "@/features/catalog/tags";
import { closeIntegrationDatabase, integrationDb, resetIntegrationData } from "@/test/integration/database";
import { createTaggedCache } from "@/test/integration/tagged-cache";
import { mockStaffSessions, signedInAs } from "@/test/staff-session";

const cache = createTaggedCache();
vi.doMock("server-only", () => ({}));
vi.doMock("@/db", () => ({ db: integrationDb }));
vi.doMock("next/cache", () => cache.nextCache);
mockStaffSessions();

const staff = { id: "catalog-staff", area: "manager" } as const;
const actions = await import("@/features/catalog/actions");
const queries = await import("@/features/catalog/queries");
const createDessert = signedInAs(staff, actions.createDessert);
const deleteCombo = signedInAs(staff, actions.deleteCombo);
const deleteDessert = signedInAs(staff, actions.deleteDessert);
const hideAllDesserts = signedInAs(staff, actions.hideAllDesserts);
const moveDessert = signedInAs(staff, actions.moveDessert);
const saveCombo = signedInAs(staff, actions.saveCombo);
const setComboListed = signedInAs(staff, actions.setComboListed);
const setDessertListed = signedInAs(staff, actions.setDessertListed);
const restockDessert = signedInAs(staff, actions.restockDessert);
const updateDessert = signedInAs(staff, actions.updateDessert);
const getComboCatalog = signedInAs(staff, queries.getComboCatalog);
const getDesserts = signedInAs(staff, queries.getDesserts);
const getCatalogDesserts = signedInAs(staff, queries.getCatalogDesserts);
const getEnabledCombos = signedInAs(staff, queries.getEnabledCombos);

const dessert = { description: "", isOutOfStock: false, hasUnlimitedStock: false } as const;
/** A change answered as done, naming what it refreshed for the client. */
const dessertChanged = { ok: true, data: undefined, refreshed: DESSERT_TAGS };
const comboChanged = { ok: true, data: undefined, refreshed: COMBO_TAGS };

async function seed(name: string, kind: "base" | "modifier" = "base") {
	expect(await createDessert({ ...dessert, name, price: 100, kind })).toEqual(dessertChanged);
	const [row] = await integrationDb.select().from(dessertsTable).where(eq(dessertsTable.name, name));
	return row;
}

async function sellOrder() {
	return (await getDesserts()).map(({ name }) => name);
}

async function seedCombo(name = "Brownie combo") {
	const base = await seed("Brownie");
	const nutella = await seed("Nutella", "modifier");
	const saved = await saveCombo({
		name,
		baseDessertId: base.id,
		overridePrice: null,
		enabled: true,
		addOns: [{ dessertId: nutella.id, quantity: 1 }],
	});
	if (!saved.ok) throw new Error(saved.error);
	return { id: saved.data, base, nutella };
}

beforeEach(async () => {
	cache.clear();
	await resetIntegrationData();
});
afterAll(closeIntegrationDatabase);

describe("desserts", () => {
	it("adds new desserts at the end of the Sell-screen order, with names in title case", async () => {
		await seed("Brownie");
		expect(await sellOrder()).toEqual(["Brownie"]);
		await createDessert({ ...dessert, name: "  choco lava ", price: 120, kind: "base" });
		expect(await sellOrder()).toEqual(["Brownie", "Choco Lava"]);
	});

	it("refuses a duplicate name, and frees the name once the dessert is deleted", async () => {
		const brownie = await seed("Brownie");
		expect(await createDessert({ ...dessert, name: "brownie", price: 90, kind: "base" })).toEqual({
			ok: false,
			error: "A dessert with this name already exists",
		});
		expect(await deleteDessert(brownie.id)).toEqual(dessertChanged);
		expect(await sellOrder()).toEqual([]);
		expect(await createDessert({ ...dessert, name: "Brownie", price: 90, kind: "base" })).toEqual(dessertChanged);
	});

	it("refuses a price the form would also refuse", async () => {
		expect(await createDessert({ ...dessert, name: "Free", price: 0, kind: "base" })).toEqual({
			ok: false,
			error: "Price must be more than 0",
		});
	});

	it("moves desserts on sale around hidden ones, and refuses to move a hidden one", async () => {
		const [a, b, c] = [await seed("A"), await seed("B"), await seed("C")];
		await setDessertListed(b.id, false);

		expect(await moveDessert(c.id, "up")).toEqual(dessertChanged);
		expect(await sellOrder()).toEqual(["C", "A"]);
		await moveDessert(c.id, "bottom");
		expect(await sellOrder()).toEqual(["A", "C"]);
		expect(await moveDessert(b.id, "top")).toEqual({ ok: false, error: "Only desserts on sale can be reordered" });

		const all = await integrationDb.select().from(dessertsTable).orderBy(asc(dessertsTable.sequence));
		expect(all.map(({ id }) => id)).toEqual([b.id, a.id, c.id]);
	});

	it("puts a dessert back on sale no longer out of stock", async () => {
		const brownie = await seed("Brownie");
		await integrationDb.update(dessertsTable).set({ isOutOfStock: true }).where(eq(dessertsTable.id, brownie.id));
		await setDessertListed(brownie.id, false);
		expect(await sellOrder()).toEqual([]);

		expect(await setDessertListed(brownie.id, true)).toEqual(dessertChanged);
		expect(await getDesserts()).toMatchObject([{ name: "Brownie", enabled: true, isOutOfStock: false }]);
	});

	it("hides every dessert from the Sell screen but keeps them in the catalog", async () => {
		await seed("Brownie");
		await seed("Nutella", "modifier");
		expect(await sellOrder()).toEqual(["Brownie", "Nutella"]);
		expect(await hideAllDesserts()).toEqual(dessertChanged);
		expect(await sellOrder()).toEqual([]);
		expect((await getCatalogDesserts()).map(({ name, enabled }) => ({ name, enabled }))).toEqual([
			{ name: "Brownie", enabled: false },
			{ name: "Nutella", enabled: false },
		]);
	});

	it("stores an unlimited-stock dessert as never out of stock, and keeps plain-text descriptions", async () => {
		await createDessert({
			...dessert,
			name: "Cookie",
			price: 50,
			kind: "base",
			hasUnlimitedStock: true,
			isOutOfStock: true,
			description: "<b>Bonbons</b> = 5 per box",
		});
		expect(await getDesserts()).toMatchObject([
			{ name: "Cookie", hasUnlimitedStock: true, isOutOfStock: false, description: "Bonbons = 5 per box" },
		]);
	});

	it("leaves a deleted dessert alone and says so", async () => {
		const brownie = await seed("Brownie");
		await deleteDessert(brownie.id);
		const deleted = { ok: false, error: "This dessert has been deleted" };

		expect(await setDessertListed(brownie.id, true)).toEqual(deleted);
		expect(await restockDessert(brownie.id)).toEqual(deleted);
		expect(await updateDessert(brownie.id, { ...dessert, name: "Brownie", price: 1, kind: "base" })).toEqual(deleted);
		expect(await deleteDessert(brownie.id)).toEqual(deleted);
		expect(await getCatalogDesserts()).toEqual([]);
	});
});

describe("combos", () => {
	it("saves a combo and its add-ons together, and replaces the add-ons on edit", async () => {
		const { id, base } = await seedCombo();
		const oreo = await seed("Oreo", "modifier");
		expect((await getComboCatalog()).combos.map(({ name }) => name)).toEqual(["Brownie combo"]);

		await saveCombo({
			id,
			name: "Brownie combo",
			baseDessertId: base.id,
			overridePrice: 150,
			enabled: true,
			addOns: [{ dessertId: oreo.id, quantity: 1 }],
		});
		const [combo] = (await getComboCatalog()).combos;
		expect(combo).toMatchObject({ id, overridePrice: 150 });
		expect(combo.items.map(({ dessertId, quantity }) => ({ dessertId, quantity }))).toEqual([
			{ dessertId: oreo.id, quantity: 1 },
		]);
	});

	it("writes nothing when the base or an add-on is the wrong kind of dessert", async () => {
		const base = await seed("Brownie");
		const nutella = await seed("Nutella", "modifier");
		const request = { name: "Combo", overridePrice: null, enabled: true };

		expect(
			await saveCombo({ ...request, baseDessertId: nutella.id, addOns: [{ dessertId: nutella.id, quantity: 1 }] }),
		).toEqual({ ok: false, error: "The base must be a dessert, not an add-on" });
		expect(
			await saveCombo({ ...request, baseDessertId: base.id, addOns: [{ dessertId: base.id, quantity: 1 }] }),
		).toEqual({ ok: false, error: "Every add-on must be a dessert of the Add-on type" });
		expect(await saveCombo({ ...request, baseDessertId: base.id, addOns: [] })).toEqual({
			ok: false,
			error: "Pick at least one add-on",
		});

		expect(await integrationDb.select().from(dessertCombosTable)).toHaveLength(0);
		expect(await integrationDb.select().from(dessertComboItemsTable)).toHaveLength(0);
	});

	it("names the desserts a combo can't be saved with because they were removed", async () => {
		const { id, base, nutella } = await seedCombo();
		await deleteDessert(base.id);
		await deleteDessert(nutella.id);
		const request = {
			id,
			name: "Brownie combo",
			overridePrice: null,
			enabled: true,
			baseDessertId: base.id,
			addOns: [{ dessertId: nutella.id, quantity: 1 }],
		};

		expect(await saveCombo(request)).toEqual({
			ok: false,
			error: "Brownie and Nutella were removed from the catalog. Pick other desserts or take them out of the combo.",
		});
		const cake = await seed("Cake");
		expect(await saveCombo({ ...request, baseDessertId: cake.id })).toEqual({
			ok: false,
			error: "Nutella was removed from the catalog. Pick another dessert or take it out of the combo.",
		});
	});

	it("takes a combo off the Sell screen when it is switched off or deleted", async () => {
		const { id } = await seedCombo();
		expect((await getEnabledCombos()).map(({ name }) => name)).toEqual(["Brownie combo"]);

		expect(await setComboListed(id, false)).toEqual(comboChanged);
		expect(await getEnabledCombos()).toEqual([]);
		expect((await getComboCatalog()).combos).toMatchObject([{ id, enabled: false }]);

		expect(await deleteCombo(id)).toEqual(comboChanged);
		expect((await getComboCatalog()).combos).toEqual([]);
	});

	it("leaves a deleted combo alone and says so", async () => {
		const { id, base, nutella } = await seedCombo();
		await deleteCombo(id);
		const deleted = { ok: false, error: "This combo has been deleted" };

		expect(await setComboListed(id, true)).toEqual(deleted);
		expect(await deleteCombo(id)).toEqual(deleted);
		expect(
			await saveCombo({
				id,
				name: "Brownie combo",
				baseDessertId: base.id,
				overridePrice: null,
				enabled: true,
				addOns: [{ dessertId: nutella.id, quantity: 1 }],
			}),
		).toEqual(deleted);
		expect((await getComboCatalog()).combos).toEqual([]);
	});

	it("refuses to change the type of a dessert a combo on sale uses, until the combo is hidden", async () => {
		const { id, base, nutella } = await seedCombo();
		const refused = {
			ok: false,
			error: "Brownie combo is a combo on sale using this dessert, so its type can't change. Hide it first.",
		};

		expect(await updateDessert(base.id, { ...dessert, name: "Brownie", price: 100, kind: "modifier" })).toEqual(
			refused,
		);
		expect(await updateDessert(nutella.id, { ...dessert, name: "Nutella", price: 100, kind: "base" })).toEqual(refused);
		expect(await updateDessert(base.id, { ...dessert, name: "Brownie", price: 120, kind: "base" })).toEqual(
			dessertChanged,
		);
		expect((await getDesserts()).map(({ name, kind }) => ({ name, kind }))).toEqual([
			{ name: "Brownie", kind: "base" },
			{ name: "Nutella", kind: "modifier" },
		]);

		await setComboListed(id, false);
		expect(await updateDessert(nutella.id, { ...dessert, name: "Nutella", price: 100, kind: "base" })).toEqual(
			dessertChanged,
		);
	});

	it("shows a dessert edit inside both cached combo reads", async () => {
		const { base, nutella } = await seedCombo();
		const readCombos = [getEnabledCombos, async () => (await getComboCatalog()).combos];
		for (const read of readCombos) {
			expect((await read())[0].baseDessert).toMatchObject({ name: "Brownie", price: 100 });
			expect((await read())[0].items[0].dessert.isOutOfStock).toBe(false);
		}

		expect(await updateDessert(base.id, { ...dessert, name: "Fudge Brownie", price: 150, kind: "base" })).toEqual(
			dessertChanged,
		);
		expect(
			await updateDessert(nutella.id, {
				...dessert,
				name: "Nutella",
				price: nutella.price,
				kind: "modifier",
				isOutOfStock: true,
			}),
		).toEqual(dessertChanged);
		for (const read of readCombos) {
			expect((await read())[0].baseDessert).toMatchObject({ name: "Fudge Brownie", price: 150 });
			expect((await read())[0].items[0].dessert.isOutOfStock).toBe(true);
		}
	});
});
