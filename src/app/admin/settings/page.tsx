import type { Metadata } from "next";
import { requireArea } from "@/features/access/session";
import { pageMetadata } from "@/features/shell/routes";
import { SettingsPage } from "@/features/shell/settings-page";

export const metadata: Metadata = pageMetadata("/admin/settings");

export default async function AdminSettingsPage() {
	return <SettingsPage user={await requireArea("admin")} />;
}
