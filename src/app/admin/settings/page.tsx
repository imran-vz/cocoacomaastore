import type { Metadata } from "next";
import { RedirectType, redirect } from "next/navigation";
import { SettingsPage } from "@/components/settings-page";
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
		<div className="flex-1 p-4 md:p-8 pt-6">
			<div className="mb-6">
				<h2 className="text-2xl md:text-3xl font-bold tracking-tight">
					Settings
				</h2>
				<p className="text-muted-foreground">
					Manage your account and security settings
				</p>
			</div>
			<div className="max-w-lg">
				<SettingsPage
					user={{
						id: session.user.id,
						name: session.user.name,
						email: session.user.email,
						role: session.user.role ?? "admin",
					}}
				/>
			</div>
		</div>
	);
}
