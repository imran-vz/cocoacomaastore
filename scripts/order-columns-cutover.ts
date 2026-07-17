import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import postgres from "postgres";

export const ORDER_COLUMNS_ACKNOWLEDGEMENT = "BACKUP_VERIFIED_WRITES_PAUSED";
const ORDER_COLUMNS_DATABASE_VARIABLE = "ORDER_COLUMNS_DATABASE_URL";
const ORDER_COLUMNS_TOKEN_VARIABLE = "ORDER_COLUMNS_CONFIRMATION_TOKEN";
const ORDER_COLUMNS_ACKNOWLEDGEMENT_VARIABLE = "COCOACOMAA_ORDER_COLUMNS_ACKNOWLEDGEMENT";
const CUTOVER_APPLICATION_NAME = "cocoacomaa_order_columns_cutover";

const COLUMN_SPECS = [
	{ tableName: "orders", columnName: "submissionId", dataType: "character varying", maximumLength: 255 },
	{ tableName: "orders", columnName: "requestFingerprint", dataType: "character varying", maximumLength: 64 },
	{ tableName: "order_items", columnName: "baseDessertName", dataType: "character varying", maximumLength: 255 },
	{ tableName: "order_items", columnName: "inventoryDeducted", dataType: "boolean", maximumLength: null },
	{
		tableName: "order_item_modifiers",
		columnName: "dessertName",
		dataType: "character varying",
		maximumLength: 255,
	},
] as const;

export type OrderColumnsCutoverMode = "inspect" | "apply" | "verify";

export type OrderColumnsCutoverConfig = {
	mode: OrderColumnsCutoverMode;
	databaseUrl: string;
	confirmationToken?: string;
};

type ColumnInspection = {
	tableName: string;
	columnName: string;
	dataType: string;
	maximumLength: number | null;
	isNullable: boolean;
	defaultExpression: string | null;
	isGenerated: boolean;
};

type IndexInspection = {
	tableName: string;
	isUnique: boolean;
	isValid: boolean;
	isReady: boolean;
	isImmediate: boolean;
	isPartial: boolean;
	hasExpressions: boolean;
	keyColumnCount: number;
	columnNames: string[];
	definition: string;
};

type SourceState = {
	ordersCount: number;
	ordersDigest: string;
	orderItemsCount: number;
	orderItemsDigest: string;
	modifiersCount: number;
	modifiersDigest: string;
	dessertsCount: number;
	dessertsDigest: string;
	inventoryAuditsCount: number;
	inventoryAuditsDigest: string;
};

type CutoverDataState = {
	ordersDigest: string;
	orderItemsDigest: string;
	modifiersDigest: string;
};

type AnomalyCounts = {
	orderItemsWithoutOrder: number;
	orderItemsWithoutDessert: number;
	modifiersWithoutOrderItem: number;
	modifiersWithoutDessert: number;
	invalidIdentityPairs: number;
	prospectiveSubmissionDuplicates: number;
	prospectiveSubmissionTooLong: number;
	prospectiveFingerprintTooLong: number;
	duplicateDeductionPairs: number;
	invalidDeductionAudits: number;
	invalidDeductionAuditDays: number;
	unmatchedPositiveDeductionAudits: number;
	contradictoryInventoryFlags: number;
	nullSubmissionIds: number;
	nullRequestFingerprints: number;
	nullBaseDessertNames: number;
	nullInventoryFlags: number;
	nullModifierDessertNames: number;
};

export type OrderColumnsInspection = {
	target: {
		databaseName: string;
		databaseOid: string;
		serverAddress: string;
		serverPort: string;
		serverVersion: string;
	};
	columns: ColumnInspection[];
	submissionIndex: IndexInspection | null;
	unexpectedConstraints: string[];
	unexpectedIndexes: string[];
	source: SourceState;
	cutoverData: CutoverDataState;
	anomalies: AnomalyCounts;
};

export type OrderColumnsInspectionAnalysis = {
	phase: "legacy" | "partial" | "final";
	blockers: string[];
	confirmationToken: string;
};

export interface OrderColumnsCutoverDatabase {
	inspect(): Promise<OrderColumnsInspection>;
	apply(expectedConfirmationToken: string, cutoverSql: string): Promise<OrderColumnsInspection>;
	close(): Promise<void>;
}

class SafeCutoverError extends Error {}

type QueryExecutor = postgres.Sql | postgres.TransactionSql;

type CommandDependencies = {
	createDatabase: (databaseUrl: string) => Promise<OrderColumnsCutoverDatabase>;
	readCutoverSql: () => Promise<string>;
	log: (message: string) => void;
	error: (message: string) => void;
};

function requiredEnvironmentValue(environment: NodeJS.ProcessEnv, name: string) {
	const value = environment[name];
	if (value === undefined || value.trim() === "") throw new SafeCutoverError(`${name} is required.`);
	return value.trim();
}

