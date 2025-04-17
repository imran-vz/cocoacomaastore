import { relations } from "drizzle-orm";
import {
	boolean,
	integer,
	numeric,
	pgTable,
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
