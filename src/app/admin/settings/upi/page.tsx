import type { Metadata } from "next";
import { pageMetadata } from "@/features/shell/routes";
import { listUpiAccounts } from "@/features/upi/queries";
import { UpiAccountsPage } from "@/features/upi/upi-accounts-page";
import { snapshot } from "@/lib/server-snapshot";

export const metadata: Metadata = pageMetadata("/admin/settings/upi");

export default function UpiPage() {
	return <UpiAccountsPage accounts={snapshot(listUpiAccounts())} />;
}
