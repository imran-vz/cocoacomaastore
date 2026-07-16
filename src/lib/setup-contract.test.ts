import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const BOOTSTRAP_NAMES = [
	"BOOTSTRAP_ADMIN_NAME",
	"BOOTSTRAP_ADMIN_EMAIL",
	"BOOTSTRAP_ADMIN_PASSWORD",
	"COCOACOMAA_BOOTSTRAP_ADMIN_ACKNOWLEDGE_SHARED_DATABASE",
] as const;
const EXPECTED_ENV_NAMES = new Set([
	"DATABASE_URL",
	"BETTER_AUTH_SECRET",
	"BETTER_AUTH_BASE_URL",
	"NEXT_PUBLIC_APP_URL",
	"REVALIDATE_SECRET",
	"DB_QUERY_TIMING",
	"DB_SLOW_QUERY_MS",
	"TRIGGER_PROJECT_REF",
	"TRIGGER_SECRET_KEY",
	"SUPABASE_DATABASE_URL",
	"REMOTE_DATABASE_URL",
	"LOCAL_DATABASE_URL",
	...BOOTSTRAP_NAMES,
]);

async function readRepositoryFile(relativePath: string) {
	return readFile(path.join(ROOT, relativePath), "utf8");
}

describe("repository setup contract", () => {
	it("tracks only the sanitized environment contract", async () => {
		const templatePath = path.join(ROOT, ".env.example");
		let templateExists = true;
		try {
			await access(templatePath);
		} catch {
			templateExists = false;
		}
		expect(templateExists, ".env.example must exist before its contract can be read").toBe(true);
		if (!templateExists) return;

		const lines = (await readFile(templatePath, "utf8")).split(/\r?\n/);
		const assignments = new Map<string, string>();
		const commentedBootstrapNames = new Set<string>();
		for (const line of lines) {
			const assignment = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(line);
			if (assignment) assignments.set(assignment[1], assignment[2]);
			const bootstrapComment =
				/^# (BOOTSTRAP_ADMIN_NAME|BOOTSTRAP_ADMIN_EMAIL|BOOTSTRAP_ADMIN_PASSWORD|COCOACOMAA_BOOTSTRAP_ADMIN_ACKNOWLEDGE_SHARED_DATABASE)=$/.exec(
					line,
				);
			if (bootstrapComment) commentedBootstrapNames.add(bootstrapComment[1]);
		}

		expect(new Set([...assignments.keys(), ...commentedBootstrapNames])).toEqual(EXPECTED_ENV_NAMES);
		expect(assignments.has("NODE_ENV")).toBe(false);
		for (const value of assignments.values()) {
			expect(value === "" || /^<[^>]+>$/.test(value) || ["http://localhost:3000", "0", "100"].includes(value)).toBe(
				true,
			);
		}
		expect(commentedBootstrapNames).toEqual(new Set(BOOTSTRAP_NAMES));
		for (const name of BOOTSTRAP_NAMES) expect(assignments.has(name)).toBe(false);
	});

	it("documents existing setup scripts and architecture records", async () => {
		const [packageSource, readme] = await Promise.all([
			readRepositoryFile("package.json"),
			readRepositoryFile("README.md"),
		]);
		const packageJson = JSON.parse(packageSource) as { scripts: Record<string, string> };
		const documentedCommands = [...readme.matchAll(/\bpnpm ([a-z][\w:-]*)/g)].map((match) => match[1]);
		for (const command of documentedCommands.filter((command) => command !== "install")) {
			expect(packageJson.scripts, `README command pnpm ${command} must name a package script`).toHaveProperty(command);
		}

		for (const link of [
			"CONTEXT.md",
			"docs/adr/0001-record-architecture-decisions.md",
			"docs/adr/0006-keep-auth-boundaries-explicit.md",
			"docs/adr/0007-use-trigger-dev-for-analytics-orchestration.md",
		]) {
			expect(readme).toContain(`](${link})`);
		}
		const localLinks = [...readme.matchAll(/\[[^\]]+\]\((?!https?:|#)([^)]+)\)/g)].map((match) => match[1]);
		for (const link of localLinks) await expect(access(path.join(ROOT, link))).resolves.toBeUndefined();
	});

	it("documents the current package quality commands", async () => {
		const context = await readRepositoryFile("CONTEXT.md");
		expect(context).toContain("pnpm format");
		expect(context).toContain("pnpm lint");
		expect(context).toContain("pnpm typecheck");
		expect(context).not.toContain("vp ");
	});
});
