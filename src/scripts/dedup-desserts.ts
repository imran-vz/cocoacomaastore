/**
 * One-time dedup script for desserts.
 * Finds active desserts with duplicate names (case-insensitive),
 * keeps the one with most order_items references (tie-break: lowest sequence),
 * and soft-deletes the rest.
 *
 * Run BEFORE applying the unique index migration.
 * Usage: npx tsx src/scripts/dedup-desserts.ts
 */

import { stdin as input, stdout as output } from "node:process";
import * as readline from "node:readline/promises";
import postgres from "postgres";

if (!process.env.DATABASE_URL) {
	console.error("DATABASE_URL is not set");
	process.exit(1);
}

const client = postgres(process.env.DATABASE_URL, { prepare: false });

async function main() {
	console.log("Starting dessert dedup...\n");

	// Find all active desserts grouped by LOWER(name) that have duplicates
	const duplicateGroups = await client`
		SELECT LOWER(name) AS lower_name, COUNT(*)::int AS count
		FROM desserts
		WHERE "isDeleted" = false
		GROUP BY LOWER(name)
		HAVING COUNT(*) > 1
	`;

	if (duplicateGroups.length === 0) {
		console.log("No duplicate desserts found. Nothing to do.");
		await client.end();
		return;
	}

	console.log(`Found ${duplicateGroups.length} duplicate group(s):\n`);

	const actionsToTake: { id: number; newName: string }[] = [];

	for (const group of duplicateGroups) {
		const lowerName = group.lower_name;
		console.log(`--- Group: "${lowerName}" (${group.count} duplicates in desserts) ---`);

		// Get all active desserts in this group with their order_items count
		const dessertsInGroup = await client`
			SELECT
				d.id,
				d.name,
				d.sequence,
				COALESCE((
					SELECT COUNT(*)::int FROM order_items oi WHERE oi."dessertId" = d.id
				), 0) AS order_count
			FROM desserts d
			WHERE LOWER(d.name) = ${lowerName}
				AND d."isDeleted" = false
			ORDER BY order_count DESC, d.sequence ASC
		`;

		const keeper = dessertsInGroup[0];
		const toDelete = dessertsInGroup.slice(1);

		console.log(
			`  KEEP: id=${keeper.id}, name="${keeper.name}", order_items=${keeper.order_count}, seq=${keeper.sequence}`,
		);

		for (const dup of toDelete) {
			const suffix = `_deleted_${Date.now()}`;
			const deletedName =
				dup.name.length + suffix.length > 255
					? `${dup.name.slice(0, 255 - suffix.length)}${suffix}`
					: `${dup.name}${suffix}`;
			console.log(
				`  DELETE: id=${dup.id}, name="${dup.name}", order_items=${dup.order_count}, seq=${dup.sequence} → renamed to "${deletedName}"`,
			);

			actionsToTake.push({ id: dup.id, newName: deletedName });
		}

		console.log();
	}

	if (actionsToTake.length === 0) {
		console.log("No actions to take.");
		await client.end();
		return;
	}

	const rl = readline.createInterface({ input, output });
	const answer = await rl.question(
		`\nAre you sure you want to proceed and soft-delete ${actionsToTake.length} duplicate desserts? (y/N): `,
	);
	rl.close();

	if (answer.trim().toLowerCase() !== "y") {
		console.log("Aborted. No changes were made.");
		await client.end();
		return;
	}

	console.log("\nExecuting updates...");
	for (const action of actionsToTake) {
		await client`
			UPDATE desserts
			SET "isDeleted" = true, name = ${action.newName}
			WHERE id = ${action.id}
		`;
	}

	console.log("Dedup complete.");
	await client.end();
}

main()
	.then(() => process.exit(0))
	.catch((err) => {
		console.error("Dedup failed:", err);
		process.exit(1);
	});