export function parseOrderColumnsCutoverConfig(
	args: readonly string[],
	environment: NodeJS.ProcessEnv,
): OrderColumnsCutoverConfig {
	const mode = args[0];
	if (mode !== "inspect" && mode !== "apply" && mode !== "verify") {
		throw new SafeCutoverError("Choose exactly one cutover mode: inspect, apply, or verify.");
	}
	if (args.length !== 1) throw new SafeCutoverError("The cutover command accepts only one mode argument.");

	const databaseUrl = requiredEnvironmentValue(environment, ORDER_COLUMNS_DATABASE_VARIABLE);
	let parsed: URL;
	try {
		parsed = new URL(databaseUrl);
	} catch {
		throw new SafeCutoverError(`${ORDER_COLUMNS_DATABASE_VARIABLE} must be a valid PostgreSQL URL.`);
	}
	if (parsed.protocol !== "postgres:" && parsed.protocol !== "postgresql:") {
		throw new SafeCutoverError(`${ORDER_COLUMNS_DATABASE_VARIABLE} must use the postgres or postgresql protocol.`);
	}
	if (parsed.hash !== "") throw new SafeCutoverError(`${ORDER_COLUMNS_DATABASE_VARIABLE} must not contain a fragment.`);
	if (parsed.hostname === "" || parsed.username === "" || parsed.port === "") {
		throw new SafeCutoverError(
			`${ORDER_COLUMNS_DATABASE_VARIABLE} must explicitly include a hostname, username, and direct port.`,
		);
	}
	if (parsed.port === "6543") {
		throw new SafeCutoverError(`${ORDER_COLUMNS_DATABASE_VARIABLE} must use a direct connection, not port 6543.`);
	}
	if (parsed.pathname === "" || parsed.pathname === "/") {
		throw new SafeCutoverError(`${ORDER_COLUMNS_DATABASE_VARIABLE} must name a database.`);
	}
	for (const name of parsed.searchParams.keys()) {
		if (name !== "sslmode") {
			throw new SafeCutoverError(`${ORDER_COLUMNS_DATABASE_VARIABLE} may contain only the sslmode query parameter.`);
		}
	}
	const sslModes = parsed.searchParams.getAll("sslmode");
	if (sslModes.length > 1)
		throw new SafeCutoverError(`${ORDER_COLUMNS_DATABASE_VARIABLE} has duplicate sslmode values.`);
	if (sslModes.length === 1 && !["disable", "prefer", "require", "verify-full"].includes(sslModes[0] ?? "")) {
		throw new SafeCutoverError(`${ORDER_COLUMNS_DATABASE_VARIABLE} has an unsupported sslmode value.`);
	}

	if (mode !== "apply") return { mode, databaseUrl: parsed.toString() };

	const confirmationToken = requiredEnvironmentValue(environment, ORDER_COLUMNS_TOKEN_VARIABLE);
	if (!/^[a-f0-9]{64}$/.test(confirmationToken)) {
		throw new SafeCutoverError(`${ORDER_COLUMNS_TOKEN_VARIABLE} must be the token emitted by inspect.`);
	}
	if (environment[ORDER_COLUMNS_ACKNOWLEDGEMENT_VARIABLE] !== ORDER_COLUMNS_ACKNOWLEDGEMENT) {
		throw new SafeCutoverError(
			`${ORDER_COLUMNS_ACKNOWLEDGEMENT_VARIABLE} must exactly equal ${ORDER_COLUMNS_ACKNOWLEDGEMENT}.`,
		);
	}
	return { mode, databaseUrl: parsed.toString(), confirmationToken };
}

function toNumber(value: unknown, field: string) {
	const parsed = Number(value);
	if (!Number.isSafeInteger(parsed) || parsed < 0) throw new Error(`Invalid numeric inspection field: ${field}`);
	return parsed;
}

function toBoolean(value: unknown) {
	return value === true || value === "t" || value === "true";
}

function asString(value: unknown, field: string) {
	if (typeof value !== "string") throw new Error(`Invalid string inspection field: ${field}`);
	return value;
}

async function inspectColumns(sql: QueryExecutor): Promise<ColumnInspection[]> {
	const rows = await sql.unsafe<
		Array<{
			table_name: string;
			column_name: string;
			data_type: string;
			character_maximum_length: number | null;
			is_nullable: string;
			column_default: string | null;
			is_generated: string;
		}>
	>(`
		SELECT table_name, column_name, data_type, character_maximum_length,
		       is_nullable, column_default, is_generated
		FROM information_schema.columns
		WHERE table_schema = 'public'
		  AND (table_name, column_name) IN (
		    ('orders', 'submissionId'),
		    ('orders', 'requestFingerprint'),
		    ('order_items', 'baseDessertName'),
		    ('order_items', 'inventoryDeducted'),
		    ('order_item_modifiers', 'dessertName')
		  )
		ORDER BY table_name, column_name
	`);
	return rows.map((row) => ({
		tableName: row.table_name,
		columnName: row.column_name,
		dataType: row.data_type,
		maximumLength: row.character_maximum_length === null ? null : Number(row.character_maximum_length),
		isNullable: row.is_nullable === "YES",
		defaultExpression: row.column_default,
		isGenerated: row.is_generated !== "NEVER",
	}));
}

