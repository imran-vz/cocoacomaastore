import { z } from "zod";
import { AREAS } from "@/features/access/area";
import { passwordSchema } from "@/features/access/password";

/** A new staff account, from the Managers page or the first-administrator bootstrap. */
export const newStaffAccountSchema = z.object({
	name: z.string().trim().min(1, "Enter a name").max(255),
	email: z.string().trim().toLowerCase().pipe(z.email("Enter a valid email").max(255)),
	password: passwordSchema,
	area: z.enum(AREAS),
});

export type NewStaffAccount = z.input<typeof newStaffAccountSchema>;

export const staffAccountIdSchema = z.string().min(1);
