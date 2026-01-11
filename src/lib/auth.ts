import bcrypt from "bcryptjs";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { headers } from "next/headers";
import { db } from "@/db";
import * as schema from "@/db/schema";
import {
	DatabaseUnavailableError,
	isDatabaseUnavailableError,
} from "@/lib/errors";

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
		requireEmailVerification: false,
		password: {
			async hash(password) {
				return await bcrypt.hash(password, 12);
			},
			async verify({ password, hash }) {
				return await bcrypt.compare(password, hash);
			},
		},
	},
	user: {
		additionalFields: {
			role: {
				type: "string",
				required: true,
				defaultValue: "manager",
			},
		},
	},
	trustedOrigins: [process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"],
});

export type ServerSession = Awaited<ReturnType<typeof auth.api.getSession>>;

export async function getServerSession(): Promise<ServerSession> {
	try {
		return await auth.api.getSession({ headers: await headers() });
	} catch (error) {
		if (error instanceof DatabaseUnavailableError) throw error;
		if (isDatabaseUnavailableError(error)) {
			throw new DatabaseUnavailableError("Database unavailable", {
				cause: error,
			});
		}
		throw error;
	}
}
