import { isAPIError } from "better-auth/api";
import { type Area, roleOf } from "@/features/access/area";
import { auth } from "@/features/access/auth";
import { UserFacingError } from "@/lib/errors";

/** Creates a staff sign-in in `area`, from the Managers page or the first-administrator bootstrap. */
export async function createStaffUser({
	area,
	...account
}: {
	name: string;
	email: string;
	password: string;
	area: Area;
}): Promise<void> {
	try {
		await auth.api.createUser({ body: { ...account, role: roleOf(area) } });
	} catch (error) {
		// Better Auth refuses a taken email or a rejected password with a 4xx message written for people.
		if (isAPIError(error) && error.statusCode < 500) throw new UserFacingError(error.message, { cause: error });
		throw error;
	}
}