async function inspectSubmissionIndex(sql: QueryExecutor): Promise<IndexInspection | null> {
	const rows = await sql.unsafe<
		Array<{
			table_name: string;
			is_unique: boolean;
			is_valid: boolean;
			is_ready: boolean;
			is_immediate: boolean;
			is_partial: boolean;
			has_expressions: boolean;
			key_column_count: number;
			column_names: string[];
			definition: string;
		}>
	>(`
		SELECT table_class.relname AS table_name,
		       index_data.indisunique AS is_unique,
		       index_data.indisvalid AS is_valid,
		       index_data.indisready AS is_ready,
		       index_data.indimmediate AS is_immediate,
		       index_data.indpred IS NOT NULL AS is_partial,
		       index_data.indexprs IS NOT NULL AS has_expressions,
		       index_data.indnkeyatts AS key_column_count,
		       COALESCE(array_agg(attribute.attname ORDER BY key_column.ordinality)
		         FILTER (WHERE key_column.ordinality <= index_data.indnkeyatts), ARRAY[]::name[]) AS column_names,
		       pg_get_indexdef(index_class.oid) AS definition
		FROM pg_class index_class
		JOIN pg_namespace namespace ON namespace.oid = index_class.relnamespace
		JOIN pg_index index_data ON index_data.indexrelid = index_class.oid
		JOIN pg_class table_class ON table_class.oid = index_data.indrelid
		LEFT JOIN LATERAL unnest(index_data.indkey) WITH ORDINALITY AS key_column(attnum, ordinality) ON true
		LEFT JOIN pg_attribute attribute
		  ON attribute.attrelid = table_class.oid AND attribute.attnum = key_column.attnum
		WHERE namespace.nspname = 'public' AND index_class.relname = 'orders_submission_id_unique'
		GROUP BY index_class.oid, table_class.relname, index_data.indisunique, index_data.indisvalid,
		         index_data.indisready, index_data.indimmediate, index_data.indpred,
		         index_data.indexprs, index_data.indnkeyatts
	`);
	const row = rows[0];
	if (row === undefined) return null;
	return {
		tableName: row.table_name,
		isUnique: toBoolean(row.is_unique),
		isValid: toBoolean(row.is_valid),
		isReady: toBoolean(row.is_ready),
		isImmediate: toBoolean(row.is_immediate),
		isPartial: toBoolean(row.is_partial),
		hasExpressions: toBoolean(row.has_expressions),
		keyColumnCount: Number(row.key_column_count),
		columnNames: [...row.column_names],
		definition: row.definition,
	};
}

async function inspectUnexpectedSchemaObjects(sql: QueryExecutor) {
	const constraints = await sql.unsafe<Array<{ object_name: string }>>(`
		SELECT DISTINCT format('%I.%I', table_class.relname, constraint_data.conname) AS object_name
		FROM pg_constraint constraint_data
		JOIN pg_class table_class ON table_class.oid = constraint_data.conrelid
		JOIN pg_namespace namespace ON namespace.oid = table_class.relnamespace
		JOIN LATERAL unnest(constraint_data.conkey) AS key_column(attnum) ON true
		JOIN pg_attribute attribute
		  ON attribute.attrelid = table_class.oid AND attribute.attnum = key_column.attnum
		WHERE namespace.nspname = 'public'
		  AND (table_class.relname, attribute.attname) IN (
		    ('orders', 'submissionId'),
		    ('orders', 'requestFingerprint'),
		    ('order_items', 'baseDessertName'),
		    ('order_items', 'inventoryDeducted'),
		    ('order_item_modifiers', 'dessertName')
		  )
		ORDER BY object_name
	`);
	const indexes = await sql.unsafe<Array<{ object_name: string }>>(`
		SELECT DISTINCT format('%I.%I', table_class.relname, index_class.relname) AS object_name
		FROM pg_index index_data
		JOIN pg_class index_class ON index_class.oid = index_data.indexrelid
		JOIN pg_class table_class ON table_class.oid = index_data.indrelid
		JOIN pg_namespace namespace ON namespace.oid = table_class.relnamespace
		WHERE namespace.nspname = 'public'
		  AND table_class.relname IN ('orders', 'order_items', 'order_item_modifiers')
		  AND NOT (table_class.relname = 'orders' AND index_class.relname = 'orders_submission_id_unique')
		  AND (
		    index_data.indexprs IS NOT NULL
		    OR EXISTS (
		      SELECT 1
		      FROM unnest(index_data.indkey) AS key_column(attnum)
		      JOIN pg_attribute attribute
		        ON attribute.attrelid = table_class.oid AND attribute.attnum = key_column.attnum
		      WHERE (table_class.relname, attribute.attname) IN (
		        ('orders', 'submissionId'),
		        ('orders', 'requestFingerprint'),
		        ('order_items', 'baseDessertName'),
		        ('order_items', 'inventoryDeducted'),
		        ('order_item_modifiers', 'dessertName')
		      )
		    )
		  )
		ORDER BY object_name
	`);
	return {
		unexpectedConstraints: constraints.map((row) => row.object_name),
		unexpectedIndexes: indexes.map((row) => row.object_name),
	};
}

