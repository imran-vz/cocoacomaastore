import { IconArrowRight, IconDatabase, IconUsers } from "@tabler/icons-react";
import type { Metadata } from "next";
import Link from "next/link";
import { RedirectType, redirect } from "next/navigation";
import { AdminPageShell } from "@/components/admin/admin-page-shell";
import { SettingsPage } from "@/components/settings-page";
import { Card, CardAction, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
		<AdminPageShell>
			<div className="space-y-6">
				<div>
					<h2 className="text-2xl font-bold tracking-tight md:text-3xl">Settings</h2>
					<p className="text-muted-foreground">Manage account access, payments, and security settings.</p>
				</div>
				<div className="grid gap-4 md:grid-cols-2">
					<Link href="/admin/settings/managers" className="group block">
						<Card className="h-full transition-colors group-hover:bg-muted/40">
							<CardHeader>
								<CardTitle className="flex items-center gap-2">
									<IconUsers className="size-5 text-muted-foreground" />
									Managers
								</CardTitle>
								<CardDescription>Invite, review, and remove manager access.</CardDescription>
								<CardAction>
									<IconArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
								</CardAction>
							</CardHeader>
						</Card>
					</Link>
					<Link href="/admin/settings/upi" className="group block">
						<Card className="h-full transition-colors group-hover:bg-muted/40">
							<CardHeader>
								<CardTitle className="flex items-center gap-2">
									<IconDatabase className="size-5 text-muted-foreground" />
									UPI Accounts
								</CardTitle>
								<CardDescription>Configure payment handles shown during checkout.</CardDescription>
								<CardAction>
									<IconArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
								</CardAction>
							</CardHeader>
						</Card>
					</Link>
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
		</AdminPageShell>
	);
}
