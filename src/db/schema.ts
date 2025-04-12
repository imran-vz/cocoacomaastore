import { integer, pgTable, timestamp, varchar } from "drizzle-orm/pg-core";

export const dessertsTable = pgTable("desserts", {
	id: integer().primaryKey().generatedAlwaysAsIdentity(),
	name: varchar({ length: 255 }).notNull(),
	price: integer().notNull(),
	description: varchar({ length: 255 }).notNull(),
});

export const ordersTable = pgTable("orders", {
	id: integer().primaryKey().generatedAlwaysAsIdentity(),
	customerName: varchar({ length: 255 }).notNull(),
	createdAt: timestamp().notNull().defaultNow(),
	total: integer().notNull(),
	status: varchar("status", {
		enum: ["pending", "completed"],
	}).notNull(),
});

export const orderItemsTable = pgTable("order_items", {
	id: integer().primaryKey().generatedAlwaysAsIdentity(),
	orderId: integer()
		.references(() => ordersTable.id)
		.notNull(),
	dessertId: integer()
		.references(() => dessertsTable.id)
		.notNull(),
	quantity: integer().notNull(),
});