async function inspectTarget(sql: QueryExecutor): Promise<OrderColumnsInspection["target"]> {
	const rows = await sql.unsafe<
		Array<{
			database_name: string;
			database_oid: string;
			server_address: string | null;
			server_port: string | null;
			server_version: string;
		}>
	>(`
		SELECT current_database() AS database_name,
		       database.oid::text AS database_oid,
		       inet_server_addr()::text AS server_address,
		       inet_server_port()::text AS server_port,
		       current_setting('server_version_num') AS server_version
		FROM pg_database database
		WHERE database.datname = current_database()
	`);
	const row = rows[0];
	if (row === undefined) throw new Error("Database identity query returned no rows");
	return {
		databaseName: asString(row.database_name, "database_name"),
		databaseOid: asString(row.database_oid, "database_oid"),
		serverAddress: row.server_address ?? "local-socket",
		serverPort: row.server_port ?? "local-socket",
		serverVersion: asString(row.server_version, "server_version"),
	};
}

async function inspectSourceState(sql: QueryExecutor): Promise<SourceState> {
	const rows = await sql.unsafe<Array<Record<string, unknown>>>(`
		SELECT
		  (SELECT count(*) FROM public.orders)::text AS orders_count,
		  (SELECT md5(COALESCE(string_agg(md5(payload::text), '' ORDER BY id), ''))
		     FROM (SELECT id, to_jsonb(source_table) - 'submissionId' - 'requestFingerprint' AS payload
		           FROM public.orders source_table) source_row) AS orders_digest,
		  (SELECT count(*) FROM public.order_items)::text AS order_items_count,
		  (SELECT md5(COALESCE(string_agg(md5(payload::text), '' ORDER BY id), ''))
		     FROM (SELECT id, to_jsonb(source_table) - 'baseDessertName' - 'inventoryDeducted' AS payload
		           FROM public.order_items source_table) source_row) AS order_items_digest,
		  (SELECT count(*) FROM public.order_item_modifiers)::text AS modifiers_count,
		  (SELECT md5(COALESCE(string_agg(md5(payload::text), '' ORDER BY id), ''))
		     FROM (SELECT id, to_jsonb(source_table) - 'dessertName' AS payload
		           FROM public.order_item_modifiers source_table) source_row) AS modifiers_digest,
		  (SELECT count(*) FROM public.desserts)::text AS desserts_count,
		  (SELECT md5(COALESCE(string_agg(md5(to_jsonb(source_table)::text), '' ORDER BY id), ''))
		     FROM public.desserts source_table) AS desserts_digest,
		  (SELECT count(*) FROM public.inventory_audit_log)::text AS inventory_audits_count,
		  (SELECT md5(COALESCE(string_agg(md5(to_jsonb(source_table)::text), '' ORDER BY id), ''))
		     FROM public.inventory_audit_log source_table) AS inventory_audits_digest
	`);
	const row = rows[0];
	if (row === undefined) throw new Error("Source-state query returned no rows");
	return {
		ordersCount: toNumber(row.orders_count, "orders_count"),
		ordersDigest: asString(row.orders_digest, "orders_digest"),
		orderItemsCount: toNumber(row.order_items_count, "order_items_count"),
		orderItemsDigest: asString(row.order_items_digest, "order_items_digest"),
		modifiersCount: toNumber(row.modifiers_count, "modifiers_count"),
		modifiersDigest: asString(row.modifiers_digest, "modifiers_digest"),
		dessertsCount: toNumber(row.desserts_count, "desserts_count"),
		dessertsDigest: asString(row.desserts_digest, "desserts_digest"),
		inventoryAuditsCount: toNumber(row.inventory_audits_count, "inventory_audits_count"),
		inventoryAuditsDigest: asString(row.inventory_audits_digest, "inventory_audits_digest"),
	};
}

async function inspectCutoverDataState(
	sql: QueryExecutor,
	columns: readonly ColumnInspection[],
): Promise<CutoverDataState> {
	const value = (tableName: string, columnName: string) =>
		hasColumn(columns, tableName, columnName) ? `"${columnName}"::text` : "NULL::text";
	const rows = await sql.unsafe<Array<Record<string, unknown>>>(`
		SELECT
		  (SELECT md5(COALESCE(string_agg(
		     md5(jsonb_build_array(id, ${value("orders", "submissionId")}, ${value("orders", "requestFingerprint")})::text),
		     '' ORDER BY id), '')) FROM public.orders) AS orders_digest,
		  (SELECT md5(COALESCE(string_agg(
		     md5(jsonb_build_array(id, ${value("order_items", "baseDessertName")}, ${value("order_items", "inventoryDeducted")})::text),
		     '' ORDER BY id), '')) FROM public.order_items) AS order_items_digest,
		  (SELECT md5(COALESCE(string_agg(
		     md5(jsonb_build_array(id, ${value("order_item_modifiers", "dessertName")})::text),
		     '' ORDER BY id), '')) FROM public.order_item_modifiers) AS modifiers_digest
	`);
	const row = rows[0];
	if (row === undefined) throw new Error("Cutover-data query returned no rows");
	return {
		ordersDigest: asString(row.orders_digest, "cutover_orders_digest"),
		orderItemsDigest: asString(row.order_items_digest, "cutover_order_items_digest"),
		modifiersDigest: asString(row.modifiers_digest, "cutover_modifiers_digest"),
	};
}

function hasColumn(columns: readonly ColumnInspection[], tableName: string, columnName: string) {
	return columns.some((column) => column.tableName === tableName && column.columnName === columnName);
}

