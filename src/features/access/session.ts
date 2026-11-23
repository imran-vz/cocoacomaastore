import { headers } from "next/headers";
import { RedirectType, redirect } from "next/navigation";
import { cache } from "react";
import { type Area, areaOf, homeOf, LOGIN_PATH, type StaffUser } from "@/features/access/area";
import { auth } from "@/features/access/auth";
import { UserFacingError } from "@/lib/errors";

export class AccessError extends UserFacingError {
	override name = "AccessError";

	constructor(readonly status: 401 | 403) {
		super(status === 401 ? "Your session has ended. Sign in again." : "You don't have access to this.");
	}
}

/** The signed-in staff member, read once per request. */
export const getStaffUser = cache(async (): Promise<StaffUser | null> => {
	const session = await auth.api.getSession({ headers: await headers() });
	if (!session?.session || !session.user) return null;

	const { id, name, email, role } = session.user;
	return { id, name, email, area: areaOf(role) };
});

export async function requireStaff(): Promise<StaffUser> {
	const user = await getStaffUser();
	if (!user) throw new AccessError(401);
	return user;
}

export async function requireAdmin(): Promise<StaffUser> {
	const user = await requireStaff();
	if (user.area !== "admin") throw new AccessError(403);
	return user;
}

/** For pages and layouts: sends visitors to sign in, and staff to their own area. */
export async function requireArea(area: Area): Promise<StaffUser> {
	const user = await getStaffUser();
	if (!user) redirect(LOGIN_PATH, RedirectType.replace);
	if (user.area !== area) redirect(homeOf(user.area), RedirectType.replace);
	return user;
}
