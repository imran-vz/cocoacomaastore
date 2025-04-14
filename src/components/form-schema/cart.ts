import { z } from "zod";

export const cartFormSchema = z.object({
	name: z.string().min(1),
	deliveryCost: z
		.string()
		.refine((val) => !Number.isNaN(Number.parseFloat(val)), {
			message: "Delivery cost must be a number",
		}),
});
