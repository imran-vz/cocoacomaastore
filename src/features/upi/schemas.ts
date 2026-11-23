import { z } from "zod";

export const upiAccountInputSchema = z.object({
	label: z.string().trim().min(1, "Enter a label").max(255),
	upiId: z
		.string()
		.trim()
		.toLowerCase()
		.max(255)
		.regex(/^[\w.-]+@[\w.-]+$/, "Invalid UPI ID format (e.g., user@bank)"),
	enabled: z.boolean(),
});

export type UpiAccountInput = z.input<typeof upiAccountInputSchema>;

export const upiAccountIdSchema = z.uuid();
