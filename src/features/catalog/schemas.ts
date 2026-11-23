import { z } from "zod";
import { capitalizeWords } from "@/lib/format";

const recordId = z.number().int().positive();

/** The highest price, in rupees, a dessert or a combo can be given. */
const MAX_PRICE = 1_000_000;

const dessertKinds = ["base", "modifier"] as const;
export type DessertKind = (typeof dessertKinds)[number];

/** What staff enter for a dessert. The Add and Edit forms and the server check the same rules. */
export const dessertInputSchema = z.object({
	name: z
		.string()
		.trim()
		.min(1, "Name is required")
		.max(255, "Name is too long")
		// "choco fudge" and "Choco Fudge" read the same on the Sell screen.
		.transform(capitalizeWords),
	description: z.string().trim().max(255, "Description is too long"),
	price: z
		.number({ error: "Enter a price" })
		.int("Price must be a whole number of rupees")
		.positive("Price must be more than 0")
		.max(MAX_PRICE, "Price is too high"),
	kind: z.enum(dessertKinds),
	isOutOfStock: z.boolean(),
	hasUnlimitedStock: z.boolean(),
});
export type DessertInput = z.input<typeof dessertInputSchema>;

export const dessertIdSchema = recordId;

export const listingSchema = z.object({ id: recordId, enabled: z.boolean() });

const moveDirections = ["top", "up", "down", "bottom"] as const;
export type MoveDirection = (typeof moveDirections)[number];

export const moveDessertSchema = z.object({ id: recordId, direction: z.enum(moveDirections) });

export const COMBO_ADD_ON_MAX_QUANTITY = 99;

/** A combo as staff save it: one base dessert and one or more add-ons. */
export const comboInputSchema = z.object({
	id: recordId.optional(),
	name: z.string().trim().min(1, "Name is required").max(255, "Name is too long"),
	baseDessertId: z.number({ error: "Pick a base dessert" }).int().positive("Pick a base dessert"),
	overridePrice: z
		.number()
		.int("Price must be a whole number of rupees")
		.min(0, "Price can't be negative")
		.max(MAX_PRICE, "Price is too high")
		.nullable(),
	enabled: z.boolean(),
	addOns: z
		.array(
			z.object({
				dessertId: recordId,
				quantity: z
					.number()
					.int()
					.min(1, "Each add-on needs a quantity of at least 1")
					.max(COMBO_ADD_ON_MAX_QUANTITY, `An add-on can be at most ${COMBO_ADD_ON_MAX_QUANTITY}`),
			}),
		)
		.min(1, "Pick at least one add-on")
		.max(20, "A combo can have at most 20 add-ons")
		.refine((addOns) => new Set(addOns.map(({ dessertId }) => dessertId)).size === addOns.length, {
			message: "Each add-on can be picked once",
		}),
});
export type ComboInput = z.input<typeof comboInputSchema>;

export const comboIdSchema = recordId;
