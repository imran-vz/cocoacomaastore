import { z } from "zod";

/** Staff password length, enforced by Better Auth and checked early by every form that sets one. */
export const PASSWORD_LENGTH = { min: 8, max: 128 } as const;

export const PASSWORD_HINT = `At least ${PASSWORD_LENGTH.min} characters.`;

export const passwordSchema = z
	.string()
	.min(PASSWORD_LENGTH.min, `Password must be at least ${PASSWORD_LENGTH.min} characters`)
	.max(PASSWORD_LENGTH.max, `Password must be at most ${PASSWORD_LENGTH.max} characters`);
