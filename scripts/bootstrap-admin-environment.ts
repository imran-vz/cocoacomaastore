import { readFile } from "node:fs/promises";
import path from "node:path";
import { parseEnv } from "node:util";
import { type BootstrapAdminConfig, parseBootstrapAdminEnvironment } from "@/lib/bootstrap-admin";

const PERSISTENT_BOOTSTRAP_ENVIRONMENT_NAMES = [
	"DATABASE_URL",
	"BETTER_AUTH_SECRET",
	"BETTER_AUTH_BASE_URL",
	"NEXT_PUBLIC_APP_URL",
] as const;

const ONE_TIME_BOOTSTRAP_ENVIRONMENT_NAMES = [
	"BOOTSTRAP_ADMIN_NAME",
	"BOOTSTRAP_ADMIN_EMAIL",
	"BOOTSTRAP_ADMIN_PASSWORD",
	"COCOACOMAA_BOOTSTRAP_ADMIN_ACKNOWLEDGE_SHARED_DATABASE",
] as const;

type PersistentEnvironmentName = (typeof PERSISTENT_BOOTSTRAP_ENVIRONMENT_NAMES)[number];

export type PreparedBootstrapAdminEnvironment = {
	config: BootstrapAdminConfig;
	persistentEnvironment: Partial<Record<PersistentEnvironmentName, string>>;
};

export async function readBootstrapEnvironmentFile() {
	try {
		return await readFile(path.resolve(process.cwd(), ".env"), "utf8");
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
		throw error;
	}
}

export function prepareBootstrapAdminEnvironment(
	invokingEnvironment: NodeJS.ProcessEnv,
	environmentFileContents?: string,
): PreparedBootstrapAdminEnvironment {
	const fileEnvironment = environmentFileContents === undefined ? {} : parseEnv(environmentFileContents);
	const mergedEnvironment: NodeJS.ProcessEnv = { ...invokingEnvironment };
	const persistentEnvironment: Partial<Record<PersistentEnvironmentName, string>> = {};

	for (const name of PERSISTENT_BOOTSTRAP_ENVIRONMENT_NAMES) {
		const value = invokingEnvironment[name] ?? fileEnvironment[name];
		if (value !== undefined) {
			mergedEnvironment[name] = value;
			persistentEnvironment[name] = value;
		}
	}

	return {
		config: parseBootstrapAdminEnvironment(mergedEnvironment),
		persistentEnvironment,
	};
}

export function applyBootstrapRuntimeEnvironment(
	environment: NodeJS.ProcessEnv,
	persistentEnvironment: PreparedBootstrapAdminEnvironment["persistentEnvironment"],
) {
	for (const [name, value] of Object.entries(persistentEnvironment)) {
		if (value !== undefined) environment[name] = value;
	}
	for (const name of ONE_TIME_BOOTSTRAP_ENVIRONMENT_NAMES) delete environment[name];
	environment.DB_QUERY_TIMING = "0";
}
