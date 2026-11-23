/** The two staff workspaces. Admins work under /admin; everyone else under /manager. */
export const AREAS = ["admin", "manager"] as const;

export type Area = (typeof AREAS)[number];

/**
 * Better Auth stores staff roles as "admin" or "user" (its default role for new accounts),
 * so anyone who isn't an admin works in the manager area.
 */
export function areaOf(role: string | null | undefined): Area {
	return role === "admin" ? "admin" : "manager";
}

/** The Better Auth role that puts an account in `area`. */
export function roleOf(area: Area): "admin" | "user" {
	return area === "admin" ? "admin" : "user";
}

export function homeOf(area: Area): `/${Area}` {
	return `/${area}`;
}

export type StaffUser = {
	id: string;
	name: string;
	email: string;
	area: Area;
};

export const AREA_LABEL: Record<Area, "Admin" | "Manager"> = { admin: "Admin", manager: "Manager" };

export const LOGIN_PATH = "/login";
