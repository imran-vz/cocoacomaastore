/**
 * Static conformance test for the design contract in docs/design/DESIGN.md.
 *
 * It reads source files (no rendering) and fails when a screen bypasses the shared
 * formatting module, the colour tokens or the quiet-disabled rule. Justified exceptions
 * live in `ALLOWED`.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { THEME_COLOR } from "@/app/theme-color";
import { MOTION_MS } from "@/lib/motion";

const ROOT = join(__dirname, "..", "..");
const SCAN_DIRS = ["src/components", "src/app", "src/features"];

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
	| "viewport-records"
	| "colour-function"
	| "type-role"
	| "z-layer"
	| "card-surface"
	| "feedback-duration"
	| "ring-focus"
	| "raw-duration";

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
		description: "Colour comes from tokens (primary, muted, success, warning, destructive), not raw Tailwind hues.",
		pattern:
			/\b(?:text|bg|border|ring|fill|stroke|from|to|via|outline|divide|accent|caret|shadow|decoration)-(?:red|green|blue|teal|emerald|orange|amber|yellow|lime|sky|cyan|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}\b/,
	},
	{
		id: "hex-color",
		description: "Charts and surfaces use colour tokens (var(--primary)), not hex literals.",
		pattern:
			/(?:(?<![[\w-])(?:fill|stroke|color|stopColor|background(?:Color)?)\s*[=:]\s*\{?\s*["'`]#[0-9a-fA-F]{3,8}\b|\b(?:bg|text|border|fill|stroke|from|to|via)-\[#[0-9a-fA-F]{3,8}\])/,
	},
	{
		id: "disabled-opacity",
		description: "Disabled controls go quiet (muted surface and text), they don't fade to a new colour.",
		pattern: /[\w-]*disabled[\w/-]*:opacity-(?!100\b)/,
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
		description:
			'Sentence case for titles, labels, buttons and JSX copy ("Add dessert", "Avg order value"); only acronyms (UPI, QR, PDF) and the Sell screen stay capitalised.',
		pattern:
			/(?:(?:\b(?:title|label|aria-label|[a-z]\w*Label)=|\blabel:\s*)"|(?<!=)>\s*)[A-Z][^"<>{}]*(?<![.!?:])\s(?!(?:UPI|QR|PDF|Sell)\b)[A-Z][a-z][^"<>{}]*["<]/,
		extensions: [".tsx"],
	},
	{
		id: "native-confirm",
		description:
			"Destructive confirmations use ConfirmSheet (ui/confirm-sheet.tsx), never the browser's confirm/alert/prompt.",
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
	{
		id: "colour-function",
		description: "Colour values live in globals.css as tokens; components don't write oklch()/rgb()/hsl() colours.",
		pattern: /(?<![a-zA-Z-])(?:oklch|rgba?|hsla?)\(/,
	},
	{
		id: "type-role",
		description:
			"Row titles (15/600) and meta lines (13) use the type roles `text-row` and `text-meta`, not their pixel sizes.",
		pattern: /text-\[(?:13px|0\.8125rem)\]|^(?=.*text-\[(?:15px|0\.9375rem)\])(?=.*(?<![\w-])font-semibold(?![\w-]))/,
	},
	{
		id: "z-layer",
		description: "Bars and overlays stack with `z-bar` and `z-overlay`, not numbered z-indexes.",
		pattern: /(?<![\w-])z-(?:30|40|50)\b/,
	},
	{
		id: "card-surface",
		description: "The card surface is `surface-card`, not rounded-xl/2xl + border + bg-card.",
		pattern:
			/^(?=.*(?<![\w-])rounded-(?:xl|2xl|3xl)(?![\w-]))(?=.*(?<![\w-:])border(?![\w-]))(?=.*(?<![\w-:])bg-card(?![\w-]))/,
	},
	{
		id: "feedback-duration",
		description: "Success and error flashes use the named lengths in `FEEDBACK_MS` (ui/feedback.ts).",
		pattern: /\bduration:\s*\d{3,}|\b\w*(?:FLASH|FEEDBACK)\w*_MS\s*=\s*\d/,
	},
	{
		id: "ring-focus",
		description:
			"Keyboard focus uses the `focus-ring`, `focus-ring-inset` or `focus-ring-group` utilities, not `ring-*` focus styles.",
		pattern: /(?:^|[\s"'`])(?:group-|peer-)?focus(?:-visible|-within)?:ring\b/,
	},
	{
		id: "raw-duration",
		description:
			"CSS transitions use the duration tokens (`duration-fast`, `duration-enter`, `duration-sheet`), not raw milliseconds.",
		pattern: /(?<![\w-])duration-\d+\b/,
	},
];

/** Justified exceptions: path → rules that may match there. Every entry needs a reason. */
const ALLOWED: Record<string, RuleId[]> = {
	// Error screens show a monospace error digest for support.
	"src/features/shell/error-screen.tsx": ["font-mono"],
	// UPI IDs (vpa@bank) are identifiers people read out and compare character by character.
	"src/features/upi/upi-accounts-page.tsx": ["font-mono"],
	// Invoice PDFs draw totals in jsPDF's built-in Helvetica, which has no ₹ glyph, so amounts print as "INR".
	"src/features/orders/invoice.ts": ["to-locale"],
};

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

