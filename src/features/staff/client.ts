import type { StaffAccount } from "@/features/staff/queries";
import { STAFF_TAGS } from "@/features/staff/tags";
import { snapshotQuery } from "@/lib/snapshot-query";

/** Served by src/app/api/admin/staff/route.ts. */
export const staffAccountsQuery = snapshotQuery<StaffAccount[]>("/api/admin/staff", {
	queryKey: ["staff", "accounts"],
	tags: STAFF_TAGS,
});
