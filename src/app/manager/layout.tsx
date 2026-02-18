import { RedirectType, redirect } from "next/navigation";

import { getServerSession } from "@/lib/auth";

export default async function ManagerLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	const data = await getServerSession();

	if (!data || !data.session) {
		redirect("/login", RedirectType.replace);
	}

	if (data?.user.role === "admin") {
		redirect("/admin", RedirectType.replace);
	}

	return (
		<div className="min-h-[calc(100vh-52px)] bg-linear-to-b from-background to-muted/20">
			{children}
		</div>
	);
}
