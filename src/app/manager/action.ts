"use server";

import { unstable_cache } from "next/cache";

import { db } from "@/db";

async function getManagers() {
	// Get all users (admins and managers) from database, sorted by createdAt
	const managers = await db.query.userTable.findMany({
		columns: {
			id: true,
			name: true,
			email: true,
			role: true,
			createdAt: true,
		},
		orderBy: (managers, { asc }) => [asc(managers.createdAt)],
	});

	return managers;
}

export const getCachedManagers = unstable_cache(getManagers, ["managers"], {
	revalidate: 60 * 60 * 24, // 24 hours
	tags: ["managers"],
});
