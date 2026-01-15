import crypto from "node:crypto";
import { relations } from "drizzle-orm";
import {
	boolean,
	index,
	integer,
	numeric,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	varchar,
} from "drizzle-orm/pg-core";

export const dessertsTable = pgTable(
	"desserts",
	{
		id: integer().primaryKey().generatedAlwaysAsIdentity(),
		name: varchar({ length: 255 }).notNull(),
		price: integer().notNull(),
		description: varchar({ length: 255 }),
		kind: varchar("kind", { length: 20, enum: ["base", "modifier"] })
			.notNull()
			.default("base"),
		isDeleted: boolean().notNull().default(false),
		enabled: boolean().notNull().default(true),
		isOutOfStock: boolean().notNull().default(false),
		hasUnlimitedStock: boolean().notNull().default(false),
		sequence: integer().notNull().default(0),
	},
	(table) => [
		index("desserts_is_deleted_idx").on(table.isDeleted),
		index("desserts_enabled_idx").on(table.enabled),
		index("desserts_sequence_idx").on(table.sequence),
		index("desserts_kind_idx").on(table.kind),
		index("desserts_active_idx").on(
			table.isDeleted,
			table.enabled,
			table.sequence,
		),
	],
);

export type Dessert = typeof dessertsTable.$inferSelect;

// ============================================================================
// Dessert Combos - preset templates with base dessert + modifiers
// ============================================================================

export const dessertCombosTable = pgTable(
	"dessert_combos",
	{
		id: integer().primaryKey().generatedAlwaysAsIdentity(),
		name: varchar({ length: 255 }).notNull(),
		baseDessertId: integer()
			.notNull()
			.references(() => dessertsTable.id, { onDelete: "cascade" }),
		overridePrice: integer(), // nullable: if set, use this instead of computed price
		enabled: boolean().notNull().default(true),
		isDeleted: boolean().notNull().default(false),
		sequence: integer().notNull().default(0),
		createdAt: timestamp().notNull().defaultNow(),
		updatedAt: timestamp().notNull().defaultNow(),
	},
	(table) => [
		index("dessert_combos_base_dessert_idx").on(table.baseDessertId),
		index("dessert_combos_enabled_idx").on(table.enabled),
		index("dessert_combos_is_deleted_idx").on(table.isDeleted),
		index("dessert_combos_sequence_idx").on(table.sequence),
	],
);

export type DessertCombo = typeof dessertCombosTable.$inferSelect;

export const dessertCombosRelations = relations(
	dessertCombosTable,
	({ one, many }) => ({
		baseDessert: one(dessertsTable, {
			fields: [dessertCombosTable.baseDessertId],
			references: [dessertsTable.id],
		}),
		items: many(dessertComboItemsTable),
	}),
);

// ============================================================================
// Dessert Combo Items - modifiers included in a combo
// ============================================================================

export const dessertComboItemsTable = pgTable(
	"dessert_combo_items",
	{
		id: integer().primaryKey().generatedAlwaysAsIdentity(),
		comboId: integer()
			.notNull()
			.references(() => dessertCombosTable.id, { onDelete: "cascade" }),
		dessertId: integer()
			.notNull()
			.references(() => dessertsTable.id, { onDelete: "cascade" }),
		quantity: integer().notNull().default(1), // quantity of this modifier per combo unit
	},
	(table) => [
		index("dessert_combo_items_combo_idx").on(table.comboId),
		index("dessert_combo_items_dessert_idx").on(table.dessertId),
		uniqueIndex("dessert_combo_items_unique").on(
			table.comboId,
			table.dessertId,
		),
	],
);

export type DessertComboItem = typeof dessertComboItemsTable.$inferSelect;

export const dessertComboItemsRelations = relations(
	dessertComboItemsTable,
	({ one }) => ({
		combo: one(dessertCombosTable, {
			fields: [dessertComboItemsTable.comboId],
			references: [dessertCombosTable.id],
		}),
		dessert: one(dessertsTable, {
			fields: [dessertComboItemsTable.dessertId],
			references: [dessertsTable.id],
		}),
	}),
);

