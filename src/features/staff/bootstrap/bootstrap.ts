import type { Area } from "@/features/access/area";
import { newStaffAccountSchema } from "@/features/staff/schemas";
import { isLoopbackHost, parsePostgresUrl } from "@/lib/postgres-url";

export const SHARED_DATABASE_ACKNOWLEDGEMENT = "CREATE_FIRST_ADMIN";

const ONE_TIME_VARIABLE = {
	name: "BOOTSTRAP_ADMIN_NAME",
	email: "BOOTSTRAP_ADMIN_EMAIL",
	password: "BOOTSTRAP_ADMIN_PASSWORD",
	acknowledgement: "COCOACOMAA_BOOTSTRAP_ADMIN_ACKNOWLEDGE_SHARED_DATABASE",
} as const;

/** Inputs for one invocation: taken from the invoking shell only, and removed before the app loads. */
export const ONE_TIME_BOOTSTRAP_ENVIRONMENT_NAMES = Object.values(ONE_TIME_VARIABLE);

/** A bootstrap failure whose message is safe to print: it never repeats a password, a URL or a database error. */
export class BootstrapError extends Error {
	override name = "BootstrapError";
}

export type BootstrapAdminConfig = {
	name: string;
	email: string;
	password: string;
};

type LockedBootstrapAdminDependencies = {
	findUserByEmail(email: string): Promise<{ area: Area } | null>;
	findFirstAdmin(): Promise<{ id: string } | null>;
	createAdmin(config: BootstrapAdminConfig): Promise<void>;
};

export type BootstrapAdminDependencies = {
	withFirstAdminLock<T>(run: (dependencies: LockedBootstrapAdminDependencies) => Promise<T>): Promise<T>;
};

const MANUAL_REVIEW_REQUIRED = "Administrator bootstrap failed; manual auth-table review is required.";

function requiredValue(env: NodeJS.ProcessEnv, name: string) {
	const value = env[name];
	if (value === undefined || value === "") throw new BootstrapError(`${name} is required`);
	return value;
}

function parseField(field: "name" | "email" | "password", env: NodeJS.ProcessEnv): string {
	const variable = ONE_TIME_VARIABLE[field];
	const parsed = newStaffAccountSchema.shape[field].safeParse(requiredValue(env, variable));
	if (!parsed.success) throw new BootstrapError(`${variable} is invalid: ${parsed.error.issues[0]?.message}`);
	return parsed.data;
}

export function parseBootstrapAdminEnvironment(env: NodeJS.ProcessEnv): BootstrapAdminConfig {
	const config = {
		name: parseField("name", env),
		email: parseField("email", env),
		password: parseField("password", env),
	};

	let databaseUrl: URL;
	try {
		databaseUrl = parsePostgresUrl(env.DATABASE_URL, "DATABASE_URL");
	} catch (error) {
		throw new BootstrapError((error as Error).message);
	}
	if (!isLoopbackHost(databaseUrl) && env[ONE_TIME_VARIABLE.acknowledgement] !== SHARED_DATABASE_ACKNOWLEDGEMENT) {
		throw new BootstrapError("Shared database bootstrap requires the exact acknowledgement");
	}

	return config;
}

/**
 * Creates the first administrator unless one exists. The checks and the creation run under one
 * lock, so concurrent attempts create at most one administrator.
 */
export function bootstrapFirstAdmin(
	config: BootstrapAdminConfig,
	dependencies: BootstrapAdminDependencies,
): Promise<"created" | "already-admin"> {
	return dependencies.withFirstAdminLock(async (locked) => {
		const existingUser = await locked.findUserByEmail(config.email);
		if (existingUser?.area === "admin") return "already-admin";
		if (existingUser) throw new BootstrapError("A non-administrator account already uses the requested email.");
		if (await locked.findFirstAdmin()) throw new BootstrapError("The first administrator already exists.");

		try {
			await locked.createAdmin(config);
		} catch {
			// Better Auth writes the user and its credential separately, so a failure may leave either behind.
			throw new BootstrapError(MANUAL_REVIEW_REQUIRED);
		}
		return "created";
	});
}
