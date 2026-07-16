import { z } from "zod";

export const SHARED_DATABASE_ACKNOWLEDGEMENT = "CREATE_FIRST_ADMIN";

export type BootstrapAdminConfig = {
	name: string;
	email: string;
	password: string;
	databaseUrl: string;
};

export type BootstrapAdminDependencies = {
	findUserByEmail(email: string): Promise<{ id: string; role: string | null } | null>;
	findFirstAdmin(): Promise<{ id: string } | null>;
	createCredentialUser(input: { name: string; email: string; password: string; role: "user" }): Promise<{ id: string }>;
	promoteCreatedUser(input: { id: string; email: string }): Promise<boolean>;
	deleteCreatedUser(id: string): Promise<boolean>;
};

const LOCAL_DATABASE_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
const nameSchema = z.string().trim().min(1).max(255);
const emailSchema = z
	.email()
	.max(255)
	.transform((email) => email.trim().toLowerCase());
const passwordSchema = z.string().min(8).max(128);

const BOOTSTRAP_FAILED = "Administrator bootstrap failed.";
const MANUAL_REVIEW_REQUIRED = "Administrator bootstrap failed; manual auth-table review is required.";

function requiredEnvironmentValue(env: NodeJS.ProcessEnv, name: string) {
	const value = env[name];
	if (value === undefined || value === "") throw new Error(`${name} is required`);
	return value;
}

function parseEnvironmentField(schema: z.ZodType<string>, value: string, name: string) {
	const parsed = schema.safeParse(value);
	if (!parsed.success) throw new Error(`${name} is invalid`);
	return parsed.data;
}

export function parseBootstrapAdminEnvironment(env: NodeJS.ProcessEnv): BootstrapAdminConfig {
	const name = parseEnvironmentField(
		nameSchema,
		requiredEnvironmentValue(env, "BOOTSTRAP_ADMIN_NAME"),
		"BOOTSTRAP_ADMIN_NAME",
	);
	const email = parseEnvironmentField(
		emailSchema,
		requiredEnvironmentValue(env, "BOOTSTRAP_ADMIN_EMAIL").trim(),
		"BOOTSTRAP_ADMIN_EMAIL",
	);
	const password = parseEnvironmentField(
		passwordSchema,
		requiredEnvironmentValue(env, "BOOTSTRAP_ADMIN_PASSWORD"),
		"BOOTSTRAP_ADMIN_PASSWORD",
	);
	const databaseUrl = requiredEnvironmentValue(env, "DATABASE_URL");

	let parsedDatabaseUrl: URL;
	try {
		parsedDatabaseUrl = new URL(databaseUrl);
	} catch {
		throw new Error("DATABASE_URL must be a valid PostgreSQL URL");
	}
	if (parsedDatabaseUrl.protocol !== "postgres:" && parsedDatabaseUrl.protocol !== "postgresql:") {
		throw new Error("DATABASE_URL must use the postgres or postgresql protocol");
	}

	if (
		!LOCAL_DATABASE_HOSTS.has(parsedDatabaseUrl.hostname) &&
		env.COCOACOMAA_BOOTSTRAP_ADMIN_ACKNOWLEDGE_SHARED_DATABASE !== SHARED_DATABASE_ACKNOWLEDGEMENT
	) {
		throw new Error("Shared database bootstrap requires the exact acknowledgement");
	}

	return { name, email, password, databaseUrl };
}

export async function bootstrapFirstAdmin(
	config: BootstrapAdminConfig,
	dependencies: BootstrapAdminDependencies,
): Promise<"created" | "already-admin"> {
	const normalizedEmail = config.email.trim().toLowerCase();
	const existingUser = await dependencies.findUserByEmail(normalizedEmail);

	if (existingUser?.role === "admin") return "already-admin";
	if (existingUser) throw new Error("A non-administrator account already uses the requested email.");
	if (await dependencies.findFirstAdmin()) throw new Error("The first administrator already exists.");

	let createdUser: { id: string };
	try {
		createdUser = await dependencies.createCredentialUser({
			name: config.name,
			email: normalizedEmail,
			password: config.password,
			role: "user",
		});
	} catch {
		throw new Error(MANUAL_REVIEW_REQUIRED);
	}

	let promoted = false;
	try {
		promoted = await dependencies.promoteCreatedUser({ id: createdUser.id, email: normalizedEmail });
	} catch {
		promoted = false;
	}
	if (promoted) return "created";

	let cleanedUp = false;
	try {
		cleanedUp = await dependencies.deleteCreatedUser(createdUser.id);
	} catch {
		throw new Error(MANUAL_REVIEW_REQUIRED);
	}
	if (!cleanedUp) throw new Error(MANUAL_REVIEW_REQUIRED);
	throw new Error(BOOTSTRAP_FAILED);
}