export const ordersTable = pgTable(
	"orders",
	{
		id: integer().primaryKey().generatedAlwaysAsIdentity(),
		customerName: varchar({ length: 255 }).default(""),
		createdAt: timestamp().notNull().defaultNow(),
		deliveryCost: numeric({ precision: 5, scale: 2 }).notNull().default("0.00"),
		total: numeric({ precision: 10, scale: 2 }).notNull(),
		status: varchar("status", {
			enum: ["pending", "completed", "cancelled"],
		}).notNull(),
		isDeleted: boolean().notNull().default(false),
	},
	(table) => [
		index("orders_created_at_idx").on(table.createdAt),
		index("orders_is_deleted_idx").on(table.isDeleted),
		index("orders_active_idx").on(table.isDeleted, table.createdAt),
		// Performance: Index for filtering by status and ordering by date
		index("orders_status_created_at_idx").on(table.status, table.createdAt),
	],
);

export type Order = typeof ordersTable.$inferSelect;

export const ordersRelations = relations(ordersTable, ({ many }) => ({
	orderItems: many(orderItemsTable),
}));

export const orderItemsTable = pgTable(
	"order_items",
	{
		id: integer().primaryKey().generatedAlwaysAsIdentity(),
		orderId: integer().notNull(),
		dessertId: integer().notNull(),
		quantity: integer().notNull(),
		unitPrice: numeric({ precision: 10, scale: 2 }).notNull().default("0.00"), // snapshotted price per unit at order time
		comboName: varchar({ length: 255 }), // optional: name of the combo if this item was part of one
	},
	(table) => [
		// Performance: Indexes for foreign key joins
		index("order_items_order_id_idx").on(table.orderId),
		index("order_items_dessert_id_idx").on(table.dessertId),
	],
);

export type OrderItem = typeof orderItemsTable.$inferSelect;

export const orderItemsRelations = relations(
	orderItemsTable,
	({ one, many }) => ({
		order: one(ordersTable, {
			fields: [orderItemsTable.orderId],
			references: [ordersTable.id],
		}),
		dessert: one(dessertsTable, {
			fields: [orderItemsTable.dessertId],
			references: [dessertsTable.id],
		}),
		modifiers: many(orderItemModifiersTable),
	}),
);

// ============================================================================
// Order Item Modifiers - persists modifier selections per order item
// ============================================================================

export const orderItemModifiersTable = pgTable(
	"order_item_modifiers",
	{
		id: integer().primaryKey().generatedAlwaysAsIdentity(),
		orderItemId: integer()
			.notNull()
			.references(() => orderItemsTable.id, { onDelete: "cascade" }),
		dessertId: integer()
			.notNull()
			.references(() => dessertsTable.id, { onDelete: "cascade" }),
		quantity: integer().notNull().default(1), // quantity of this modifier per unit
	},
	(table) => [
		index("order_item_modifiers_order_item_idx").on(table.orderItemId),
		index("order_item_modifiers_dessert_idx").on(table.dessertId),
		uniqueIndex("order_item_modifiers_unique").on(
			table.orderItemId,
			table.dessertId,
		),
	],
);

export type OrderItemModifier = typeof orderItemModifiersTable.$inferSelect;

export const orderItemModifiersRelations = relations(
	orderItemModifiersTable,
	({ one }) => ({
		orderItem: one(orderItemsTable, {
			fields: [orderItemModifiersTable.orderItemId],
			references: [orderItemsTable.id],
		}),
		dessert: one(dessertsTable, {
			fields: [orderItemModifiersTable.dessertId],
			references: [dessertsTable.id],
		}),
	}),
);

export const dailyDessertInventoryTable = pgTable(
	"daily_dessert_inventory",
	{
		id: integer().primaryKey().generatedAlwaysAsIdentity(),
		day: timestamp().notNull(),
		dessertId: integer()
			.notNull()
			.references(() => dessertsTable.id, { onDelete: "cascade" }),
		quantity: integer().notNull().default(0),
		updatedAt: timestamp().notNull().defaultNow(),
	},
	(table) => [
		uniqueIndex("daily_dessert_inventory_day_dessert_unique").on(
			table.day,
			table.dessertId,
		),
		index("daily_dessert_inventory_day_idx").on(table.day),
	],
);

export const dailyDessertInventoryRelations = relations(
	dailyDessertInventoryTable,
	({ one }) => ({
		dessert: one(dessertsTable, {
			fields: [dailyDessertInventoryTable.dessertId],
			references: [dessertsTable.id],
		}),
	}),
);

