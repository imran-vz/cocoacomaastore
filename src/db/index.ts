// src/db.ts

import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";
import { dessertsTable, orderItemsTable, ordersTable } from "./schema";

if (!process.env.DATABASE_URL) {
	throw new Error("DATABASE_URL is not set");
}

neonConfig.webSocketConstructor = ws;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export const db = drizzle({
	client: pool,
});
