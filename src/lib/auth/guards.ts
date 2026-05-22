import { NextResponse } from "next/server";
import { getServerSession, type ServerSession } from "@/lib/auth";

type AuthenticatedSession = {
	session: NonNullable<ServerSession>["session"];
	user: NonNullable<ServerSession>["user"];
};

const MANAGER_ACCESS_ROLES = ["admin", "user"] as const;

async function getAuthenticatedSession(): Promise<AuthenticatedSession | null> {
	const session = await getServerSession();

	if (!session?.session || !session?.user) {
		return null;
	}

	return {
		session: session.session,
		user: session.user,
	};
}

function hasRole(user: AuthenticatedSession["user"], allowedRoles: readonly string[]) {
	return allowedRoles.includes(user.role ?? "");
}

async function requireRole(allowedRoles?: readonly string[], forbiddenMessage = "Access required") {
	const session = await getAuthenticatedSession();

	if (!session) {
		throw new Error("Unauthorized");
	}

	if (allowedRoles && !hasRole(session.user, allowedRoles)) {
		throw new Error(forbiddenMessage);
	}

	return session.user;
}

async function routeGuard(allowedRoles?: readonly string[]) {
	const session = await getAuthenticatedSession();

	if (!session) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	if (allowedRoles && !hasRole(session.user, allowedRoles)) {
		return NextResponse.json({ error: "Forbidden" }, { status: 403 });
	}

	return null;
}

export async function requireSession() {
	return requireRole();
}

export async function requireAdmin() {
	return requireRole(["admin"], "Admin access required");
}

export async function requireManagerAccess() {
	return requireRole(MANAGER_ACCESS_ROLES, "Access required");
}

export async function authenticatedRouteGuard() {
	return routeGuard();
}

export async function adminRouteGuard() {
	return routeGuard(["admin"]);
}

export async function managerRouteGuard() {
	return routeGuard(MANAGER_ACCESS_ROLES);
}
