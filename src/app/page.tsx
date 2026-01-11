import { RedirectType, redirect } from "next/navigation";

import { getServerSession } from "@/lib/auth";

export default async function RootPage() {
	const data = await getServerSession();

	if (!data || !data.session) {
		redirect("/login", RedirectType.replace);
	}

	if (data.user.role === "admin") {
		redirect("/admin", RedirectType.replace);
	}

	redirect("/manager", RedirectType.replace);
}
