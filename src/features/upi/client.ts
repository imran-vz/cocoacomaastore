import type { AdminUpiAccount } from "@/features/upi/shapes";
import { UPI_TAGS } from "@/features/upi/tags";
import { snapshotQuery } from "@/lib/snapshot-query";

/** Served by src/app/api/admin/upi/route.ts. */
export const upiAccountsQuery = snapshotQuery<AdminUpiAccount[]>("/api/admin/upi", {
	queryKey: ["upi", "accounts"],
	tags: UPI_TAGS,
});
