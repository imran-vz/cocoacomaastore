import {
	type BootstrapAdminDependencies,
	BootstrapError,
	bootstrapFirstAdmin,
} from "@/features/staff/bootstrap/bootstrap";
import {
	applyBootstrapRuntimeEnvironment,
	prepareBootstrapAdminEnvironment,
	readBootstrapEnvironmentFile,
} from "@/features/staff/bootstrap/environment";

/**
 * The app's database and auth modules read their configuration when imported, so they load only
 * after the environment is prepared.
 */
async function loadBootstrapAdminDependencies() {
	const [{ db }, { createBootstrapAdminDependencies }] = await Promise.all([
		import("@/db"),
		import("@/features/staff/bootstrap/database"),
	]);
	return createBootstrapAdminDependencies(db);
}

/** Creates the first administrator from one-time shell variables; resolves to the exit code. */
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
		applyBootstrapRuntimeEnvironment(environment, prepared.fileEnvironment);
		const dependencies = await loadDependencies();
		const status = await bootstrapFirstAdmin(prepared.config, dependencies);

		console.log(status === "created" ? "First administrator created." : "First administrator already exists.");
		return 0;
	} catch (error) {
		// Only bootstrap's own messages are printed; others may carry credentials or database details.
		console.error(
			error instanceof BootstrapError
				? `First administrator bootstrap failed: ${error.message}`
				: "First administrator bootstrap failed.",
		);
		return 1;
	}
}