function hasUsableColumn(columns: readonly ColumnInspection[], tableName: string, columnName: string) {
	const spec = COLUMN_SPECS.find(
		(candidate) => candidate.tableName === tableName && candidate.columnName === columnName,
	);
	const actual = columns.find((column) => column.tableName === tableName && column.columnName === columnName);
	return spec !== undefined && actual !== undefined && expectedColumn(spec, actual);
}

async function inspectAnomalies(sql: QueryExecutor, columns: readonly ColumnInspection[]): Promise<AnomalyCounts> {
	const submissionValue = hasUsableColumn(columns, "orders", "submissionId") ? '"submissionId"' : "NULL::text";
	const fingerprintValue = hasUsableColumn(columns, "orders", "requestFingerprint")
		? '"requestFingerprint"'
		: "NULL::text";
	const submissionExpression = `COALESCE(${submissionValue}, 'legacy-order:' || id::text)`;
	const fingerprintExpression = `COALESCE(${fingerprintValue}, 'legacy-order:' || id::text)`;
	const inventoryContradiction = hasUsableColumn(columns, "order_items", "inventoryDeducted")
		? `(
			SELECT count(*) FROM public.order_items item
			WHERE item."inventoryDeducted" IS NOT NULL
			  AND item."inventoryDeducted" IS DISTINCT FROM EXISTS (
			    SELECT 1
			    FROM public.inventory_audit_log audit
			    JOIN public.orders parent ON parent.id = audit."orderId"
			    WHERE audit.action = 'order_deducted'
			      AND parent.id = item."orderId"
			      AND audit."dessertId" = item."dessertId"
			      AND audit."previousQuantity" > audit."newQuantity"
			      AND audit."previousQuantity" >= 0 AND audit."newQuantity" >= 0
			      AND audit.day = date_trunc('day', parent."createdAt" + interval '5 hours 30 minutes')
			  )
		  )`
		: "0";
	const nullCount = (tableName: string, columnName: string) =>
		hasColumn(columns, tableName, columnName)
			? `(SELECT count(*) FROM public.${tableName} WHERE "${columnName}" IS NULL)`
			: `(SELECT count(*) FROM public.${tableName})`;

	const rows = await sql.unsafe<Array<Record<string, unknown>>>(`
		SELECT
		  (SELECT count(*) FROM public.order_items item
		    WHERE NOT EXISTS (SELECT 1 FROM public.orders parent WHERE parent.id = item."orderId"))::text
		    AS order_items_without_order,
		  (SELECT count(*) FROM public.order_items item
		    WHERE NOT EXISTS (SELECT 1 FROM public.desserts dessert WHERE dessert.id = item."dessertId"))::text
		    AS order_items_without_dessert,
		  (SELECT count(*) FROM public.order_item_modifiers modifier
		    WHERE NOT EXISTS (SELECT 1 FROM public.order_items item WHERE item.id = modifier."orderItemId"))::text
		    AS modifiers_without_order_item,
		  (SELECT count(*) FROM public.order_item_modifiers modifier
		    WHERE NOT EXISTS (SELECT 1 FROM public.desserts dessert WHERE dessert.id = modifier."dessertId"))::text
		    AS modifiers_without_dessert,
		  (SELECT count(*) FROM public.orders
		    WHERE ((
		      (${submissionValue} IS NULL AND ${fingerprintValue} IS NULL)
		      OR (${submissionValue} = 'legacy-order:' || id::text
		          AND ${fingerprintValue} = 'legacy-order:' || id::text)
		      OR (${submissionValue} ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
		          AND ${fingerprintValue} ~ '^[0-9a-f]{64}$')
		    )) IS NOT TRUE)::text AS invalid_identity_pairs,
		  (SELECT count(*) FROM (
		    SELECT ${submissionExpression} AS candidate
		    FROM public.orders GROUP BY candidate HAVING count(*) > 1
		  ) duplicates)::text AS prospective_submission_duplicates,
		  (SELECT count(*) FROM public.orders WHERE length(${submissionExpression}) > 255)::text
		    AS prospective_submission_too_long,
		  (SELECT count(*) FROM public.orders WHERE length(${fingerprintExpression}) > 64)::text
		    AS prospective_fingerprint_too_long,
		  (SELECT count(*) FROM (
		    SELECT audit."orderId", audit."dessertId"
		    FROM public.inventory_audit_log audit
		    WHERE audit.action = 'order_deducted'
		      AND audit."orderId" IS NOT NULL AND audit."dessertId" IS NOT NULL
		    GROUP BY audit."orderId", audit."dessertId" HAVING count(*) > 1
		  ) duplicates)::text AS duplicate_deduction_pairs,
		  (SELECT count(*) FROM public.inventory_audit_log audit
		    WHERE audit.action = 'order_deducted'
		      AND audit."orderId" IS NOT NULL
		      AND (audit."dessertId" IS NULL
		           OR audit."previousQuantity" IS NULL OR audit."newQuantity" IS NULL
		           OR audit."previousQuantity" < 0 OR audit."newQuantity" < 0
		           OR audit."previousQuantity" <= audit."newQuantity"
		           OR NOT EXISTS (SELECT 1 FROM public.orders parent WHERE parent.id = audit."orderId")))::text
		    AS invalid_deduction_audits,
		  (SELECT count(*)
		    FROM public.inventory_audit_log audit
		    JOIN public.orders parent ON parent.id = audit."orderId"
		    WHERE audit.action = 'order_deducted'
		      AND audit.day IS DISTINCT FROM date_trunc('day', parent."createdAt" + interval '5 hours 30 minutes'))::text
		    AS invalid_deduction_audit_days,
		  (SELECT count(*) FROM public.inventory_audit_log audit
		    WHERE audit.action = 'order_deducted'
		      AND audit."orderId" IS NOT NULL AND audit."dessertId" IS NOT NULL
		      AND audit."previousQuantity" > audit."newQuantity"
		      AND audit."previousQuantity" >= 0 AND audit."newQuantity" >= 0
		      AND NOT EXISTS (
		        SELECT 1 FROM public.order_items item
		        WHERE item."orderId" = audit."orderId" AND item."dessertId" = audit."dessertId"
		      ))::text AS unmatched_positive_deduction_audits,
		  (${inventoryContradiction})::text AS contradictory_inventory_flags,
		  (${nullCount("orders", "submissionId")})::text AS null_submission_ids,
		  (${nullCount("orders", "requestFingerprint")})::text AS null_request_fingerprints,
		  (${nullCount("order_items", "baseDessertName")})::text AS null_base_dessert_names,
		  (${nullCount("order_items", "inventoryDeducted")})::text AS null_inventory_flags,
		  (${nullCount("order_item_modifiers", "dessertName")})::text AS null_modifier_dessert_names
	`);
	const row = rows[0];
	if (row === undefined) throw new Error("Anomaly query returned no rows");
	return {
		orderItemsWithoutOrder: toNumber(row.order_items_without_order, "order_items_without_order"),
		orderItemsWithoutDessert: toNumber(row.order_items_without_dessert, "order_items_without_dessert"),
		modifiersWithoutOrderItem: toNumber(row.modifiers_without_order_item, "modifiers_without_order_item"),
		modifiersWithoutDessert: toNumber(row.modifiers_without_dessert, "modifiers_without_dessert"),
		invalidIdentityPairs: toNumber(row.invalid_identity_pairs, "invalid_identity_pairs"),
		prospectiveSubmissionDuplicates: toNumber(
			row.prospective_submission_duplicates,
			"prospective_submission_duplicates",
		),
		prospectiveSubmissionTooLong: toNumber(row.prospective_submission_too_long, "prospective_submission_too_long"),
		prospectiveFingerprintTooLong: toNumber(row.prospective_fingerprint_too_long, "prospective_fingerprint_too_long"),
		duplicateDeductionPairs: toNumber(row.duplicate_deduction_pairs, "duplicate_deduction_pairs"),
		invalidDeductionAudits: toNumber(row.invalid_deduction_audits, "invalid_deduction_audits"),
		invalidDeductionAuditDays: toNumber(row.invalid_deduction_audit_days, "invalid_deduction_audit_days"),
		unmatchedPositiveDeductionAudits: toNumber(
			row.unmatched_positive_deduction_audits,
			"unmatched_positive_deduction_audits",
		),
		contradictoryInventoryFlags: toNumber(row.contradictory_inventory_flags, "contradictory_inventory_flags"),
		nullSubmissionIds: toNumber(row.null_submission_ids, "null_submission_ids"),
		nullRequestFingerprints: toNumber(row.null_request_fingerprints, "null_request_fingerprints"),
		nullBaseDessertNames: toNumber(row.null_base_dessert_names, "null_base_dessert_names"),
		nullInventoryFlags: toNumber(row.null_inventory_flags, "null_inventory_flags"),
		nullModifierDessertNames: toNumber(row.null_modifier_dessert_names, "null_modifier_dessert_names"),
	};
}

