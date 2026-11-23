import { z } from "zod";

export const MAX_STOCK_QUANTITY = 10_000;

/** A stock count staff enter for one dessert. */
export const stockQuantitySchema = z
	.number({ error: "Enter a number" })
	.int("Stock must be a whole number")
	.min(0, "Stock can't be negative")
	.max(MAX_STOCK_QUANTITY, `Stock can be at most ${MAX_STOCK_QUANTITY}`);

/** New counts for today, each with the stored count the editor started from (any Postgres integer). */
export const stockUpdatesSchema = z
	.array(
		z.object({
			dessertId: z.number().int().positive(),
			expectedQuantity: z.number().int().min(-2147483648).max(2147483647),
			quantity: stockQuantitySchema,
		}),
	)
	.min(1)
	.max(1000)
	.refine((updates) => new Set(updates.map(({ dessertId }) => dessertId)).size === updates.length, {
		message: "Duplicate dessert IDs are not allowed",
	});

export type StockUpdate = z.infer<typeof stockUpdatesSchema>[number];
