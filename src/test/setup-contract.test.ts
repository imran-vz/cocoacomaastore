import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
	ONE_TIME_BOOTSTRAP_ENVIRONMENT_NAMES,
	SHARED_DATABASE_ACKNOWLEDGEMENT,
} from "@/features/staff/bootstrap/bootstrap";
import { ORDER_COLUMNS_ACKNOWLEDGEMENT } from "../../scripts/order-columns-cutover";

const ROOT = process.cwd();
/** Set by Node, Next.js and the shell themselves. */
const PROVIDED_BY_RUNTIME = new Set(["NODE_ENV", "BASH_SOURCE", "TMPDIR"]);
/** Read from the environment by a library rather than by the app's code. */
const READ_BY_LIBRARIES = new Set(["BETTER_AUTH_SECRET"]);
/** Read only by the integration test runner, which documents it in its own error message. */
const TEST_ONLY = new Set(["TEST_DATABASE_URL"]);
/** String values in code that look like variable names but are typed by operators instead. */
const NOT_VARIABLES = new Set([SHARED_DATABASE_ACKNOWLEDGEMENT, ORDER_COLUMNS_ACKNOWLEDGEMENT]);

const NAME = "[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+";

function read(relativePath: string) {
	return readFileSync(path.join(ROOT, relativePath), "utf8");
}

function files(dir: string, pattern: RegExp): string[] {
	return readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((entry) => {
		const relativePath = path.join(dir, entry.name);
		if (entry.isDirectory()) return files(relativePath, pattern);
		return pattern.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [relativePath] : [];
	});
}

/**
 * Variables TypeScript reads: `process.env.NAME` and `env.NAME`, plus every name-shaped string,
 * which is how code that reads `env[name]` spells its names.
 */
function namesReadByTypeScript(source: string): string[] {
	return [
		...[...source.matchAll(new RegExp(`\\benv(?:ironment)?\\.(${NAME})\\b`, "g"))].map((match) => match[1]),
		...[...source.matchAll(new RegExp(`["'](${NAME})["']`, "g"))]
			.map((match) => match[1])
			.filter((name) => !NOT_VARIABLES.has(name)),
	];
}

/** Variables a shell script reads without setting them itself. */
function namesReadByShell(source: string): string[] {
	const set = new Set([
		...[...source.matchAll(/^\s*(?:local\s+)?([A-Z][A-Z0-9_]*)=/gm)].map((match) => match[1]),
		...[...source.matchAll(/\bread\b[^\n<]*\s([A-Z][A-Z0-9_]*)\s*(?:<|$)/gm)].map((match) => match[1]),
	]);
	return [...source.matchAll(/\$\{?([A-Z][A-Z0-9_]*)/g)].map((match) => match[1]).filter((name) => !set.has(name));
}

function namesReadByCode(): Set<string> {
	const typeScript = [
		...files("src", /\.tsx?$/),
		...files("scripts", /\.ts$/),
		...readdirSync(ROOT).filter((file) => /\.config\.ts$/.test(file)),
	];
	return new Set([
		...typeScript.flatMap((file) => namesReadByTypeScript(read(file))),
		...files("scripts", /\.sh$/).flatMap((file) => namesReadByShell(read(file))),
	]);
}

function parseTemplate() {
	const assignments = new Map<string, string>();
	const commented = new Set<string>();
	for (const line of read(".env.example").split(/\r?\n/)) {
		const assignment = /^([A-Z_][A-Z0-9_]*)=(.*)$/.exec(line);
		if (assignment) assignments.set(assignment[1], assignment[2]);
		const comment = /^# ([A-Z_][A-Z0-9_]*)=$/.exec(line);
		if (comment) commented.add(comment[1]);
	}
	return { assignments, commented };
}

describe("repository setup contract", () => {
	const used = namesReadByCode();
	const { assignments, commented } = parseTemplate();
	const documented = new Set([...assignments.keys(), ...commented]);

	it("documents in .env.example every variable the code reads", () => {
		const undocumented = [...used].filter(
			(name) => !documented.has(name) && !PROVIDED_BY_RUNTIME.has(name) && !TEST_ONLY.has(name),
		);
		expect(undocumented).toEqual([]);
	});

	it("documents only variables the code reads", () => {
		const readmeNames = [...read("README.md").matchAll(new RegExp(`\`(${NAME})\``, "g"))].map((match) => match[1]);
		const unread = [...documented, ...readmeNames].filter(
			(name) => !used.has(name) && !PROVIDED_BY_RUNTIME.has(name) && !READ_BY_LIBRARIES.has(name),
		);
		expect(unread).toEqual([]);
	});

	it("keeps .env.example free of real values and of one-time bootstrap inputs", () => {
		for (const [name, value] of assignments) {
			expect(
				value === "" || /^<[^>]+>$/.test(value) || ["http://localhost:3000", "0", "100"].includes(value),
				name,
			).toBe(true);
		}
		for (const name of ONE_TIME_BOOTSTRAP_ENVIRONMENT_NAMES) {
			expect(assignments.has(name), name).toBe(false);
			expect(commented.has(name), name).toBe(true);
		}
	});

	it("names only existing package scripts and files in the README", () => {
		const scripts = (JSON.parse(read("package.json")) as { scripts: Record<string, string> }).scripts;
		const readme = read("README.md");
		for (const [, command] of readme.matchAll(/\bpnpm ([a-z][\w:-]*)/g)) {
			if (command !== "install") expect(scripts, `pnpm ${command}`).toHaveProperty(command);
		}
		for (const [, link] of readme.matchAll(/\[[^\]]+\]\((?!https?:|#)([^)]+)\)/g)) {
			expect(() => read(link), link).not.toThrow();
		}
	});
});
