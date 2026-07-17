import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
	analyzeOrderColumnsInspection,
	createOrderColumnsConfirmationToken,
	ORDER_COLUMNS_ACKNOWLEDGEMENT,
	type OrderColumnsCutoverDatabase,
	type OrderColumnsInspection,
	parseOrderColumnsCutoverConfig,
	runOrderColumnsCutoverCommand,
} from "../../scripts/order-columns-cutover";

const ROOT = path.resolve(import.meta.dirname, "../..");
const DATABASE_URL = "postgresql://operator:sentinel-secret@db.example.invalid:5432/cocoacomaa?sslmode=require";
const TOKEN = "a".repeat(64);

function anomalyCounts(overrides: Partial<OrderColumnsInspection["anomalies"]> = {}) {
	return {
		orderItemsWithoutOrder: 0,
		orderItemsWithoutDessert: 0,
		modifiersWithoutOrderItem: 0,
		modifiersWithoutDessert: 0,
		invalidIdentityPairs: 0,
		prospectiveSubmissionDuplicates: 0,
		prospectiveSubmissionTooLong: 0,
		prospectiveFingerprintTooLong: 0,
		duplicateDeductionPairs: 0,
		invalidDeductionAudits: 0,
		invalidDeductionAuditDays: 0,
		unmatchedPositiveDeductionAudits: 0,
		contradictoryInventoryFlags: 0,
		nullSubmissionIds: 0,
		nullRequestFingerprints: 0,
		nullBaseDessertNames: 0,
		nullInventoryFlags: 0,
		nullModifierDessertNames: 0,
		...overrides,
	};
}

function sourceState(overrides: Partial<OrderColumnsInspection["source"]> = {}) {
	return {
		ordersCount: 3_943,
		ordersDigest: "orders-digest",
		orderItemsCount: 7_759,
		orderItemsDigest: "items-digest",
		modifiersCount: 676,
		modifiersDigest: "modifiers-digest",
		dessertsCount: 20,
		dessertsDigest: "desserts-digest",
		inventoryAuditsCount: 100,
		inventoryAuditsDigest: "audits-digest",
		...overrides,
	};
}

function legacyInspection(overrides: Partial<OrderColumnsInspection> = {}): OrderColumnsInspection {
	return {
		target: {
			databaseName: "cocoacomaa",
			databaseOid: "16384",
			serverAddress: "10.0.0.10",
			serverPort: "5432",
			serverVersion: "170006",
		},
		columns: [],
		submissionIndex: null,
		unexpectedConstraints: [],
		unexpectedIndexes: [],
		source: sourceState(),
		cutoverData: {
			ordersDigest: "legacy-order-columns-digest",
			orderItemsDigest: "legacy-item-columns-digest",
			modifiersDigest: "legacy-modifier-columns-digest",
		},
		anomalies: anomalyCounts({
			nullSubmissionIds: 3_943,
			nullRequestFingerprints: 3_943,
			nullBaseDessertNames: 7_759,
			nullInventoryFlags: 7_759,
			nullModifierDessertNames: 676,
		}),
		...overrides,
	};
}

function finalInspection(overrides: Partial<OrderColumnsInspection> = {}): OrderColumnsInspection {
	return legacyInspection({
		columns: [
			{
				tableName: "orders",
				columnName: "requestFingerprint",
				dataType: "character varying",
				maximumLength: 64,
				isNullable: false,
				defaultExpression: null,
				isGenerated: false,
			},
			{
				tableName: "orders",
				columnName: "submissionId",
				dataType: "character varying",
				maximumLength: 255,
				isNullable: false,
				defaultExpression: null,
				isGenerated: false,
			},
			{
				tableName: "order_items",
				columnName: "baseDessertName",
				dataType: "character varying",
				maximumLength: 255,
				isNullable: false,
				defaultExpression: null,
				isGenerated: false,
			},
			{
				tableName: "order_items",
				columnName: "inventoryDeducted",
				dataType: "boolean",
				maximumLength: null,
				isNullable: false,
				defaultExpression: null,
				isGenerated: false,
			},
			{
				tableName: "order_item_modifiers",
				columnName: "dessertName",
				dataType: "character varying",
				maximumLength: 255,
				isNullable: false,
				defaultExpression: null,
				isGenerated: false,
			},
		],
		submissionIndex: {
			tableName: "orders",
			isUnique: true,
			isValid: true,
			isReady: true,
			isImmediate: true,
			isPartial: false,
			hasExpressions: false,
			keyColumnCount: 1,
			columnNames: ["submissionId"],
			definition: 'CREATE UNIQUE INDEX orders_submission_id_unique ON public.orders USING btree ("submissionId")',
		},
		anomalies: anomalyCounts(),
		...overrides,
	});
}

