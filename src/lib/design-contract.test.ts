/**
 * Static conformance test for the design contract in docs/design/DESIGN.md.
 *
 * It reads source files (no rendering) and fails when a screen bypasses the shared
 * formatting module, the colour tokens or the quiet-disabled rule. Files that other
 * packages are still migrating sit in `PENDING` with the rule they break; the list
 * must only shrink. Permanent, justified exceptions live in `ALLOWED`.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "..", "..");
const SCAN_DIRS = ["src/components", "src/app"];

type RuleId =
	| "font-mono"
	| "rs-currency"
	| "to-fixed"
	| "to-locale"
	| "raw-rupee"
	| "palette-color"
	| "hex-color"
	| "disabled-opacity"
	| "emoji"
	| "title-case-copy"
	| "native-confirm"
	| "viewport-records";

type Rule = {
	id: RuleId;
	description: string;
	pattern: RegExp;
	/** Limit the rule to these extensions (default: .ts and .tsx). */
	extensions?: string[];
	/** Only scan files whose (comment-stripped) source matches this. */
	onlyIf?: RegExp;
};

const RULES: Rule[] = [
	{
		id: "font-mono",
		description: "Numbers use the UI sans with tabular-nums; font-mono only for UPI IDs and copied receipt text.",
		pattern: /\bfont-mono\b/,
		extensions: [".tsx"],
	},
	{
		id: "rs-currency",
		description: 'Money is formatted with formatINR (₹, lakh grouping); never "Rs".',
		pattern: /\bRs\.?\s?[{\d$]/,
	},
	{
		id: "to-fixed",
		description: "Display numbers come from @/lib/format (formatINR, formatPercent, formatNumber), not toFixed().",
		pattern: /\.toFixed\(/,
	},
	{
		id: "to-locale",
		description: "Dates, times and numbers come from @/lib/format, not toLocale*String().",
		pattern: /\.toLocale(?:Date|Time)?String\(/,
	},
	{
		id: "raw-rupee",
		description: "The ₹ sign is only produced by formatINR / formatINRCompact.",
		pattern: /₹/,
	},
	{
		id: "palette-color",
		description:
			"Colour comes from tokens (primary, muted, success, warning, info, destructive, chart-*), not raw Tailwind hues.",
		pattern:
			/\b(?:text|bg|border|ring|fill|stroke|from|to|via|outline|divide|accent|caret|shadow|decoration)-(?:red|green|blue|teal|emerald|orange|amber|yellow|lime|sky|cyan|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}\b/,
	},
	{
		id: "hex-color",
		description: "Charts and surfaces use colour tokens (var(--chart-1), var(--primary)), not hex literals.",
		pattern:
			/(?:(?<![[\w-])(?:fill|stroke|color|stopColor|background(?:Color)?)\s*[=:]\s*\{?\s*["'`]#[0-9a-fA-F]{3,8}\b|\b(?:bg|text|border|fill|stroke|from|to|via)-\[#[0-9a-fA-F]{3,8}\])/,
	},
	{
		id: "disabled-opacity",
		description: "Disabled controls go quiet (muted surface and text), they don't fade to a new colour.",
		pattern: /\b(?:disabled|data-disabled|aria-disabled):opacity-(?!100\b)/,
		extensions: [".tsx"],
	},
	{
		id: "emoji",
		description: "No emoji in UI copy or headings.",
		pattern: /[\u{1F300}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u,
		extensions: [".tsx"],
	},
	{
		id: "title-case-copy",
		description: 'Sentence case for titles, labels and buttons ("Add dessert", "Avg order value"); "Nos" is "sold".',
		pattern:
			/["'>]\s*(?:Add Dessert|Add Combo|New Combo|Save Stock|Save Order|Disable All|Cancel Order|Export PDF|Copy Order|Avg Order Value|Items Sold|Total Orders|Manage Combos|Active Combos|Disabled Combos|Desserts & Stock|Desserts & Inventory|Refresh Data|Change Password|Log Out)\b|\bNos\)/,
		extensions: [".tsx"],
	},
	{
		id: "native-confirm",
		description:
			"Destructive confirmations use ConfirmSheet / useConfirmSheet (ui/confirm-sheet.tsx), never the browser's confirm/alert/prompt.",
		pattern: /(?<![\w.$])(?:window\.)?(?:confirm|alert|prompt)\(/,
	},
	{
		id: "viewport-records",
		description:
			"Records switch list↔table on content width (@3xl/main:hidden / hidden @3xl/main:block), not the viewport (md:hidden / md:block), so the admin sidebar never clips a table.",
		pattern: /(?:^|["'`\s])md:hidden\b|\bhidden\b[^"'`]*\bmd:(?:block|table|grid|flex|contents)\b/,
		extensions: [".tsx"],
		onlyIf: /<Table\b|<RecordList\b/,
	},
];

/**
 * Permanent, justified exceptions: path → rules that may match there.
 * Keep this short; every entry needs a reason.
 */
const ALLOWED: Record<string, RuleId[]> = {
	// Error screens show a monospace error digest for support.
	"src/components/error-screen.tsx": ["font-mono"],
	// UPI IDs (vpa@bank) are identifiers people read out and compare character by character.
	"src/components/cart-copy-actions.tsx": ["font-mono"],
	"src/app/admin/settings/upi/component/upi-client-page.tsx": ["font-mono"],
};

/**
 * Files other packages are migrating this round (round 2). Each entry names the rules
 * it still breaks and the owning package. Remove entries as files are fixed; the round
 * must end with this empty.
 */
const PENDING: Record<string, { owner: "P1" | "P2" | "P3" | "P4"; rules: RuleId[] }> = {};

function listFiles(dir: string): string[] {
	const out: string[] = [];
	for (const entry of readdirSync(dir)) {
		const full = join(dir, entry);
		if (statSync(full).isDirectory()) {
			out.push(...listFiles(full));
		} else if (/\.tsx?$/.test(entry) && !/\.(test|fixture)\.tsx?$/.test(entry)) {
			out.push(full);
		}
	}
	return out;
}

/** Strips `//` and block comments so documentation can mention the banned patterns. */
function stripComments(source: string): string {
	return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
}

type Violation = { file: string; rule: RuleId; line: number; text: string };

function scan(): Violation[] {
	const violations: Violation[] = [];
	for (const dir of SCAN_DIRS) {
		for (const full of listFiles(join(ROOT, dir))) {
			const file = relative(ROOT, full);
			const source = stripComments(readFileSync(full, "utf8"));
			const lines = source.split("\n");
			for (const rule of RULES) {
				const extensions = rule.extensions ?? [".ts", ".tsx"];
				if (!extensions.some((ext) => file.endsWith(ext))) continue;
				if (rule.onlyIf && !rule.onlyIf.test(source)) continue;
				lines.forEach((text, index) => {
					if (rule.pattern.test(text)) violations.push({ file, rule: rule.id, line: index + 1, text: text.trim() });
				});
			}
		}
	}
	return violations;
}

const violations = scan();

// `DESIGN_CONTRACT_DUMP=1 pnpm exec vitest run src/lib/design-contract.test.ts` prints every
// violation grouped by file, to rebuild PENDING or find what's left.
if (process.env.DESIGN_CONTRACT_DUMP) {
	const byFile = new Map<string, Set<RuleId>>();
	for (const v of violations) byFile.set(v.file, (byFile.get(v.file) ?? new Set()).add(v.rule));
	console.log(JSON.stringify(Object.fromEntries([...byFile].map(([f, r]) => [f, [...r]])), null, 1));
}

function isExcused(v: Violation): boolean {
	return Boolean(ALLOWED[v.file]?.includes(v.rule) || PENDING[v.file]?.rules.includes(v.rule));
}

describe("design contract", () => {
	for (const rule of RULES) {
		it(`${rule.id}: ${rule.description}`, () => {
			const offending = violations
				.filter((v) => v.rule === rule.id && !isExcused(v))
				.map((v) => `${v.file}:${v.line}  ${v.text}`);
			expect(offending, `Fix these or use the shared primitive/format helper:\n${offending.join("\n")}`).toEqual([]);
		});
	}

	it("ui primitives never take an allowlist entry", () => {
		// ui/sidebar.tsx is owned by the shell package (B) this round.
		const uiEntries = [...Object.keys(ALLOWED), ...Object.keys(PENDING)].filter(
			(file) => file.startsWith("src/components/ui/") && file !== "src/components/ui/sidebar.tsx",
		);
		expect(uiEntries).toEqual([]);
	});

	it("pending entries name a real file", () => {
		const files = new Set(SCAN_DIRS.flatMap((dir) => listFiles(join(ROOT, dir)).map((f) => relative(ROOT, f))));
		const missing = Object.keys(PENDING).filter((file) => !files.has(file));
		expect(missing, "Remove PENDING entries for deleted files").toEqual([]);
		// Entries whose file is already clean are reported, not failed, so a package that fixes
		// its file mid-round isn't blocked on a test it doesn't own. The cleanup removes them.
		const stale = Object.entries(PENDING)
			.filter(([file, entry]) =>
				entry.rules.every((rule) => !violations.some((v) => v.file === file && v.rule === rule)),
			)
			.map(([file]) => file);
		if (stale.length > 0)
			console.info(`design-contract: PENDING entries already clean, remove them: ${stale.join(", ")}`);
	});
});

// ---------------------------------------------------------------------------
// Colour tokens: contrast is part of the contract.
// ---------------------------------------------------------------------------

function readTokens(): Record<string, string> {
	const css = readFileSync(join(ROOT, "src/app/globals.css"), "utf8");
	const root = /:root\s*\{([\s\S]*?)\n\}/.exec(css)?.[1] ?? "";
	const tokens: Record<string, string> = {};
	for (const match of root.matchAll(/--([\w-]+):\s*([^;]+);/g)) tokens[match[1]] = match[2].trim();
	return tokens;
}

/** oklch(L C H) → relative luminance (WCAG), via OKLab → linear sRGB. */
function luminance(value: string): number {
	const match = /oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)/.exec(value);
	if (!match) throw new Error(`Not an oklch() colour: ${value}`);
	const [l, c, h] = [Number(match[1]), Number(match[2]), (Number(match[3]) * Math.PI) / 180];
	const a = c * Math.cos(h);
	const b = c * Math.sin(h);
	const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
	const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
	const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
	const clamp = (x: number) => Math.min(1, Math.max(0, x));
	const r = clamp(4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_);
	const g = clamp(-1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_);
	const bl = clamp(-0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_);
	return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
}

function contrast(fg: string, bg: string): number {
	const [a, b] = [luminance(fg), luminance(bg)].sort((x, y) => y - x);
	return (a + 0.05) / (b + 0.05);
}

describe("colour tokens (light theme)", () => {
	const tokens = readTokens();

	it("defines the status tokens next to destructive", () => {
		for (const name of ["success", "warning", "info", "destructive"]) {
			expect(tokens[name], `--${name}`).toBeDefined();
			expect(tokens[`${name}-foreground`], `--${name}-foreground`).toBeDefined();
		}
	});

	it("keeps the cocoa primary and uses it as the first chart colour", () => {
		expect(tokens.primary).toBe("oklch(0.33 0.06 31.42)");
		expect(tokens["chart-1"]).toBe(tokens.primary);
	});

	it.each([
		["foreground", "background", 7],
		["foreground", "card", 7],
		["muted-foreground", "background", 4.5],
		["muted-foreground", "card", 4.5],
		["muted-foreground", "muted", 4.5],
		["primary-foreground", "primary", 4.5],
		["primary", "card", 4.5],
		["destructive", "card", 4.5],
		["success", "card", 4.5],
		["warning", "card", 4.5],
		["info", "card", 4.5],
	])("%s on %s is at least %d:1", (fg, bg, min) => {
		expect(contrast(tokens[fg], tokens[bg])).toBeGreaterThanOrEqual(min);
	});

	it("keeps neutrals warm (hue 30–80, low chroma)", () => {
		for (const name of ["background", "card", "muted", "muted-foreground", "border", "input", "accent", "foreground"]) {
			const [, , c, h] = /oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)/.exec(tokens[name]) ?? [];
			expect(Number(c), `--${name} chroma`).toBeLessThanOrEqual(0.03);
			if (Number(c) > 0) {
				expect(Number(h), `--${name} hue`).toBeGreaterThanOrEqual(30);
				expect(Number(h), `--${name} hue`).toBeLessThanOrEqual(80);
			}
		}
	});
});