function isExcused(v: Violation): boolean {
	return Boolean(ALLOWED[v.file]?.includes(v.rule));
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

	it("needs every exception it allows", () => {
		const unused = Object.entries(ALLOWED).flatMap(([file, rules]) =>
			rules
				.filter((rule) => !violations.some((v) => v.file === file && v.rule === rule))
				.map((rule) => `${file}: ${rule}`),
		);
		expect(unused, "Remove these ALLOWED entries").toEqual([]);
	});
});

function readTokens(): Record<string, string> {
	const css = readFileSync(join(ROOT, "src/app/globals.css"), "utf8");
	const root = /:root\s*\{([\s\S]*?)\n\}/.exec(css)?.[1] ?? "";
	const tokens: Record<string, string> = {};
	for (const match of root.matchAll(/--([\w-]+):\s*([^;]+);/g)) tokens[match[1]] = match[2].trim();
	return tokens;
}

/** oklch(L C H) → linear sRGB channels, via OKLab. */
function linearRgb(value: string): [number, number, number] {
	const match = /oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)/.exec(value);
	if (!match) throw new Error(`Not an oklch() colour: ${value}`);
	const [l, c, h] = [Number(match[1]), Number(match[2]), (Number(match[3]) * Math.PI) / 180];
	const a = c * Math.cos(h);
	const b = c * Math.sin(h);
	const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
	const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
	const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
	const clamp = (x: number) => Math.min(1, Math.max(0, x));
	return [
		clamp(4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_),
		clamp(-1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_),
		clamp(-0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_),
	];
}

/** Relative luminance (WCAG). */
function luminance(value: string): number {
	const [r, g, b] = linearRgb(value);
	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** 8-bit sRGB channels, as a hex colour spells them. */
function srgb(value: string): number[] {
	return linearRgb(value).map((channel) =>
		Math.round(255 * (channel <= 0.0031308 ? 12.92 * channel : 1.055 * channel ** (1 / 2.4) - 0.055)),
	);
}

function contrast(fg: string, bg: string): number {
	const [a, b] = [luminance(fg), luminance(bg)].sort((x, y) => y - x);
	return (a + 0.05) / (b + 0.05);
}

describe("colour tokens (light theme)", () => {
	const tokens = readTokens();

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
	])("%s on %s is at least %d:1", (fg, bg, min) => {
		expect(contrast(tokens[fg], tokens[bg])).toBeGreaterThanOrEqual(min);
	});

	it("gives the browser and installed-app chrome the page background", () => {
		const hex = THEME_COLOR.match(/[\da-f]{2}/gi)?.map((channel) => Number.parseInt(channel, 16)) ?? [];
		const background = srgb(tokens.background);
		expect(hex).toHaveLength(3);
		hex.forEach((channel, index) => {
			expect(Math.abs(channel - background[index]), `THEME_COLOR vs --background (${background})`).toBeLessThanOrEqual(
				1,
			);
		});
	});

	it("keeps neutrals warm (hue 40–75, low chroma)", () => {
		for (const name of ["background", "card", "muted", "muted-foreground", "border", "input", "accent", "foreground"]) {
			const [, , c, h] = /oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)/.exec(tokens[name]) ?? [];
			expect(Number(c), `--${name} chroma`).toBeLessThanOrEqual(0.03);
			if (Number(c) > 0) {
				expect(Number(h), `--${name} hue`).toBeGreaterThanOrEqual(40);
				expect(Number(h), `--${name} hue`).toBeLessThanOrEqual(75);
			}
		}
	});
});

describe("motion", () => {
	it("times Motion tweens with the CSS duration tokens", () => {
		const css = readFileSync(join(ROOT, "src/app/globals.css"), "utf8");
		const token = (name: string) => Number(new RegExp(`--transition-duration-${name}:\\s*(\\d+)ms`).exec(css)?.[1]);
		expect(Object.fromEntries(Object.keys(MOTION_MS).map((name) => [name, token(name)]))).toEqual(MOTION_MS);
	});
});
