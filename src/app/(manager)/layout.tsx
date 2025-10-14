import { headers } from "next/headers";
import { RedirectType, redirect } from "next/navigation";

import { auth } from "@/lib/auth";

export default async function ManagerLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	const data = await auth.api.getSession({ headers: await headers() });

	if (!data?.session) {
		redirect("/login", RedirectType.replace);
	}

	if (data?.user.role !== "admin") {
		redirect("/", RedirectType.replace);
	}

	return (
		<div className="flex min-h-[calc(100vh-52px)] flex-col">{children}</div>
	);
}
