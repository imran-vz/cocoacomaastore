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
		index("desserts_active_idx").on(
			table.isDeleted,
			table.enabled,
			table.sequence,
		),
	],
);

export type Dessert = typeof dessertsTable.$inferSelect;

export const ordersTable = pgTable(
	"orders",
	{
		id: integer().primaryKey().generatedAlwaysAsIdentity(),
		customerName: varchar({ length: 255 }).default(""),
		createdAt: timestamp().notNull().defaultNow(),
		deliveryCost: numeric({ precision: 5, scale: 2 }).notNull().default("0.00"),
		total: numeric({ precision: 10, scale: 2 }).notNull(),
		status: varchar("status", {
			enum: ["pending", "completed"],
		}).notNull(),
		isDeleted: boolean().notNull().default(false),
	},
	(table) => [
		index("orders_created_at_idx").on(table.createdAt),
		index("orders_is_deleted_idx").on(table.isDeleted),
		index("orders_active_idx").on(table.isDeleted, table.createdAt),
	],
);

export type Order = typeof ordersTable.$inferSelect;

export const ordersRelations = relations(ordersTable, ({ many }) => ({
	orderItems: many(orderItemsTable),
}));

export const orderItemsTable = pgTable("order_items", {
	id: integer().primaryKey().generatedAlwaysAsIdentity(),
	orderId: integer().notNull(),
	dessertId: integer().notNull(),
	quantity: integer().notNull(),
});

export type OrderItem = typeof orderItemsTable.$inferSelect;

export const orderItemsRelations = relations(orderItemsTable, ({ one }) => ({
	order: one(ordersTable, {
		fields: [orderItemsTable.orderId],
		references: [ordersTable.id],
	}),
	dessert: one(dessertsTable, {
		fields: [orderItemsTable.dessertId],
		references: [dessertsTable.id],
	}),
}));

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
			enum: ["set_stock", "order_deducted", "manual_adjustment"],
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
