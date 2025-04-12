import { integer, pgTable, varchar } from "drizzle-orm/pg-core";

export const dessertsTable = pgTable("desserts", {
	id: integer().primaryKey().generatedAlwaysAsIdentity(),
	name: varchar({ length: 255 }).notNull(),
	price: integer().notNull(),
	description: varchar({ length: 255 }).notNull(),
});
