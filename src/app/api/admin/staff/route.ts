import { adminRoute, snapshotRoute } from "@/features/access/route";
import { listStaffAccounts } from "@/features/staff/queries";

export const GET = snapshotRoute(adminRoute, listStaffAccounts);
