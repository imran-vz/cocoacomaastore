import bcrypt from "bcryptjs";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin } from "better-auth/plugins";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { adminPluginOptions } from "@/features/access/admin-access";
import { PASSWORD_LENGTH } from "@/features/access/password";
import { APP_URL } from "@/lib/app-url";

export const auth = betterAuth({
	database: drizzleAdapter(db, {
		provider: "pg",
		schema: {
			user: schema.userTable,
			session: schema.sessionTable,
			account: schema.accountTable,
			verification: schema.verificationTable,
		},
	}),
	emailAndPassword: {
		enabled: true,
		disableSignUp: true,
		requireEmailVerification: false,
		minPasswordLength: PASSWORD_LENGTH.min,
		maxPasswordLength: PASSWORD_LENGTH.max,
		password: {
			hash: async (password) => await bcrypt.hash(password, 12),
			verify: async ({ password, hash }) => bcrypt.compare(password, hash),
		},
	},
	plugins: [admin(adminPluginOptions)],
	trustedOrigins: [APP_URL],
	baseURL: process.env.BETTER_AUTH_BASE_URL,
});
