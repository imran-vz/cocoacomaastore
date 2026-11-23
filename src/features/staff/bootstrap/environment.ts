import { readFile } from "node:fs/promises";
import path from "node:path";
import { parseEnv } from "node:util";
import {
	type BootstrapAdminConfig,
	ONE_TIME_BOOTSTRAP_ENVIRONMENT_NAMES,
	parseBootstrapAdminEnvironment,
} from "@/features/staff/bootstrap/bootstrap";

const ONE_TIME_NAMES = new Set<string>(ONE_TIME_BOOTSTRAP_ENVIRONMENT_NAMES);

export async function readBootstrapEnvironmentFile() {
	try {
		return await readFile(path.resolve(process.cwd(), ".env"), "utf8");
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
		throw error;
	}
}

/**
 * The bootstrap inputs, and the `.env` settings the app needs at import time. Every `.env` value
 * is used except the one-time inputs, which must come from the invoking shell; the invoking
 * shell's values take precedence.
 */
export function prepareBootstrapAdminEnvironment(
	invokingEnvironment: NodeJS.ProcessEnv,
	environmentFileContents?: string,
): { config: BootstrapAdminConfig; fileEnvironment: Record<string, string> } {
	const fileEnvironment: Record<string, string> = {};
	if (environmentFileContents !== undefined) {
		for (const [name, value] of Object.entries(parseEnv(environmentFileContents))) {
			if (value !== undefined && !ONE_TIME_NAMES.has(name) && invokingEnvironment[name] === undefined) {
				fileEnvironment[name] = value;
			}
		}
	}

	return {
		config: parseBootstrapAdminEnvironment({ ...fileEnvironment, ...invokingEnvironment }),
		fileEnvironment,
	};
}

/** Adds the `.env` settings and removes the one-time inputs before the app's modules load. */
export function applyBootstrapRuntimeEnvironment(
	environment: NodeJS.ProcessEnv,
	fileEnvironment: Record<string, string>,
) {
	Object.assign(environment, fileEnvironment);
	for (const name of ONE_TIME_NAMES) delete environment[name];
}
