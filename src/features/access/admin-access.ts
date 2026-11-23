import type { AdminOptions } from "better-auth/plugins";
import { defaultAc, userAc } from "better-auth/plugins/admin/access";

const applicationAdminRole = defaultAc.newRole({
	user: ["create", "list", "ban", "impersonate", "set-password", "get", "update"],
	session: ["list", "revoke", "delete"],
});

const applicationAdminRoles = {
	admin: applicationAdminRole,
	user: userAc,
};

// Better Auth's `AdminOptions["ac"]` type rejects its own `defaultAc` (the `newRole` signatures
// don't line up), so the options are cast; the admin-access tests pin the resulting policy.
export const adminPluginOptions = {
	defaultRole: "user",
	adminRoles: ["admin"],
	ac: defaultAc,
	roles: applicationAdminRoles,
} as unknown as AdminOptions;