function environment(overrides: Partial<NodeJS.ProcessEnv> = {}): NodeJS.ProcessEnv {
	return { NODE_ENV: "test", ORDER_COLUMNS_DATABASE_URL: DATABASE_URL, ...overrides };
}

function fakeDatabase(inspection: OrderColumnsInspection = legacyInspection()) {
	return {
		inspect: vi.fn(async () => inspection),
		apply: vi.fn(async () => finalInspection()),
		close: vi.fn(async () => undefined),
	} satisfies OrderColumnsCutoverDatabase;
}

describe("order columns cutover configuration", () => {
	it("accepts explicit read-only modes and a direct PostgreSQL URL", () => {
		expect(parseOrderColumnsCutoverConfig(["inspect"], environment())).toEqual({
			mode: "inspect",
			databaseUrl: DATABASE_URL,
		});
		expect(parseOrderColumnsCutoverConfig(["verify"], environment()).mode).toBe("verify");
	});

	it("requires an explicit supported mode and dedicated database URL", () => {
		expect(() => parseOrderColumnsCutoverConfig([], environment())).toThrow("Choose exactly one");
		expect(() => parseOrderColumnsCutoverConfig(["apply", "extra"], environment())).toThrow("only one mode");
		expect(() => parseOrderColumnsCutoverConfig(["inspect"], { NODE_ENV: "test" })).toThrow(
			"ORDER_COLUMNS_DATABASE_URL is required",
		);
	});

	it("rejects unsafe URL forms before connecting", () => {
		for (const databaseUrl of [
			"https://db.example.invalid/cocoacomaa",
			"postgresql://db.example.invalid:6543/cocoacomaa",
			"postgresql://operator@db.example.invalid/cocoacomaa",
			"postgresql://db.example.invalid:5432/cocoacomaa",
			"postgresql:///cocoacomaa",
			"postgresql://operator@db.example.invalid:5432/cocoacomaa?sslmode=verify-ca",
			"postgresql://operator@db.example.invalid:5432/cocoacomaa#fragment",
			"postgresql://db.example.invalid/cocoacomaa?host=other.example.invalid",
			"postgresql://db.example.invalid/cocoacomaa?sslmode=unknown",
			"postgresql://db.example.invalid/",
		]) {
			expect(() =>
				parseOrderColumnsCutoverConfig(["inspect"], environment({ ORDER_COLUMNS_DATABASE_URL: databaseUrl })),
			).toThrow();
		}
	});

	it("requires the inspection token and exact one-purpose acknowledgement for apply", () => {
		for (const acknowledgement of [undefined, "writes_paused", `${ORDER_COLUMNS_ACKNOWLEDGEMENT} `]) {
			expect(() =>
				parseOrderColumnsCutoverConfig(
					["apply"],
					environment({
						ORDER_COLUMNS_CONFIRMATION_TOKEN: TOKEN,
						COCOACOMAA_ORDER_COLUMNS_ACKNOWLEDGEMENT: acknowledgement,
					}),
				),
			).toThrow("must exactly equal");
		}
		expect(() =>
			parseOrderColumnsCutoverConfig(
				["apply"],
				environment({
					ORDER_COLUMNS_CONFIRMATION_TOKEN: "not-an-inspection-token",
					COCOACOMAA_ORDER_COLUMNS_ACKNOWLEDGEMENT: ORDER_COLUMNS_ACKNOWLEDGEMENT,
				}),
			),
		).toThrow("token emitted by inspect");
		expect(
			parseOrderColumnsCutoverConfig(
				["apply"],
				environment({
					ORDER_COLUMNS_CONFIRMATION_TOKEN: TOKEN,
					COCOACOMAA_ORDER_COLUMNS_ACKNOWLEDGEMENT: ORDER_COLUMNS_ACKNOWLEDGEMENT,
				}),
			),
		).toMatchObject({ mode: "apply", confirmationToken: TOKEN });
	});
});

