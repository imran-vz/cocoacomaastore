import type { Metadata } from "next";
import { requireArea } from "@/features/access/session";
import { pageMetadata } from "@/features/shell/routes";
import { SettingsPage } from "@/features/shell/settings-page";

export const metadata: Metadata = pageMetadata("/manager/settings");

export default async function ManagerSettingsPage() {
	return <SettingsPage user={await requireArea("manager")} />;
}
