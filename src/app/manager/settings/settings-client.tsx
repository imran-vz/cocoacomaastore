"use client";

import { SettingsPage } from "@/components/settings-page";

interface SettingsClientProps {
	user: {
		id: string;
		name: string;
		email: string;
		role: string;
	};
}

export default function SettingsClient({ user }: SettingsClientProps) {
	return <SettingsPage user={user} />;
}