async function inspectDatabase(sql: QueryExecutor): Promise<OrderColumnsInspection> {
	const requiredTables = await sql.unsafe<Array<{ table_name: string }>>(`
		SELECT table_name FROM information_schema.tables
		WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
		  AND table_name IN ('orders', 'order_items', 'order_item_modifiers', 'desserts', 'inventory_audit_log')
		ORDER BY table_name
	`);
	if (requiredTables.length !== 5) throw new SafeCutoverError("CUTOVER: required public tables are missing.");

	const columns = await inspectColumns(sql);
	const [target, submissionIndex, schemaObjects, source, cutoverData, anomalies] = await Promise.all([
		inspectTarget(sql),
		inspectSubmissionIndex(sql),
		inspectUnexpectedSchemaObjects(sql),
		inspectSourceState(sql),
		inspectCutoverDataState(sql, columns),
		inspectAnomalies(sql, columns),
	]);
	return { target, columns, submissionIndex, ...schemaObjects, source, cutoverData, anomalies };
}

function expectedColumn(spec: (typeof COLUMN_SPECS)[number], actual: ColumnInspection) {
	return (
		actual.dataType === spec.dataType &&
		actual.maximumLength === spec.maximumLength &&
		actual.defaultExpression === null &&
		!actual.isGenerated
	);
}

