import type { Metadata } from "next";
import { requireArea } from "@/features/access/session";
import { pageMetadata } from "@/features/shell/routes";
import { listStaffAccounts } from "@/features/staff/queries";
import { StaffPage } from "@/features/staff/staff-page";
import { snapshot } from "@/lib/server-snapshot";

export const metadata: Metadata = pageMetadata("/admin/settings/managers");

export default async function ManagersPage() {
	const admin = await requireArea("admin");
	return <StaffPage accounts={snapshot(listStaffAccounts())} currentUserId={admin.id} />;
}
