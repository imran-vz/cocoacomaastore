import crypto from "node:crypto";
import { relations } from "drizzle-orm";
import {
	boolean,
	integer,
	numeric,
	pgTable,
	text,
	timestamp,
	varchar,
} from "drizzle-orm/pg-core";

export const dessertsTable = pgTable("desserts", {
	id: integer().primaryKey().generatedAlwaysAsIdentity(),
	name: varchar({ length: 255 }).notNull(),
	price: integer().notNull(),
	description: varchar({ length: 255 }),
	isDeleted: boolean().notNull().default(false),
	enabled: boolean().notNull().default(true),
	isOutOfStock: boolean().notNull().default(false),
	sequence: integer().notNull().default(0),
});

export const ordersTable = pgTable("orders", {
	id: integer().primaryKey().generatedAlwaysAsIdentity(),
	customerName: varchar({ length: 255 }).notNull(),
	createdAt: timestamp().notNull().defaultNow(),
	deliveryCost: numeric({ precision: 5, scale: 2 }).notNull().default("0.00"),
	total: numeric({ precision: 10, scale: 2 }).notNull(),
	status: varchar("status", {
		enum: ["pending", "completed"],
	}).notNull(),
	isDeleted: boolean().notNull().default(false),
});

export const ordersRelations = relations(ordersTable, ({ many }) => ({
	orderItems: many(orderItemsTable),
}));

export const orderItemsTable = pgTable("order_items", {
	id: integer().primaryKey().generatedAlwaysAsIdentity(),
	orderId: integer().notNull(),
	dessertId: integer().notNull(),
	quantity: integer().notNull(),
});

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
