import { z } from "zod";

export const cartFormSchema = z.object({
	name: z.string(),
	deliveryCost: z.string(),
});