export const upiAccountsTable = pgTable("upi_accounts", {
	id: text("id")
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	label: varchar({ length: 255 }).notNull(),
	upiId: varchar({ length: 255 }).notNull(),
	enabled: boolean().notNull().default(true),
	sequence: integer().notNull().default(0),
	isDeleted: boolean().notNull().default(false),
	createdAt: timestamp().notNull().defaultNow(),
});

export type UpiAccount = typeof upiAccountsTable.$inferSelect;

// Auth tables for better-auth
export const userTable = pgTable("user", {
	id: text("id")
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	name: text("name").notNull(),
	email: text("email").notNull().unique(),
	emailVerified: boolean("emailVerified").notNull().default(false),
	image: text("image"),
	createdAt: timestamp("createdAt").notNull().defaultNow(),
	updatedAt: timestamp("updatedAt").notNull().defaultNow(),
	role: varchar("role", { length: 20 }).notNull().default("manager"), // 'admin' or 'manager'
});

export type User = typeof userTable.$inferSelect;

export const sessionTable = pgTable("session", {
	id: text("id").primaryKey(),
	expiresAt: timestamp("expiresAt").notNull(),
	token: text("token").notNull().unique(),
	createdAt: timestamp("createdAt").notNull().defaultNow(),
	updatedAt: timestamp("updatedAt").notNull().defaultNow(),
	ipAddress: text("ipAddress"),
	userAgent: text("userAgent"),
	userId: text("userId")
		.notNull()
		.references(() => userTable.id, { onDelete: "cascade" }),
});

export const accountTable = pgTable("account", {
	id: text("id").primaryKey(),
	accountId: text("accountId").notNull(),
	providerId: text("providerId").notNull(),
	userId: text("userId")
		.notNull()
		.references(() => userTable.id, { onDelete: "cascade" }),
	accessToken: text("accessToken"),
	refreshToken: text("refreshToken"),
	idToken: text("idToken"),
	accessTokenExpiresAt: timestamp("accessTokenExpiresAt"),
	refreshTokenExpiresAt: timestamp("refreshTokenExpiresAt"),
	scope: text("scope"),
	password: text("password"),
	createdAt: timestamp("createdAt").notNull().defaultNow(),
	updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

export const verificationTable = pgTable("verification", {
	id: text("id").primaryKey(),
	identifier: text("identifier").notNull(),
	value: text("value").notNull(),
	expiresAt: timestamp("expiresAt").notNull(),
	createdAt: timestamp("createdAt").notNull().defaultNow(),
	updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

export const inventoryAuditLogTable = pgTable(
	"inventory_audit_log",
	{
		id: integer().primaryKey().generatedAlwaysAsIdentity(),
		day: timestamp().notNull(),
		dessertId: integer()
			.notNull()
			.references(() => dessertsTable.id, { onDelete: "cascade" }),
		action: varchar("action", {
			enum: [
				"set_stock",
				"order_deducted",
				"manual_adjustment",
				"order_cancelled",
			],
		}).notNull(),
		previousQuantity: integer().notNull(),
		newQuantity: integer().notNull(),
		orderId: integer().references(() => ordersTable.id, {
			onDelete: "set null",
		}),
		userId: text().references(() => userTable.id, { onDelete: "set null" }),
		note: varchar({ length: 500 }),
		createdAt: timestamp().notNull().defaultNow(),
	},
	(table) => [
		index("inventory_audit_log_day_idx").on(table.day),
		index("inventory_audit_log_dessert_idx").on(table.dessertId),
		index("inventory_audit_log_order_idx").on(table.orderId),
	],
);

export type InventoryAuditLog = typeof inventoryAuditLogTable.$inferSelect;

export const inventoryAuditLogRelations = relations(
	inventoryAuditLogTable,
	({ one }) => ({
		dessert: one(dessertsTable, {
			fields: [inventoryAuditLogTable.dessertId],
			references: [dessertsTable.id],
		}),
		order: one(ordersTable, {
			fields: [inventoryAuditLogTable.orderId],
			references: [ordersTable.id],
		}),
		user: one(userTable, {
			fields: [inventoryAuditLogTable.userId],
			references: [userTable.id],
		}),
	}),
);