describe("order columns inspection", () => {
	it("creates deterministic tokens bound to target and source state", () => {
		const inspection = legacyInspection();
		expect(createOrderColumnsConfirmationToken(inspection)).toBe(createOrderColumnsConfirmationToken(inspection));
		expect(createOrderColumnsConfirmationToken(inspection)).not.toBe(
			createOrderColumnsConfirmationToken(
				legacyInspection({ source: sourceState({ ordersDigest: "changed-orders-digest" }) }),
			),
		);
		expect(createOrderColumnsConfirmationToken(inspection)).not.toBe(
			createOrderColumnsConfirmationToken(
				legacyInspection({
					cutoverData: { ...inspection.cutoverData, ordersDigest: "changed-partial-values" },
				}),
			),
		);
		expect(createOrderColumnsConfirmationToken(inspection)).not.toBe(
			createOrderColumnsConfirmationToken(
				legacyInspection({ target: { ...inspection.target, databaseOid: "different-oid" } }),
			),
		);
	});

	it("distinguishes legacy, partial, final, and blocked states", () => {
		expect(analyzeOrderColumnsInspection(legacyInspection())).toMatchObject({ phase: "legacy", blockers: [] });
		expect(
			analyzeOrderColumnsInspection(
				legacyInspection({
					columns: [
						{
							tableName: "orders",
							columnName: "submissionId",
							dataType: "character varying",
							maximumLength: 255,
							isNullable: true,
							defaultExpression: null,
							isGenerated: false,
						},
					],
				}),
			),
		).toMatchObject({ phase: "partial", blockers: [] });
		expect(analyzeOrderColumnsInspection(finalInspection())).toMatchObject({ phase: "final", blockers: [] });
		expect(
			analyzeOrderColumnsInspection(legacyInspection({ anomalies: anomalyCounts({ duplicateDeductionPairs: 2 }) }))
				.blockers,
		).toContain("duplicate deduction-audit pairs: 2");
		expect(
			analyzeOrderColumnsInspection(
				legacyInspection({ unexpectedConstraints: ["orders.unexpected_submission_constraint"] }),
			).blockers,
		).toContain("unexpected cutover-column constraints: orders.unexpected_submission_constraint");
	});
});

