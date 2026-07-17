import path from "node:path";
import { pathToFileURL } from "node:url";
import { type BootstrapAdminDependencies, bootstrapFirstAdmin } from "@/lib/bootstrap-admin";
import {
	applyBootstrapRuntimeEnvironment,
	prepareBootstrapAdminEnvironment,
	readBootstrapEnvironmentFile,
} from "./bootstrap-admin-environment";

async function loadBootstrapAdminDependencies() {
	const [{ auth }, { db }, { createBootstrapAdminDependencies }] = await Promise.all([
		import("@/lib/auth"),
		import("@/db"),
		import("@/lib/bootstrap-admin-database"),
	]);
	return createBootstrapAdminDependencies(db, auth);
}

export async function runBootstrapAdminCommand({
	environment = process.env,
	readEnvironmentFile = readBootstrapEnvironmentFile,
	loadDependencies = loadBootstrapAdminDependencies,
}: {
	environment?: NodeJS.ProcessEnv;
	readEnvironmentFile?: () => Promise<string | undefined>;
	loadDependencies?: () => Promise<BootstrapAdminDependencies>;
} = {}): Promise<number> {
	try {
		const prepared = prepareBootstrapAdminEnvironment(environment, await readEnvironmentFile());
		applyBootstrapRuntimeEnvironment(environment, prepared.persistentEnvironment);
		const dependencies = await loadDependencies();
		const status = await bootstrapFirstAdmin(prepared.config, dependencies);

		console.log(status === "created" ? "First administrator created." : "First administrator already exists.");
		return 0;
	} catch {
		console.error("First administrator bootstrap failed.");
		return 1;
	}
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : undefined;
if (invokedPath === import.meta.url) {
	runBootstrapAdminCommand().then((exitCode) => process.exit(exitCode));
}
