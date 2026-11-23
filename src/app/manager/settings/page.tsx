import type { Metadata } from "next";
import { RedirectType, redirect } from "next/navigation";
import { PageFrame } from "@/components/page-frame";
import { getServerSession } from "@/lib/auth";
import SettingsClient from "./settings-client";

export const metadata: Metadata = {
	title: "Settings",
	description: "Manage your account settings",
};

export default async function SettingsPage() {
	const session = await getServerSession();

	if (!session?.user) {
		redirect("/login", RedirectType.replace);
	}

	return (
		<PageFrame as="main" frame="narrow" centered>
			<SettingsClient
				user={{
					id: session.user.id,
					name: session.user.name,
					email: session.user.email,
					role: session.user.role ?? "user",
				}}
			/>
		</PageFrame>
	);
}