function validSubmissionIndex(index: IndexInspection | null) {
	return (
		index !== null &&
		index.tableName === "orders" &&
		index.isUnique &&
		index.isValid &&
		index.isReady &&
		index.isImmediate &&
		!index.isPartial &&
		!index.hasExpressions &&
		index.keyColumnCount === 1 &&
		index.columnNames.length === 1 &&
		index.columnNames[0] === "submissionId" &&
		index.definition === 'CREATE UNIQUE INDEX orders_submission_id_unique ON public.orders USING btree ("submissionId")'
	);
}

export function createOrderColumnsConfirmationToken(inspection: OrderColumnsInspection) {
	return createHash("sha256").update(JSON.stringify(inspection)).digest("hex");
}

export function analyzeOrderColumnsInspection(inspection: OrderColumnsInspection): OrderColumnsInspectionAnalysis {
	const blockers: string[] = [];
	for (const spec of COLUMN_SPECS) {
		const actual = inspection.columns.find(
			(column) => column.tableName === spec.tableName && column.columnName === spec.columnName,
		);
		if (actual !== undefined && !expectedColumn(spec, actual)) {
			blockers.push(`${spec.tableName}.${spec.columnName} has an unexpected definition`);
		}
	}
	if (inspection.submissionIndex !== null && !validSubmissionIndex(inspection.submissionIndex)) {
		blockers.push("orders_submission_id_unique has an unexpected definition");
	}
	if (inspection.unexpectedConstraints.length > 0) {
		blockers.push(`unexpected cutover-column constraints: ${inspection.unexpectedConstraints.join(", ")}`);
	}
	if (inspection.unexpectedIndexes.length > 0) {
		blockers.push(`unexpected cutover-column indexes: ${inspection.unexpectedIndexes.join(", ")}`);
	}

	const anomalyLabels: Array<[keyof AnomalyCounts, string]> = [
		["orderItemsWithoutOrder", "order items without orders"],
		["orderItemsWithoutDessert", "order items without desserts"],
		["modifiersWithoutOrderItem", "modifiers without order items"],
		["modifiersWithoutDessert", "modifiers without desserts"],
		["invalidIdentityPairs", "invalid or incomplete identity pairs"],
		["prospectiveSubmissionDuplicates", "prospective duplicate submission IDs"],
		["prospectiveSubmissionTooLong", "prospective submission IDs longer than 255 characters"],
		["prospectiveFingerprintTooLong", "prospective fingerprints longer than 64 characters"],
		["duplicateDeductionPairs", "duplicate deduction-audit pairs"],
		["invalidDeductionAudits", "invalid deduction audits"],
		["invalidDeductionAuditDays", "deduction audits with the wrong operating day"],
		["unmatchedPositiveDeductionAudits", "positive deduction audits without matching order items"],
		["contradictoryInventoryFlags", "populated inventory flags contradicting audit evidence"],
	];
	for (const [name, label] of anomalyLabels) {
		const count = inspection.anomalies[name];
		if (count > 0) blockers.push(`${label}: ${count}`);
	}

	const allColumnsPresent = COLUMN_SPECS.every((spec) =>
		inspection.columns.some((column) => column.tableName === spec.tableName && column.columnName === spec.columnName),
	);
	const allColumnsFinal = COLUMN_SPECS.every((spec) => {
		const actual = inspection.columns.find(
			(column) => column.tableName === spec.tableName && column.columnName === spec.columnName,
		);
		return actual !== undefined && expectedColumn(spec, actual) && !actual.isNullable;
	});
	const nullCounts = [
		inspection.anomalies.nullSubmissionIds,
		inspection.anomalies.nullRequestFingerprints,
		inspection.anomalies.nullBaseDessertNames,
		inspection.anomalies.nullInventoryFlags,
		inspection.anomalies.nullModifierDessertNames,
	];
	const phase =
		allColumnsFinal && validSubmissionIndex(inspection.submissionIndex) && nullCounts.every((count) => count === 0)
			? "final"
			: allColumnsPresent || inspection.columns.length > 0 || inspection.submissionIndex !== null
				? "partial"
				: "legacy";
	return { phase, blockers, confirmationToken: createOrderColumnsConfirmationToken(inspection) };
}

function assertReadyForApply(inspection: OrderColumnsInspection) {
	const analysis = analyzeOrderColumnsInspection(inspection);
	if (analysis.blockers.length > 0) {
		throw new SafeCutoverError(`CUTOVER: preflight is blocked (${analysis.blockers.join("; ")}).`);
	}
}

function assertFinalState(inspection: OrderColumnsInspection) {
	const analysis = analyzeOrderColumnsInspection(inspection);
	if (analysis.blockers.length > 0 || analysis.phase !== "final") {
		throw new SafeCutoverError("CUTOVER: final verification failed; keep writes paused.");
	}
}

function sameSourceState(left: SourceState, right: SourceState) {
	return JSON.stringify(left) === JSON.stringify(right);
}

