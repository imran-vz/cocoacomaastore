import { IconQrcode, IconUsers } from "@tabler/icons-react";
import type { Metadata } from "next";
import { RedirectType, redirect } from "next/navigation";
import { AdminPageShell } from "@/components/admin/admin-page-shell";
import { SettingsPage } from "@/components/settings-page";
import { ListRow, ListRowTile, ListSection, RecordList } from "@/components/ui/list-row";
import { getServerSession } from "@/lib/auth";

export const metadata: Metadata = {
	title: "Settings - Admin",
	description: "Manage your admin account settings",
};

export default async function AdminSettingsPage() {
	const session = await getServerSession();

	if (!session?.user) {
		redirect("/login", RedirectType.replace);
	}

	if (session.user.role !== "admin") {
		redirect("/", RedirectType.replace);
	}

	return (
		<AdminPageShell frame="narrow">
			<SettingsPage
				description="Staff access, payment accounts and your sign-in."
				user={{
					id: session.user.id,
					name: session.user.name,
					email: session.user.email,
					role: session.user.role ?? "admin",
				}}
			>
				<ListSection title="Store">
					<RecordList aria-label="Store settings">
						<ListRow
							href="/admin/settings/managers"
							leading={
								<ListRowTile>
									<IconUsers />
								</ListRowTile>
							}
							title="Managers"
							meta="Invite, review and remove staff access"
						/>
						<ListRow
							href="/admin/settings/upi"
							leading={
								<ListRowTile>
									<IconQrcode />
								</ListRowTile>
							}
							title="UPI accounts"
							meta="Payment handles shown at checkout"
						/>
					</RecordList>
				</ListSection>
			</SettingsPage>
		</AdminPageShell>
	);
}
