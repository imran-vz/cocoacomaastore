import { adminRoute, snapshotRoute } from "@/features/access/route";
import { listUpiAccounts } from "@/features/upi/queries";

export const GET = snapshotRoute(adminRoute, listUpiAccounts);
