import { z } from "zod";

export const dessertFormSchema = z.object({
	name: z.string().min(1, "Name is required"),
	description: z.string(),
	price: z.number().min(0, "Price must be a valid number"),
	kind: z.enum(["base", "modifier"]),
	isOutOfStock: z.boolean(),
	hasUnlimitedStock: z.boolean(),
});
