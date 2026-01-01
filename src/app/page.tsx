import { headers } from "next/headers";
import { RedirectType, redirect } from "next/navigation";

import { auth } from "@/lib/auth";

export default async function RootPage() {
	const data = await auth.api.getSession({ headers: await headers() });

	if (!data || !data.session) {
		redirect("/login", RedirectType.replace);
	}

	if (data.user.role === "admin") {
		redirect("/admin", RedirectType.replace);
	}

	redirect("/manager", RedirectType.replace);
}
  