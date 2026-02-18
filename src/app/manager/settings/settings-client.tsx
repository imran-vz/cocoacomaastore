"use client";

import { IconArrowLeft } from "@tabler/icons-react";
import Link from "next/link";
import { SettingsPage } from "@/components/settings-page";
import { Button } from "@/components/ui/button";

interface SettingsClientProps {
	user: {
		id: string;
		name: string;
		email: string;
		role: string;
	};
}

export default function SettingsClient({ user }: SettingsClientProps) {
	return (
		<div className="space-y-6">
			{/* Header */}
			<div className="flex items-center gap-3">
				<Button
					variant="ghost"
					size="icon"
					className="-ml-2"
					render={
						<Link href="/manager">
							<IconArrowLeft className="size-5" />
						</Link>
					}
				/>
				<div>
					<h1 className="text-2xl font-bold tracking-tight">Settings</h1>
					<p className="text-sm text-muted-foreground">
						Manage your account settings
					</p>
				</div>
			</div>

			{/* Settings Content */}
			<SettingsPage user={user} />
		</div>
	);
}