async function createPostgresCutoverDatabase(databaseUrl: string): Promise<OrderColumnsCutoverDatabase> {
	const sql = postgres(databaseUrl, {
		max: 1,
		prepare: false,
		connect_timeout: 10,
		connection: { application_name: CUTOVER_APPLICATION_NAME },
	});
	const inspectReadOnly = () =>
		sql.begin("isolation level repeatable read read only", async (transaction) => {
			await transaction.unsafe("SET LOCAL lock_timeout = '10s'");
			await transaction.unsafe("SET LOCAL statement_timeout = '120s'");
			await transaction.unsafe("SET LOCAL idle_in_transaction_session_timeout = '60s'");
			return inspectDatabase(transaction);
		});
	return {
		inspect: inspectReadOnly,
		apply: (expectedConfirmationToken, cutoverSql) =>
			sql.begin(async (transaction) => {
				await transaction.unsafe("SET LOCAL lock_timeout = '10s'");
				await transaction.unsafe("SET LOCAL statement_timeout = '120s'");
				await transaction.unsafe("SET LOCAL idle_in_transaction_session_timeout = '60s'");
				const lockRows = await transaction.unsafe<Array<{ acquired: boolean }>>(
					"SELECT pg_try_advisory_xact_lock(1129273921, 1330467395) AS acquired",
				);
				if (!toBoolean(lockRows[0]?.acquired)) throw new SafeCutoverError("CUTOVER: another cutover is running.");
				await transaction.unsafe(
					"LOCK TABLE public.orders, public.order_items, public.order_item_modifiers IN ACCESS EXCLUSIVE MODE",
				);
				await transaction.unsafe("LOCK TABLE public.inventory_audit_log, public.desserts IN SHARE MODE");

				const before = await inspectDatabase(transaction);
				assertReadyForApply(before);
				if (createOrderColumnsConfirmationToken(before) !== expectedConfirmationToken) {
					throw new SafeCutoverError("CUTOVER: target or preflight state changed; run inspect again.");
				}

				await transaction.unsafe(cutoverSql);
				const after = await inspectDatabase(transaction);
				if (!sameSourceState(before.source, after.source)) {
					throw new SafeCutoverError("CUTOVER: pre-existing business data changed; transaction rolled back.");
				}
				assertFinalState(after);
				return after;
			}),
		close: () => sql.end({ timeout: 5 }),
	};
}

async function readDefaultCutoverSql() {
	return readFile(new URL("./sql/order-columns-cutover.sql", import.meta.url), "utf8");
}

function safeFailureMessage(error: unknown) {
	if (error instanceof SafeCutoverError) return error.message;
	if (error instanceof Error && /^CUTOVER: [\w .,;:()'-]+$/.test(error.message) && error.message.length <= 500) {
		return error.message;
	}
	return "Order columns cutover failed.";
}

function formatInspection(inspection: OrderColumnsInspection) {
	const analysis = analyzeOrderColumnsInspection(inspection);
	const lines = [
		`Target: ${inspection.target.databaseName} on ${inspection.target.serverAddress}:${inspection.target.serverPort} (oid ${inspection.target.databaseOid})`,
		`Phase: ${analysis.phase}`,
		`Rows: ${inspection.source.ordersCount} orders, ${inspection.source.orderItemsCount} items, ${inspection.source.modifiersCount} modifiers`,
		`Preflight: ${analysis.blockers.length === 0 ? "ready" : `blocked (${analysis.blockers.join("; ")})`}`,
		`Confirmation token: ${analysis.confirmationToken}`,
	];
	return lines.join("\n");
}

export async function runOrderColumnsCutoverCommand({
	args = process.argv.slice(2),
	environment = process.env,
	createDatabase = createPostgresCutoverDatabase,
	readCutoverSql = readDefaultCutoverSql,
	log = console.log,
	error = console.error,
}: {
	args?: readonly string[];
	environment?: NodeJS.ProcessEnv;
	createDatabase?: CommandDependencies["createDatabase"];
	readCutoverSql?: CommandDependencies["readCutoverSql"];
	log?: CommandDependencies["log"];
	error?: CommandDependencies["error"];
} = {}): Promise<number> {
	let database: OrderColumnsCutoverDatabase | undefined;
	let mode: OrderColumnsCutoverMode | undefined;
	try {
		const config = parseOrderColumnsCutoverConfig(args, environment);
		mode = config.mode;
		database = await createDatabase(config.databaseUrl);
		if (config.mode === "inspect") {
			log(formatInspection(await database.inspect()));
			return 0;
		}
		if (config.mode === "verify") {
			const inspection = await database.inspect();
			assertFinalState(inspection);
			log(`Order columns cutover verified.\n${formatInspection(inspection)}`);
			return 0;
		}
		const cutoverSql = await readCutoverSql();
		const inspection = await database.apply(config.confirmationToken as string, cutoverSql);
		log(`Order columns cutover committed.\n${formatInspection(inspection)}`);
		return 0;
	} catch (caught) {
		const message = safeFailureMessage(caught);
		error(
			mode === "apply"
				? `${message} Keep writes paused and run verify before retrying or resuming the old application.`
				: message,
		);
		return 1;
	} finally {
		if (database !== undefined) {
			try {
				await database.close();
			} catch {
				// The command result is already determined; do not expose connection details during shutdown.
			}
		}
	}
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : undefined;
if (invokedPath === import.meta.url) {
	runOrderColumnsCutoverCommand().then((exitCode) => process.exit(exitCode));
}