describe("order columns cutover command", () => {
	it("validates configuration before creating a database connection", async () => {
		const createDatabase = vi.fn(async () => fakeDatabase());
		const error = vi.fn();
		await expect(
			runOrderColumnsCutoverCommand({ args: [], environment: environment(), createDatabase, error }),
		).resolves.toBe(1);
		expect(createDatabase).not.toHaveBeenCalled();
	});

	it("inspects and closes the exact target without reading mutation SQL", async () => {
		const database = fakeDatabase();
		const readCutoverSql = vi.fn(async () => "sentinel-sql");
		const log = vi.fn();
		await expect(
			runOrderColumnsCutoverCommand({
				args: ["inspect"],
				environment: environment(),
				createDatabase: async () => database,
				readCutoverSql,
				log,
			}),
		).resolves.toBe(0);
		expect(database.inspect).toHaveBeenCalledOnce();
		expect(readCutoverSql).not.toHaveBeenCalled();
		expect(database.close).toHaveBeenCalledOnce();
		expect(log.mock.calls.flat().join(" ")).toContain("Confirmation token:");
	});

	it("passes the inspected token and reviewed SQL only in apply mode", async () => {
		const database = fakeDatabase();
		const readCutoverSql = vi.fn(async () => "reviewed-cutover-sql");
		await expect(
			runOrderColumnsCutoverCommand({
				args: ["apply"],
				environment: environment({
					ORDER_COLUMNS_CONFIRMATION_TOKEN: TOKEN,
					COCOACOMAA_ORDER_COLUMNS_ACKNOWLEDGEMENT: ORDER_COLUMNS_ACKNOWLEDGEMENT,
				}),
				createDatabase: async () => database,
				readCutoverSql,
				log: vi.fn(),
			}),
		).resolves.toBe(0);
		expect(database.apply).toHaveBeenCalledWith(TOKEN, "reviewed-cutover-sql");
		expect(database.close).toHaveBeenCalledOnce();
	});

	it("requires final state in verify mode", async () => {
		const error = vi.fn();
		await expect(
			runOrderColumnsCutoverCommand({
				args: ["verify"],
				environment: environment(),
				createDatabase: async () => fakeDatabase(legacyInspection()),
				error,
			}),
		).resolves.toBe(1);
		expect(error).toHaveBeenCalledWith("CUTOVER: final verification failed; keep writes paused.");
	});

	it("does not expose credentials or raw dependency failures", async () => {
		const error = vi.fn();
		await expect(
			runOrderColumnsCutoverCommand({
				args: ["inspect"],
				environment: environment(),
				createDatabase: async () => {
					throw new Error(`sentinel raw failure ${DATABASE_URL}`);
				},
				error,
			}),
		).resolves.toBe(1);
		const output = JSON.stringify(error.mock.calls);
		expect(output).toContain("Order columns cutover failed.");
		expect(output).not.toContain("sentinel-secret");
		expect(output).not.toContain("sentinel raw failure");
	});
});

describe("order columns cutover repository contract", () => {
	it("keeps the SQL staged, null-only, and independent of the unadopted migration baseline", async () => {
		const sql = await readFile(path.join(ROOT, "scripts/sql/order-columns-cutover.sql"), "utf8");
		expect(sql).toContain('ADD COLUMN IF NOT EXISTS "submissionId" varchar(255)');
		expect(sql).toContain('WHERE "submissionId" IS NULL');
		expect(sql).toContain('AND "requestFingerprint" IS NULL');
		expect(sql).toContain('WHERE item."baseDessertName" IS NULL');
		expect(sql).toContain('WHERE modifier."dessertName" IS NULL');
		expect(sql).toContain('WHERE item."inventoryDeducted" IS NULL');
		expect(sql).toContain("'legacy-order:' || id::text");
		expect(sql).toContain("audit.action = 'order_deducted'");
		expect(sql).toContain("date_trunc('day', parent.\"createdAt\" + interval '5 hours 30 minutes')");
		expect(sql).toContain("index_data.indimmediate");
		expect(sql).toContain("unexpected constraints reference cutover columns");
		expect(sql).toContain('ALTER COLUMN "submissionId" SET NOT NULL');
		expect(sql).toContain("CREATE UNIQUE INDEX IF NOT EXISTS orders_submission_id_unique");
		expect(sql).not.toMatch(/\b(?:DELETE|TRUNCATE)\b/i);
		expect(sql).not.toContain("hasUnlimitedStock");
		expect(sql).not.toContain("__drizzle_migrations");
		expect(sql).not.toContain("0000_sweet_jackal");
	});

	it("exposes only the guarded one-off command", async () => {
		const packageJson = JSON.parse(await readFile(path.join(ROOT, "package.json"), "utf8")) as {
			scripts: Record<string, string>;
		};
		expect(packageJson.scripts["db:cutover:order-columns"]).toBe("tsx scripts/order-columns-cutover.ts");
		expect(packageJson.scripts).not.toHaveProperty("db:migrate");
		expect(packageJson.scripts).not.toHaveProperty("db:generate");
	});
});
