import type { AdminOptions } from "better-auth/plugins";
import { defaultAc, userAc } from "better-auth/plugins/admin/access";

export const applicationAdminRole = defaultAc.newRole({
	user: ["create", "list", "ban", "impersonate", "set-password", "get", "update"],
	session: ["list", "revoke", "delete"],
});

export const applicationAdminRoles = {
	admin: applicationAdminRole,
	user: userAc,
};

export const adminPluginOptions = {
	defaultRole: "user",
	adminRoles: ["admin"],
	ac: defaultAc,
	roles: applicationAdminRoles,
} as unknown as AdminOptions;
